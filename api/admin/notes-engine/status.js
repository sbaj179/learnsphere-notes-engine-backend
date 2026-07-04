module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  res.status(200).json({
    ok: true,
    service: "learnsphere-notes-engine-standalone",
    route: "/api/admin/notes-engine/status",
    ready: true,
    environment: {
      serviceTokenConfigured: Boolean(process.env.NOTES_ENGINE_SERVICE_TOKEN),
      providerOrderConfigured: Boolean(process.env.LEARNSPHERE_AI_PROVIDER_ORDER),
      storageRootConfigured: Boolean(process.env.LEARNSPHERE_TOPIC_STORAGE_ROOT)
    },
    timestamp: new Date().toISOString()
  });
};
