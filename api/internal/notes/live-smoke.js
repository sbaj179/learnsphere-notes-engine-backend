function readBearer(req) {
  const raw = String(req.headers.authorization || "");
  return raw.replace(/^Bearer\s+/i, "").trim();
}

module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const required = process.env.NOTES_ENGINE_SERVICE_TOKEN;

  if (required && readBearer(req) !== required) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized notes-engine smoke request."
    });
  }

  return res.status(200).json({
    ok: true,
    service: "learnsphere-notes-engine-backend",
    route: "/api/internal/notes/live-smoke",
    mode: "backend-contract-smoke",
    mutation: false,
    paidGeneration: false,
    timestamp: new Date().toISOString()
  });
};
