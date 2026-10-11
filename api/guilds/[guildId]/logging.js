const {cors,requireAuth,requireGuildAccess,dbGet,dbSet,loggingKey,mergeConfig,configKey,validGuildId}=require("../../../lib/_lib");

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
    console.error("Runtime logging sync failed:",error?.message||error);
    return {status:"pending",message:"Saved to dashboard storage, but the running bot did not acknowledge the update. Check BOT_API_URL, BOT_SYNC_SECRET, and the bot host's public API port."};
  }
}

module.exports=async(req,res)=>{
  cors(res);if(req.method==="OPTIONS")return res.status(204).end();
  const s=requireAuth(req,res);if(!s)return;
  const id=String(req.query.guildId||"");if(!validGuildId(id))return res.status(400).json({error:"Invalid guild ID."});
  try{await requireGuildAccess(s,id);}catch(e){return res.status(e.status||502).json({error:e.status===403?e.message:"Unable to verify server permissions."});}
  try{
    const cfg=mergeConfig(await dbGet(configKey(id))),saved=await dbGet(loggingKey(id));
    const logging=mergeConfig({...cfg,logging:{...cfg.logging,...(saved||{})}}).logging;
    if(req.method==="GET")return res.json({guildId:id,logging});
    if(req.method!=="PUT")return res.status(405).json({error:"Method not allowed"});
    const b=req.body||{};
    const next={...logging};
    ["enabled","messageLogs","memberLogs","moderationLogs","commandLogs"].forEach(k=>{if(typeof b[k]==="boolean")next[k]=b[k]});
    ["messageChannelId","memberChannelId","moderationChannelId","commandChannelId"].forEach(k=>{if(b[k]===null||/^\d{17,20}$/.test(String(b[k]||"")))next[k]=b[k]||null});
    const nextConfig={...cfg,logging:next,updatedAt:new Date().toISOString()};
    await dbSet(loggingKey(id),next);
    await dbSet(configKey(id),nextConfig);
    const runtimeSync=await syncRuntimeConfig(id,nextConfig);
    return res.json({ok:true,guildId:id,logging:next,runtimeSync});
  }catch(e){console.error(e);return res.status(503).json({error:"Logging storage is unavailable."});}
};
