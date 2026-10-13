const {cors,requireAuth,requireGuildAccess,dbGet,dbSetConfigAndAutomod,mergeConfig,configKey,validGuildId}=require("../../../lib/_lib");

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
    const runtimeSync={status:"queued",message:"Saved to API storage. The bot will fetch the latest configuration on its next polling cycle; this confirms storage, not that every feature handler is active."};
    return res.json({ok:true,guildId:id,config:next,automod:next.automod,source:"dashboard",runtimeSync});
  }catch(e){console.error(e);return res.status(503).json({error:"Configuration storage is unavailable."});}
};
