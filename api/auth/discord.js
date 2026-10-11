const crypto = require("crypto");
const { cors } = require("../../lib/_lib");

module.exports = (req, res) => {
  cors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (
    !process.env.DISCORD_CLIENT_ID ||
    !process.env.DISCORD_REDIRECT_URI
  ) {
    return res.status(500).send("Discord OAuth is not configured.");
  }

  // Vercel Functions are stateless, so OAuth state must not
  // depend on an in-memory Map.
  const state = crypto.randomBytes(24).toString("hex");

  res.setHeader(
    "Set-Cookie",
    `openutility_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
  );

  const q = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    response_type: "code",
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    scope: "identify guilds",
    state
  });

  res.redirect(
    "https://discord.com/oauth2/authorize?" + q.toString()
  );
};
