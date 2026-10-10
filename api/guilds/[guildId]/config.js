const {cors,requireAuth,requireGuildAccess,dbGet,dbSetConfigAndAutomod,mergeConfig,configKey,validGuildId}=require("../../_lib");

const isObject=value=>!!value&&typeof value==="object"&&!Array.isArray(value);
const isSnowflake=value=>value===null||/^\d{17,20}$/.test(String(value||""));
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
function validateSection(section,fields,types,label){
  if(!own(section,"")){}
  for(const [key,value] of Object.entries(section)){
    if(!Object.prototype.hasOwnProperty.call(fields,key))return `Unsupported ${label} setting: ${key}.`;
    const type=types[key];
    if(type==="boolean"&&typeof value!=="boolean")return `${label} setting "${key}" must be true or false.`;
  }
  return null;
}
module.exports=async(req,res)=>{
  cors(res);if(req.method==="OPTIONS")return res.status(204).end();
  const session=requireAuth(req,res);if(!session)return;
  const id=String(req.query.guildId||"");
  if(!validGuildId(id))return res.status(400).json({error:"Invalid guild ID."});
  try{await requireGuildAccess(session,id);}catch(error){return res.status(error.status||502).json({error:error.status===403?error.message:"Unable to verify server permissions."});}
  if(!["GET","PUT"].includes(req.method))return res.status(405).json({error:"Method not allowed"});
  try{
    const key=configKey(id),current=mergeConfig(await dbGet(key));
    if(req.method==="GET")return res.setHeader("Cache-Control","no-store"),res.json({guildId:id,config:current});
    const body=req.body;
    if(!isObject(body))return res.status(400).json({error:"Invalid configuration. Send a JSON object."});
    const allowedTop=["prefix","commands","welcome","automod","moderation"];
    const unsupported=Object.keys(body).find(k=>!allowedTop.includes(k));
    if(unsupported)return res.status(400).json({error:`Unsupported configuration setting: ${unsupported}.`});
    const next=mergeConfig(current);
    if(own(body,"prefix")){
      if(typeof body.prefix!=="string")return res.status(400).json({error:"Prefix must be text."});
      const prefix=body.prefix.trim();
      if(prefix.length<1||prefix.length>5||/\s/.test(prefix))return res.status(400).json({error:"Prefix must be 1–5 characters with no spaces."});
      next.prefix=prefix;
    }
    if(own(body,"commands")){
      if(!isObject(body.commands))return res.status(400).json({error:"Commands settings must be an object."});
      const err=validateSection(body.commands,{slash:1,prefix:1},{slash:"boolean",prefix:"boolean"},"commands");
      if(err)return res.status(400).json({error:err});
      next.commands={...current.commands,...body.commands};
    }
    if(own(body,"welcome")){
      if(!isObject(body.welcome))return res.status(400).json({error:"Welcome settings must be an object."});
      const fields={enabled:1,dmEnabled:1,channelId:1,message:1,title:1,color:1,autoRoleId:1,image:1};
      const types={enabled:"boolean",dmEnabled:"boolean",message:"string",title:"string",color:"string"};
      const err=validateSection(body.welcome,fields,types,"welcome");if(err)return res.status(400).json({error:err});
      const w=body.welcome;
      if(own(w,"channelId")&&!isSnowflake(w.channelId))return res.status(400).json({error:"Welcome channel must be a valid Discord channel ID or empty."});
      if(own(w,"autoRoleId")&&!isSnowflake(w.autoRoleId))return res.status(400).json({error:"Auto-role must be a valid Discord role ID or empty."});
      if(own(w,"message")&&w.message.length>2000)return res.status(400).json({error:"Welcome message cannot exceed 2,000 characters."});
      if(own(w,"title")&&w.title.length>256)return res.status(400).json({error:"Welcome title cannot exceed 256 characters."});
      if(own(w,"color")&&!/^#[0-9a-f]{6}$/i.test(w.color))return res.status(400).json({error:"Welcome color must be a six-digit hex color."});
      if(own(w,"image")&&w.image!==null&&typeof w.image!=="string")return res.status(400).json({error:"Welcome image must be a URL or empty."});
      if(own(w,"image")&&typeof w.image==="string"&&w.image&&!/^https:\/\//i.test(w.image))return res.status(400).json({error:"Welcome image must use HTTPS."});
      next.welcome={...current.welcome,...w};
    }
    if(own(body,"automod")){
      if(!isObject(body.automod))return res.status(400).json({error:"AutoMod settings must be an object."});
      const fields={enabled:1,antiSpam:1,antiLinks:1,blockedWords:1};
      const types={enabled:"boolean",antiSpam:"boolean",antiLinks:"boolean"};
      const err=validateSection(body.automod,fields,types,"AutoMod");if(err)return res.status(400).json({error:err});
      const words=body.automod.blockedWords;
      if(own(body.automod,"blockedWords")&&(!Array.isArray(words)||words.length>100||words.some(w=>typeof w!=="string"||w.trim().length>100)))return res.status(400).json({error:"Blocked words must be up to 100 text entries, each no longer than 100 characters."});
      next.automod={...current.automod,...body.automod};
      next.automod.blockedWords=(next.automod.blockedWords||[]).map(w=>w.trim()).filter(Boolean);
    }
    if(own(body,"moderation")){
      if(!isObject(body.moderation))return res.status(400).json({error:"Moderation settings must be an object."});
      const fields={enabled:1,warnings:1,timeoutMinutes:1};
      const types={enabled:"boolean",warnings:"boolean"};
      const err=validateSection(body.moderation,fields,types,"Moderation");if(err)return res.status(400).json({error:err});
      const m=body.moderation;
      if(own(m,"timeoutMinutes")&&(!Number.isInteger(m.timeoutMinutes)||m.timeoutMinutes<1||m.timeoutMinutes>40320))return res.status(400).json({error:"Default timeout must be a whole number from 1 to 40,320 minutes."});
      next.moderation={...current.moderation,...m};
    }
    // The browser cannot change server security state or logging through this route.
    next.security=current.security;next.logging=current.logging;
    next.updatedAt=new Date().toISOString();
    await dbSetConfigAndAutomod(id,next,next.automod);
    res.setHeader("Cache-Control","no-store");
    return res.json({ok:true,guildId:id,config:next,automod:next.automod,source:"dashboard"});
  }catch(error){console.error("Configuration save failed:",error);return res.status(503).json({error:"Configuration storage is unavailable. Your changes were not confirmed as saved."});}
};
