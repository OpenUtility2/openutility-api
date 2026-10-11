const {cors,requireAuth,requireGuildAccess,dbGet,dbSet,validGuildId}=require("../../../lib/_lib");

const ALLOWED_SECTIONS=new Set(["configuration","automod","logging","welcome"]);
module.exports=async(req,res)=>{
  cors(res);if(req.method==="OPTIONS")return res.status(204).end();
  const session=requireAuth(req,res);if(!session)return;
  const guildId=String(req.query.guildId||"");
  if(!validGuildId(guildId))return res.status(400).json({error:"Invalid guild ID."});
  try{await requireGuildAccess(session,guildId)}catch(e){return res.status(e.status||502).json({error:e.status===403?e.message:"Unable to verify server permissions."})}
  const key=`guild:${guildId}:dashboard-audit`;
  try{
    if(req.method==="GET"){
      const entries=await dbGet(key);
      return res.json({guildId,entries:Array.isArray(entries)?entries.slice(0,100):[]});
    }
    if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
    const body=req.body||{},section=String(body.section||"");
    if(!ALLOWED_SECTIONS.has(section))return res.status(400).json({error:"Unsupported change-history section."});
    const allowedFields=new Set(["prefix","commands","welcome","automod","moderation","logging","enabled","messageChannelId","memberChannelId","moderationChannelId","commandChannelId","messageLogs","memberLogs","moderationLogs","commandLogs","antiSpam","antiLinks","blockedWords","timeoutMinutes","warnings","channelId","message"]);
    const fields=Array.isArray(body.fields)?[...new Set(body.fields.map(String).filter(x=>allowedFields.has(x)))].slice(0,20):[];
    const actor=session.user||{};
    const entry={id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,section,fields,actorId:String(actor.id||""),actorName:String(actor.global_name||actor.username||"Server admin").slice(0,100),createdAt:new Date().toISOString()};
    const previous=await dbGet(key),entries=Array.isArray(previous)?previous:[];
    await dbSet(key,[entry,...entries].slice(0,100));
    return res.json({ok:true,entry});
  }catch(e){console.error("Dashboard change history unavailable:",e);return res.status(503).json({error:"Change history storage is unavailable."})}
};
