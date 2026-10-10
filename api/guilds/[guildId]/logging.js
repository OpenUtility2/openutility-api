const {cors,requireAuth,requireGuildAccess,dbGet,dbSetConfigAndLogging,loggingKey,mergeConfig,configKey,validGuildId}=require("../../_lib");
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const booleanFields=["enabled","messageLogs","memberLogs","moderationLogs","commandLogs"];
const channelFields=["messageChannelId","memberChannelId","moderationChannelId","commandChannelId"];
const validChannel=value=>value===null||value===""||/^\d{17,20}$/.test(String(value));
module.exports=async(req,res)=>{
  cors(res);if(req.method==="OPTIONS")return res.status(204).end();
  const session=requireAuth(req,res);if(!session)return;
  const id=String(req.query.guildId||"");if(!validGuildId(id))return res.status(400).json({error:"Invalid guild ID."});
  try{await requireGuildAccess(session,id);}catch(error){return res.status(error.status||502).json({error:error.status===403?error.message:"Unable to verify server permissions."});}
  if(!["GET","PUT"].includes(req.method))return res.status(405).json({error:"Method not allowed"});
  try{
    const cfg=mergeConfig(await dbGet(configKey(id))),saved=await dbGet(loggingKey(id));
    const logging=mergeConfig({...cfg,logging:{...cfg.logging,...(saved||{})}}).logging;
    if(req.method==="GET"){res.setHeader("Cache-Control","no-store");return res.json({guildId:id,logging});}
    const body=req.body;
    if(!body||typeof body!=="object"||Array.isArray(body))return res.status(400).json({error:"Logging settings must be a JSON object."});
    const unsupported=Object.keys(body).find(k=>!booleanFields.includes(k)&&!channelFields.includes(k));
    if(unsupported)return res.status(400).json({error:`Unsupported logging setting: ${unsupported}.`});
    const next={...logging};
    for(const key of booleanFields)if(own(body,key)){if(typeof body[key]!=="boolean")return res.status(400).json({error:`Logging setting "${key}" must be true or false.`});next[key]=body[key];}
    for(const key of channelFields)if(own(body,key)){if(!validChannel(body[key]))return res.status(400).json({error:`"${key}" must be a valid Discord channel ID or empty.`});next[key]=body[key]||null;}
    const nextConfig={...cfg,logging:next,updatedAt:new Date().toISOString()};
    await dbSetConfigAndLogging(id,nextConfig,next);
    res.setHeader("Cache-Control","no-store");
    return res.json({ok:true,guildId:id,logging:next,config:nextConfig});
  }catch(error){console.error("Logging save failed:",error);return res.status(503).json({error:"Logging storage is unavailable. Your changes were not confirmed as saved."});}
};
