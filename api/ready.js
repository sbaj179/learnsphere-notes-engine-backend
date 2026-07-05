module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const providerOrder = String(
    process.env.LEARNSPHERE_AI_PROVIDER_ORDER ||
      "sambanova,nvidia_nim,scaleway,cohere,cloudflare_workers_ai"
  )
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const configuredProviders = providerOrder.filter((provider) => {
    if (provider === "sambanova") return Boolean(process.env.SAMBANOVA_API_KEY || process.env.LEARNSPHERE_AI_SAMBANOVA_API_KEY);
    if (provider === "nvidia_nim") return Boolean(process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY || process.env.LEARNSPHERE_AI_NVIDIA_NIM_API_KEY);
    if (provider === "scaleway") return Boolean(process.env.SCALEWAY_API_KEY || process.env.SCW_SECRET_KEY || process.env.LEARNSPHERE_AI_SCALEWAY_API_KEY);
    if (provider === "cohere") return Boolean(process.env.COHERE_API_KEY || process.env.LEARNSPHERE_AI_COHERE_API_KEY);
    if (provider === "cloudflare_workers_ai") {
      return Boolean((process.env.CLOUDFLARE_ACCOUNT_ID || process.env.LEARNSPHERE_AI_CLOUDFLARE_ACCOUNT_ID) && (process.env.CLOUDFLARE_API_TOKEN || process.env.LEARNSPHERE_AI_CLOUDFLARE_API_TOKEN));
    }
    return false;
  });

  return res.status(200).json({
    ok: true,
    service: "learnsphere-notes-engine-backend",
    route: "/api/ready",
    ready: Boolean(process.env.NOTES_ENGINE_SERVICE_TOKEN && configuredProviders.length),
    environment: {
      notesEngineTokenConfigured: Boolean(process.env.NOTES_ENGINE_SERVICE_TOKEN),
      providerOrderConfigured: Boolean(process.env.LEARNSPHERE_AI_PROVIDER_ORDER),
      configuredProviders
    },
    timestamp: new Date().toISOString()
  });
};
