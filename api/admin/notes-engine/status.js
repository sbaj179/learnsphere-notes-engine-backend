module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  return res.status(200).json({
    ok: true,
    service: "learnsphere-notes-engine-backend",
    route: "/api/admin/notes-engine/status",
    ready: true,
    environment: {
      notesEngineTokenConfigured: Boolean(process.env.NOTES_ENGINE_SERVICE_TOKEN),
      providerOrderConfigured: Boolean(process.env.LEARNSPHERE_AI_PROVIDER_ORDER),
      supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
    },
    timestamp: new Date().toISOString()
  });
};
