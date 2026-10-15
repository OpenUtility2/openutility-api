const {
  cors,
  discordFetch,
  setSession
} = require("../../../lib/_lib");

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  return Object.fromEntries(
    raw.split(";").filter(Boolean).map(part => {
      const i = part.indexOf("=");
      return [part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1).trim())];
    })
  );
}

module.exports = async (req, res) => {
  cors(res, req);
  if (req.method === "OPTIONS") return res.status(204).end();

  const { code, state, error } = req.query || {};
  const front = "https://feloony.github.io/workingonit";
  const dashboard = `${front}/`;

  if (error) return res.redirect(`${front}/?auth=error`);
  if (!code || !state) return res.status(400).send("Invalid OAuth response.");

  const cookies = parseCookies(req);
  const savedState = cookies.openutility_oauth_state;
  if (!savedState || savedState !== state) {
    return res.status(400).send("Invalid or expired OAuth state.");
  }

  res.setHeader(
    "Set-Cookie",
    "openutility_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
  );

  try {
    const body = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI
    });

    const token = await discordFetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });

    const user = await discordFetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });

    setSession(res, {
      user: {
        id: user.id,
        username: user.username,
        global_name: user.global_name || user.username,
        avatar: user.avatar || null
      },
      accessToken: token.access_token
    });

    res.redirect(`${dashboard}?auth=success`);
  } catch (e) {
    console.error("OAuth callback:", e);
    res.redirect(`${front}/?auth=error`);
  }
};
