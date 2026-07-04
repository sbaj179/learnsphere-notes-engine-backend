module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  return res.status(200).json({
    ok: true,
    service: "learnsphere-notes-engine-backend",
    route: "/api/notes-engine/warm",
    method: req.method,
    ready: true,
    timestamp: new Date().toISOString()
  });
};
