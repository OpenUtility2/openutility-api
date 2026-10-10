const { cors, requireAuth, getSession, clearSession, dbGet } = require("./_lib");

module.exports = async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const route = String((req.query && req.query.route) || "health").toLowerCase();

  if (route === "health") {
    try {
      if (process.env.VERCEL || process.env.NODE_ENV === "production") await dbGet("openutility:health:probe");
      return res.status(200).json({ status: "ok", storage: "reachable", name: "OpenUtility Bot API", time: new Date().toISOString() });
    } catch (error) {
      console.error("API health check failed:", error.message);
      return res.status(503).json({ status: "degraded", storage: "unavailable", name: "OpenUtility Bot API", time: new Date().toISOString() });
    }
  }

  if (route === "me") {
    const s = requireAuth(req, res);
    if (!s) return;
    return res.json({ user: s.user });
  }

  if (route === "csrf") {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    const s = getSession(req);
    if (!s) return res.status(401).json({ error: "Not authenticated" });
    return res.json({ token: s.csrfToken });
  }

  if (route === "logout") {
    if (req.method !== "POST" && req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }
    clearSession(req, res);
    return res.json({ ok: true });
  }

  return res.status(404).json({ error: "Not found" });
};
