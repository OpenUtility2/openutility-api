const {cors,requireAuth,requireGuildAccess,dbGet,configKey,validGuildId}=require("../../../lib/_lib");

const syncStatusKey=id=>`guild:${id}:bot-sync-status`;
const STALE_AFTER_MS=180_000;

module.exports=async(req,res)=>{
  cors(res);
  res.setHeader("Cache-Control","no-store");
  if(req.method==="OPTIONS")return res.status(204).end();
  if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
  const session=requireAuth(req,res);if(!session)return;
  const id=String(req.query.guildId||"");
  if(!validGuildId(id))return res.status(400).json({error:"Invalid guild ID."});
  try{await requireGuildAccess(session,id)}catch(e){return res.status(e.status||502).json({error:e.status===403?e.message:"Unable to verify server permissions."});}
  try{
    const [config,botSync]=await Promise.all([dbGet(configKey(id)),dbGet(syncStatusKey(id))]);
    const configUpdatedAt=typeof config?.updatedAt==="string"?config.updatedAt:null;
    const checkedAt=typeof botSync?.checkedAt==="string"?botSync.checkedAt:null;
    const ageMs=checkedAt?Math.max(0,Date.now()-Date.parse(checkedAt)):null;
    const currentVersion=!!(configUpdatedAt&&botSync?.configUpdatedAt===configUpdatedAt);
    let status="not_seen",message="No successful bot apply acknowledgement has been recorded for this server yet.";
    if(checkedAt&&Number.isFinite(ageMs)){
      if(ageMs>STALE_AFTER_MS){status="stale";message="The last bot acknowledgement is older than three minutes. Check that the bot is online and API polling is enabled.";}
      else if(currentVersion){status="applied";message="The bot recently acknowledged the currently saved configuration version.";}
      else{status="pending";message="The bot has checked in, but it has not acknowledged the current saved configuration version yet.";}
    }
    return res.json({
      ok:true,guildId:id,storage:{status:"reachable",persistent:!!(process.env.UPSTASH_REDIS_REST_URL&&process.env.UPSTASH_REDIS_REST_TOKEN)},
      config:{updatedAt:configUpdatedAt},
      bot:{status,lastSeenAt:checkedAt,ageSeconds:ageMs===null?null:Math.floor(ageMs/1000),configUpdatedAt:botSync?.configUpdatedAt||null,version:botSync?.botVersion||null},
      message
    });
  }catch(error){
    console.error("Guild diagnostics failed:",error);
    return res.status(503).json({error:"Diagnostics could not read persistent storage. Check Upstash Redis configuration and connectivity."});
  }
};
