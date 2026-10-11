const {cors,requireAuth,requireGuildAccess,dbGet,dbSet,validGuildId}=require("../../../lib/_lib");

function cleanUrl(value){
  if(value===null||value==="")return null;
  try{const url=new URL(String(value));return url.protocol==="https:"?url.toString().slice(0,2048):null}catch{return null}
}
function cleanProfile(input={}){
  const color=String(input.color||"#5865f2");
  return {
    name:String(input.name||"OpenUtility").trim().slice(0,80)||"OpenUtility",
    avatarUrl:cleanUrl(input.avatarUrl),
    status:String(input.status||"").trim().slice(0,128),
    backstory:String(input.backstory||"").trim().slice(0,1000),
    color:/^#[0-9a-fA-F]{6}$/.test(color)?color:"#5865f2",
    bannerUrl:cleanUrl(input.bannerUrl),
    tagline:String(input.tagline||"").trim().slice(0,160),
    enabled:input.enabled!==false,
    updatedAt:new Date().toISOString()
  };
}
module.exports=async(req,res)=>{
  cors(res);
  res.setHeader("Cache-Control","no-store");
  if(req.method==="OPTIONS")return res.status(204).end();
  const session=requireAuth(req,res);if(!session)return;
  const id=String(req.query.guildId||"");
  if(!validGuildId(id))return res.status(400).json({error:"Invalid guild ID."});
  try{await requireGuildAccess(session,id)}catch(e){return res.status(e.status||502).json({error:e.status===403?e.message:"Unable to verify server permissions."})}
  if(!["GET","PUT"].includes(req.method))return res.status(405).json({error:"Method not allowed"});
  const key=`guild:${id}:bot-profile`;
  try{
    if(req.method==="GET")return res.json({guildId:id,profile:(await dbGet(key))||cleanProfile({})});
    const body=req.body;
    if(!body||typeof body!=="object"||Array.isArray(body))return res.status(400).json({error:"Invalid bot profile."});
    if(body.avatarUrl&&!cleanUrl(body.avatarUrl))return res.status(400).json({error:"Avatar URL must be a valid HTTPS URL."});
    if(body.bannerUrl&&!cleanUrl(body.bannerUrl))return res.status(400).json({error:"Banner URL must be a valid HTTPS URL."});
    const profile=cleanProfile(body);
    await dbSet(key,profile);
    return res.json({ok:true,guildId:id,profile});
  }catch(e){console.error("Bot profile error:",e);return res.status(503).json({error:"Bot profile storage is unavailable."})}
};
