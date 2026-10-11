const {cors,requireAuth,requireGuildAccess,dbGet,dbSetConfigAndAutomod,mergeConfig,configKey,validGuildId}=require("../../_lib");

async function syncRuntimeConfig(guildId, config){
  const base=String(process.env.BOT_API_URL||"").trim().replace(/\/$/,"");
  const secret=String(process.env.BOT_SYNC_SECRET||"");
  if(!base||!secret)return {status:"pending",message:"Saved to dashboard storage, but bot synchronization is not configured. Set BOT_API_URL and BOT_SYNC_SECRET on the API deployment and BOT_SYNC_SECRET on the bot host."};
  try{
    const target=new URL(base);
    if(target.protocol!=="https:"&&target.hostname!=="localhost"&&target.hostname!=="127.0.0.1")throw new Error("BOT_API_URL must use HTTPS.");
    const response=await fetch(`${target.origin}/api/bot/guild/${encodeURIComponent(guildId)}/config`,{
      method:"PUT",
      headers:{"content-type":"application/json",authorization:`Bearer ${secret}`},
      body:JSON.stringify({source:"website",guildId,config,automod:config.automod||{},prefix:config.prefix}),
      signal:AbortSignal.timeout(7000)
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok||result.ok!==true)throw new Error(`Bot sync returned HTTP ${response.status}.`);
    return {status:"synced",message:"The running bot acknowledged the configuration update."};
  }catch(error){
    console.error("Runtime config sync failed:",error?.message||error);
    return {status:"pending",message:"Saved to dashboard storage, but the running bot did not acknowledge the update. Check BOT_API_URL, BOT_SYNC_SECRET, and the bot host's public API port."};
  }
}

module.exports=async(req,res)=>{
  cors(res); if(req.method==="OPTIONS")return res.status(204).end();
  const s=requireAuth(req,res); if(!s)return;
  const id=String(req.query.guildId||"");
  if(!validGuildId(id))return res.status(400).json({error:"Invalid guild ID."});
  try{await requireGuildAccess(s,id);}catch(e){return res.status(e.status||502).json({error:e.status===403?e.message:"Unable to verify server permissions."});}
  try{
    const key=configKey(id), current=mergeConfig(await dbGet(key));
    if(req.method==="GET")return res.json({guildId:id,config:current});
    if(req.method!=="PUT")return res.status(405).json({error:"Method not allowed"});
    const body=req.body||{};
    if(typeof body!=="object"||Array.isArray(body))return res.status(400).json({error:"Invalid configuration."});
    const next=mergeConfig({...current,...body,commands:{...current.commands,...(body.commands||{})},welcome:{...current.welcome,...(body.welcome||{})},automod:{...current.automod,...(body.automod||{})},moderation:{...current.moderation,...(body.moderation||{})},logging:{...current.logging,...(body.logging||{})},updatedAt:new Date().toISOString()});
    if(typeof next.prefix!=="string"||next.prefix.length<1||next.prefix.length>5)return res.status(400).json({error:"Prefix must be 1-5 characters."});
    if(!Array.isArray(next.automod.blockedWords))return res.status(400).json({error:"Blocked words must be an array."});
    next.automod.blockedWords=next.automod.blockedWords.map(String).map(x=>x.trim()).filter(Boolean).slice(0,100);
    await dbSetConfigAndAutomod(id,next,next.automod);
    const runtimeSync=await syncRuntimeConfig(id,next);
    return res.json({ok:true,guildId:id,config:next,automod:next.automod,source:"dashboard",runtimeSync});
  }catch(e){console.error(e);return res.status(503).json({error:"Configuration storage is unavailable."});}
};
