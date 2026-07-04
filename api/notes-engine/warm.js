module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    ok: true,
    service: "learnsphere-notes-engine-standalone",
    route: "/api/notes-engine/warm",
    method: req.method,
    ready: true,
    timestamp: new Date().toISOString()
  });
};
