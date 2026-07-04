module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  return res.status(200).json({
    ok: true,
    service: "learnsphere-notes-engine-backend",
    route: "/api/health",
    ready: true,
    timestamp: new Date().toISOString()
  });
};
