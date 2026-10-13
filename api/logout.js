const { cors, requireAuth, clearSession } = require("../lib/_lib");

module.exports = (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = requireAuth(req, res);
  if (!session) return;

  clearSession(req, res);
  return res.status(200).json({ ok: true });
};
