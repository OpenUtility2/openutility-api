const {cors,requireAuth,requireGuildAccess,dbGet,dbSet,loggingKey,mergeConfig,configKey,validGuildId}=require("../../../lib/_lib");

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
    const runtimeSync={status:"queued",message:"Saved to API storage. The bot will fetch the latest configuration on its next polling cycle; this confirms storage, not that every feature handler is active."};
    return res.json({ok:true,guildId:id,logging:next,runtimeSync});
  }catch(e){console.error(e);return res.status(503).json({error:"Logging storage is unavailable."});}
};
