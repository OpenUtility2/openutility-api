const { cors, requireAuth, requireGuildAccess, validGuildId, getSession, clearSession, dbGet, configKey } = require("../lib/_lib");

const syncStatusKey = id => `guild:${id}:bot-sync-status`;
const STALE_AFTER_MS = 180_000;

module.exports = async (req, res) => {
  cors(res, req);
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

  if (route === "diagnostics") {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    const session = requireAuth(req, res);
    if (!session) return;
    const id = String((req.query && req.query.guildId) || "");
    if (!validGuildId(id)) return res.status(400).json({ error: "Invalid guild ID." });
    try {
      await requireGuildAccess(session, id);
    } catch (error) {
      return res.status(error.status || 502).json({ error: error.status === 403 ? error.message : "Unable to verify server permissions." });
    }
    try {
      const [config, botSync] = await Promise.all([dbGet(configKey(id)), dbGet(syncStatusKey(id))]);
      const configUpdatedAt = typeof config?.updatedAt === "string" ? config.updatedAt : null;
      const checkedAt = typeof botSync?.checkedAt === "string" ? botSync.checkedAt : null;
      const ageMs = checkedAt ? Math.max(0, Date.now() - Date.parse(checkedAt)) : null;
      const currentVersion = !!(configUpdatedAt && botSync?.configUpdatedAt === configUpdatedAt);
      let status = "not_seen";
      let message = "No successful bot apply acknowledgement has been recorded for this server yet.";
      if (checkedAt && Number.isFinite(ageMs)) {
        if (ageMs > STALE_AFTER_MS) {
          status = "stale";
          message = "The last bot acknowledgement is older than three minutes. Check that the bot is online and API polling is enabled.";
        } else if (currentVersion) {
          status = "applied";
          message = "The bot recently acknowledged the currently saved configuration version.";
        } else {
          status = "pending";
          message = "The bot has checked in, but it has not acknowledged the current saved configuration version yet.";
        }
      }
      return res.json({
        ok: true,
        guildId: id,
        storage: { status: "reachable", persistent: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) },
        config: { updatedAt: configUpdatedAt },
        bot: { status, lastSeenAt: checkedAt, ageSeconds: ageMs === null ? null : Math.floor(ageMs / 1000), configUpdatedAt: botSync?.configUpdatedAt || null, version: botSync?.botVersion || null },
        message
      });
    } catch (error) {
      console.error("Guild diagnostics failed:", error);
      return res.status(503).json({ error: "Diagnostics could not read persistent storage. Check Upstash Redis configuration and connectivity." });
    }
  }

  if (route === "me") {
    const session = requireAuth(req, res);
    if (!session) return;
    return res.json({ user: session.user });
  }

  if (route === "csrf") {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: "Not authenticated" });
    return res.json({ token: session.csrfToken });
  }

  if (route === "logout") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const session = requireAuth(req, res);
    if (!session) return;
    clearSession(req, res);
    return res.json({ ok: true });
  }

  return res.status(404).json({ error: "Not found" });
};
