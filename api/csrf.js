const { cors, requireAuth } = require("../lib/_lib");

module.exports = (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = requireAuth(req, res);
  if (!session) return;

  return res.status(200).json({ token: session.csrfToken });
};
