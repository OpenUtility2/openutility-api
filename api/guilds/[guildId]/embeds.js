const {cors,requireAuth,requireGuildAccess,discordFetch,dbGet,dbSet,embedKey,validGuildId}=require("../../_lib");
function safeHttpsUrl(value){if(!value)return null;try{const u=new URL(String(value));return u.protocol==="https:"?u.toString().slice(0,2048):null}catch{return null}}
function cleanEmbed(input={}){
  const e={};
  if(input.title)e.title=String(input.title).slice(0,256);
  if(input.description)e.description=String(input.description).slice(0,4096);
  if(input.url){const url=safeHttpsUrl(input.url);if(url)e.url=url;}
  if(input.color!==undefined){const n=Number(input.color);if(Number.isInteger(n)&&n>=0&&n<=16777215)e.color=n;}
  if(input.footer?.text)e.footer={text:String(input.footer.text).slice(0,2048)};
  if(input.author?.name)e.author={name:String(input.author.name).slice(0,256)};
  if(Array.isArray(input.fields))e.fields=input.fields.slice(0,25).map(f=>({name:String(f.name||"Field").slice(0,256),value:String(f.value||" ").slice(0,1024),inline:!!f.inline}));
  if(input.thumbnail?.url){const url=safeHttpsUrl(input.thumbnail.url);if(url)e.thumbnail={url};}
  if(input.image?.url){const url=safeHttpsUrl(input.image.url);if(url)e.image={url};}
  return e;
}
module.exports=async(req,res)=>{
  cors(res);if(req.method==="OPTIONS")return res.status(204).end();
  const s=requireAuth(req,res);if(!s)return;
  const id=String(req.query.guildId||"");if(!validGuildId(id))return res.status(400).json({error:"Invalid guild ID."});
  try{await requireGuildAccess(s,id);}catch(e){return res.status(e.status||502).json({error:e.status===403?e.message:"Unable to verify server permissions."});}
  try{
    const key=embedKey(id),saved=(await dbGet(key))||[];
    if(req.method==="GET")return res.json({embeds:saved});
    if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
    const b=req.body||{},embed=cleanEmbed(b.embed||b),action=b.action||"save";
    if(!embed.title&&!embed.description&&!embed.fields?.length)return res.status(400).json({error:"Embed needs content."});
    if(action==="send"){
      if(!process.env.DISCORD_BOT_TOKEN)return res.status(503).json({error:"Bot token is not configured."});
      const channelId=String(b.channelId||"");if(!/^\d{17,20}$/.test(channelId))return res.status(400).json({error:"A valid channel ID is required."});
      const botHeaders={Authorization:`Bot ${process.env.DISCORD_BOT_TOKEN}`};
      const channel=await discordFetch(`https://discord.com/api/v10/channels/${channelId}`,{headers:botHeaders});
      if(String(channel.guild_id)!==id||![0,5].includes(channel.type))return res.status(400).json({error:"Choose a text channel in the selected server."});
      const guild=await discordFetch(`https://discord.com/api/v10/guilds/${id}`,{headers:botHeaders});
      const member=await discordFetch(`https://discord.com/api/v10/guilds/${id}/members/@me`,{headers:botHeaders});
      const roles=await discordFetch(`https://discord.com/api/v10/guilds/${id}/roles`,{headers:botHeaders});
      const roleMap=new Map(roles.map(r=>[r.id,BigInt(r.permissions||"0")]));let permissions=roleMap.get(id)||0n;
      for(const roleId of member.roles||[])permissions|=roleMap.get(roleId)||0n;
      if((permissions&8n)!==8n&&(permissions&2048n)!==2048n)return res.status(403).json({error:"The bot needs Send Messages permission in the selected channel."});
      if((permissions&8n)!==8n&&(permissions&16384n)!==16384n)return res.status(403).json({error:"The bot needs Embed Links permission in the selected channel."});
      await discordFetch(`https://discord.com/api/v10/channels/${channelId}/messages`,{method:"POST",headers:{...botHeaders,"Content-Type":"application/json"},body:JSON.stringify({embeds:[embed]})});
      return res.json({ok:true,sent:true});
    }
    const idValue=String(b.id||Date.now()),record={id:idValue,name:String(b.name||embed.title||"Untitled").slice(0,80),embed,updatedAt:new Date().toISOString()};
    const next=[...saved.filter(x=>x.id!==idValue),record].slice(-50);await dbSet(key,next);res.json({ok:true,embed:record,embeds:next});
  }catch(e){console.error(e);res.status(e.status||503).json({error:e.message||"Embed operation failed."});}
};
