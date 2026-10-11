const {cors,requireAuth,requireGuildAccess,discordFetch}=require("../../../lib/_lib");
module.exports=async(req,res)=>{
  cors(res);if(req.method==="OPTIONS")return res.status(204).end();
  const s=requireAuth(req,res);if(!s)return;
  if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
  if(!process.env.DISCORD_BOT_TOKEN)return res.status(503).json({error:"Bot token is not configured."});
  try{
    await requireGuildAccess(s,req.query.guildId);
    const cs=await discordFetch(`https://discord.com/api/v10/guilds/${req.query.guildId}/channels`,{headers:{Authorization:`Bot ${process.env.DISCORD_BOT_TOKEN}`}});
    res.json({channels:cs.filter(c=>c.type===0||c.type===5).map(c=>({id:c.id,name:c.name,type:c.type}))});
  }catch(e){res.status(e.status||502).json({error:e.status===403?e.message:"Unable to load server channels."});}
};
