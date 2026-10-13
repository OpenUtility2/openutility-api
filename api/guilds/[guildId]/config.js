const {cors,requireAuth,requireGuildAccess,dbGet,dbSetConfigAndAutomod,mergeConfig,configKey,validGuildId}=require("../../../lib/_lib");

module.exports=async(req,res)=>{
  cors(res); if(req.method==="OPTIONS")return res.status(204).end();
  res.setHeader("Cache-Control","no-store");
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
    if(typeof next.prefix!=="string"||next.prefix.length<1||next.prefix.length>5||/\s/.test(next.prefix))return res.status(400).json({error:"Prefix must be 1-5 non-whitespace characters."});
    if(!Array.isArray(next.automod.blockedWords))return res.status(400).json({error:"Blocked words must be an array."});
    next.automod.blockedWords=next.automod.blockedWords.map(String).map(x=>x.trim()).filter(Boolean).slice(0,100);

    // The dashboard's Welcome Designer stores presentation fields in the
    // camelCase welcome object. Mirror the fields consumed by the bot's
    // existing welcome embed builder so those saved choices affect messages.
    if(body.welcome&&typeof body.welcome==="object"&&!Array.isArray(body.welcome)){
      const incoming=body.welcome;
      const currentEmbed=next.welcome_embed&&typeof next.welcome_embed==="object"&&!Array.isArray(next.welcome_embed)?next.welcome_embed:{};
      const welcomeEmbed={...currentEmbed};
      if(Object.prototype.hasOwnProperty.call(incoming,"title"))welcomeEmbed.title=String(incoming.title||"").slice(0,256);
      if(Object.prototype.hasOwnProperty.call(incoming,"color")&&/^#[0-9a-fA-F]{6}$/.test(String(incoming.color||"")))welcomeEmbed.color=String(incoming.color);
      next.welcome_embed=welcomeEmbed;
      if(Object.prototype.hasOwnProperty.call(incoming,"image"))next.welcome_image=incoming.image||null;
    }

    await dbSetConfigAndAutomod(id,next,next.automod);
    const runtimeSync={status:"queued",message:"Saved to persistent API storage. The bot polls this configuration on its next sync cycle; this confirms storage, not that every feature handler is active."};
    return res.json({ok:true,guildId:id,config:next,automod:next.automod,source:"dashboard",runtimeSync});
  }catch(e){console.error(e);return res.status(503).json({error:"Configuration storage is unavailable."});}
};
