const {cors,requireAuth,requireGuildAccess,discordFetch,dbGet,dbSet,validGuildId}=require("../../../lib/_lib");

const ACTION_PERMISSIONS={ban:4,kick:2,timeout:1099511627776,untimeout:1099511627776,unban:4};
async function discordJson(path,token){
  return discordFetch("https://discord.com/api/v10"+path,{headers:{Authorization:`Bot ${token}`}});
}
module.exports=async(req,res)=>{
  cors(res);if(req.method==="OPTIONS")return res.status(204).end();
  const session=requireAuth(req,res);if(!session)return;
  const id=String(req.query.guildId||"");
  if(!validGuildId(id))return res.status(400).json({error:"Invalid guild ID."});
  let actorGuild;
  try{actorGuild=await requireGuildAccess(session,id);}catch(e){return res.status(e.status||502).json({error:e.status===403?e.message:"Unable to verify server permissions."});}
  if(!["GET","POST"].includes(req.method))return res.status(405).json({error:"Method not allowed"});
  const casesKey=`guild:${id}:moderation-cases`;
  if(req.method==="GET"){
    try{const stored=await dbGet(casesKey);return res.json({guildId:id,cases:Array.isArray(stored)?stored.slice(0,25):[]});}
    catch(error){console.error("Moderation case history unavailable:",error);return res.status(503).json({error:"Moderation case history is unavailable."});}
  }
  const token=process.env.DISCORD_BOT_TOKEN;
  if(!token)return res.status(503).json({error:"Bot token is not configured."});
  const {action,userId,reason,minutes}=req.body||{};
  if(!Object.prototype.hasOwnProperty.call(ACTION_PERMISSIONS,action))return res.status(400).json({error:"Unsupported moderation action."});
  if(!/^\d{17,20}$/.test(String(userId||"")))return res.status(400).json({error:"A valid Discord user ID is required."});
  try{
    const [guild,bot,actor,roles]=await Promise.all([
      discordJson(`/guilds/${id}`,token),
      discordJson("/users/@me",token),
      discordJson(`/guilds/${id}/members/${session.user.id}`,token),
      discordJson(`/guilds/${id}/roles`,token)
    ]);
    const target=action==="unban"?null:await discordJson(`/guilds/${id}/members/${userId}`,token);
    if(action!=="unban"&&target.user?.id===guild.owner_id)return res.status(403).json({error:"The server owner cannot be moderated."});
    if(action!=="unban"&&target.user?.id===bot.id)return res.status(400).json({error:"The bot cannot moderate itself."});
    const roleMap=new Map(roles.map(r=>[r.id,{position:Number(r.position||0),permissions:BigInt(r.permissions||"0")} ]));
    const highest=member=>Math.max(0,...(member?.roles||[]).map(r=>roleMap.get(r)?.position||0));
    const actorIsOwner=session.user.id===guild.owner_id;
    const actorPerms=BigInt(actorGuild.permissions||"0");
    const needed=BigInt(ACTION_PERMISSIONS[action]);
    if(!actorIsOwner&&(actorPerms&8n)!==8n&&(actorPerms&needed)!==needed)return res.status(403).json({error:"You do not have the Discord permission required for this action."});
    if(!actorIsOwner&&action!=="unban"&&highest(actor)<=highest(target))return res.status(403).json({error:"Your highest role must be above the target member's highest role."});
    const botMember=await discordJson(`/guilds/${id}/members/${bot.id}`,token);
    if(action!=="unban"&&highest(botMember)<=highest(target))return res.status(403).json({error:"The bot's highest role must be above the target member's highest role."});
    const everyoneRole=roleMap.get(id);
    let botPerms=everyoneRole?.permissions||0n;
    for(const roleId of botMember.roles||[])botPerms|=roleMap.get(roleId)?.permissions||0n;
    if((botPerms&needed)!==needed)return res.status(403).json({error:"The bot is missing the Discord permission required for this action."});
    const reasonText=String(reason||"OpenUtility Dashboard").slice(0,512);
    const headers={Authorization:`Bot ${token}`,"Content-Type":"application/json","X-Audit-Log-Reason":encodeURIComponent(reasonText)};
    const base=`https://discord.com/api/v10/guilds/${id}`;
    let result={ok:true,action};
    if(action==="ban")await discordFetch(`${base}/bans/${userId}`,{method:"PUT",headers,body:JSON.stringify({delete_message_seconds:0})});
    else if(action==="unban")await discordFetch(`${base}/bans/${userId}`,{method:"DELETE",headers});
    else if(action==="kick")await discordFetch(`${base}/members/${userId}`,{method:"DELETE",headers});
    else if(action==="timeout"){const m=Math.max(1,Math.min(40320,Number(minutes)||10));const until=new Date(Date.now()+m*60000).toISOString();await discordFetch(`${base}/members/${userId}`,{method:"PATCH",headers,body:JSON.stringify({communication_disabled_until:until})});result.minutes=m;}
    else if(action==="untimeout")await discordFetch(`${base}/members/${userId}`,{method:"PATCH",headers,body:JSON.stringify({communication_disabled_until:null})});
    try{
      const existing=await dbGet(casesKey);
      const cases=Array.isArray(existing)?existing:[];
      const actor=session.user||{};
      const entry={id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,action,userId:String(userId),moderatorId:String(actor.id||""),moderatorName:String(actor.global_name||actor.username||"Moderator").slice(0,100),reason:reasonText,minutes:result.minutes||null,createdAt:new Date().toISOString()};
      await dbSet(casesKey,[entry,...cases].slice(0,100));
      result.caseLogged=true;
    }catch(logError){console.error("Moderation succeeded but case history could not be stored:",logError);result.caseLogged=false;}
    return res.json(result);
  }catch(e){return res.status(e.status||502).json({error:e.message||"Discord moderation action failed."});}
};
