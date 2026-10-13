const {requireBotSyncAuth,dbGet,dbSet,mergeConfig,configKey,automodKey,validGuildId}=require("../../../../lib/_lib");
const syncStatusKey=id=>`guild:${id}:bot-sync-status`;

function bodyObject(req){
  const body=req.body;
  if(!body||typeof body!=="object"||Array.isArray(body))return null;
  return body;
}

function cleanAutomod(value){
  const a=value&&typeof value==="object"&&!Array.isArray(value)?{...value}:{};
  if(Array.isArray(a.blockedWords))a.blockedWords=a.blockedWords.map(String).map(v=>v.trim()).filter(Boolean).slice(0,100);
  return a;
}

module.exports=async(req,res)=>{
  res.setHeader("Cache-Control","no-store");
  if(req.method==="OPTIONS")return res.status(204).end();
  if(!requireBotSyncAuth(req,res))return;
  const id=String(req.query.guildId||"");
  if(!validGuildId(id))return res.status(400).json({error:"Invalid guild ID."});
  if(!["GET","PUT","POST"].includes(req.method))return res.status(405).json({error:"Method not allowed"});

  try{
    if(req.method==="POST"){
      const body=bodyObject(req);
      if(!body)return res.status(400).json({error:"Invalid bot acknowledgement."});
      const status=String(body.status||"");
      if(status!=="applied")return res.status(400).json({error:"Bot acknowledgement status must be applied."});
      const checkedAt=new Date().toISOString();
      const record={
        guildId:id,
        status:"applied",
        checkedAt,
        configUpdatedAt:typeof body.configUpdatedAt==="string"?body.configUpdatedAt.slice(0,80):null,
        botVersion:typeof body.botVersion==="string"?body.botVersion.slice(0,40):null
      };
      await dbSet(syncStatusKey(id),record);
      return res.json({ok:true,guildId:id,acknowledgedAt:checkedAt});
    }
    const [storedConfig,storedAutomod]=await Promise.all([dbGet(configKey(id)),dbGet(automodKey(id))]);
    if(req.method==="GET"){
      return res.json({ok:true,guildId:id,config:mergeConfig(storedConfig),automod:cleanAutomod(storedAutomod),source:"website"});
    }

    const body=bodyObject(req);
    if(!body)return res.status(400).json({error:"Invalid synchronization payload."});
    const incomingConfig=body.config&&typeof body.config==="object"&&!Array.isArray(body.config)?body.config:body;
    const current=mergeConfig(storedConfig);
    const next=mergeConfig({...current,...incomingConfig,commands:{...current.commands,...(incomingConfig.commands||{})},welcome:{...current.welcome,...(incomingConfig.welcome||{})},automod:{...current.automod,...(incomingConfig.automod||{})},moderation:{...current.moderation,...(incomingConfig.moderation||{})},logging:{...current.logging,...(incomingConfig.logging||{})},updatedAt:new Date().toISOString()});
    if(typeof next.prefix!=="string"||next.prefix.length<1||next.prefix.length>5)return res.status(400).json({error:"Prefix must be 1-5 characters."});
    const incomingAutomod=Object.prototype.hasOwnProperty.call(body,"automod")?cleanAutomod(body.automod):cleanAutomod(next.automod);
    next.automod=cleanAutomod({...next.automod,...incomingAutomod});

    await Promise.all([dbSet(configKey(id),next),dbSet(automodKey(id),next.automod)]);
    return res.json({ok:true,guildId:id,config:next,automod:next.automod,source:"bot"});
  }catch(error){
    console.error("Bot sync error:",error);
    return res.status(503).json({error:"Bot synchronization storage is unavailable."});
  }
};
