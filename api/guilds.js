const {cors,requireAuth,discordFetch,manageable}=require("../lib/_lib");

module.exports=async(req,res)=>{
  cors(res);
  if(req.method==="OPTIONS")return res.status(204).end();
  const s=requireAuth(req,res);if(!s)return;

  try{
    const gs=await discordFetch("https://discord.com/api/v10/users/@me/guilds",{
      headers:{Authorization:`Bearer ${s.accessToken}`}
    });
    const manageableGuilds=gs.filter(manageable);
    const token=process.env.DISCORD_BOT_TOKEN;
    const clientId=process.env.DISCORD_CLIENT_ID;

    if(!token){
      return res.json({
        botConfigured:false,
        guilds:manageableGuilds.map(g=>({...g,botInstalled:false,botStatus:"not_configured",memberCount:null,onlineCount:null,botInviteUrl:clientId?`https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&scope=bot%20applications.commands&permissions=8&guild_id=${encodeURIComponent(g.id)}`:null}))
      });
    }

    // Validate the bot token once. This prevents an invalid token from making
    // every server look like the bot is simply not installed.
    let botUser;
    try{
      botUser=await discordFetch("https://discord.com/api/v10/users/@me",{
        headers:{Authorization:`Bot ${token}`}
      });
    }catch(e){
      return res.status(503).json({error:"The Discord bot token configured on the backend is invalid or expired.",code:"BOT_TOKEN_INVALID"});
    }

    const out=await Promise.all(manageableGuilds.map(async g=>{
      try{
        // Discord's guild endpoint is the authoritative check for whether
        // this bot account can see the guild. 200 = installed, 403/404 = not installed.
        const bg=await discordFetch(`https://discord.com/api/v10/guilds/${g.id}?with_counts=true`,{
          headers:{Authorization:`Bot ${token}`}
        });
        return {
          ...g,
          botInstalled:true,
          botStatus:"installed",
          botId:botUser.id,
          memberCount:bg.approximate_member_count??bg.member_count??g.memberCount??null,
          onlineCount:bg.approximate_presence_count??g.onlineCount??null,
          botInviteUrl:null
        };
      }catch(e){
        const invite=clientId?`https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&scope=bot%20applications.commands&permissions=8&guild_id=${encodeURIComponent(g.id)}`:null;
        return {
          ...g,
          botInstalled:false,
          botStatus:e.status===403||e.status===404?"not_installed":"check_failed",
          botId:botUser.id,
          memberCount:null,
          onlineCount:null,
          botInviteUrl:invite
        };
      }
    }));

    res.json({botConfigured:true,botId:botUser.id,guilds:out});
  }catch(e){
    res.status(e.status===401?401:502).json({error:"Unable to load Discord servers."});
  }
};
