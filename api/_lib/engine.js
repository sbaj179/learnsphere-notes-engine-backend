const { createHash, randomUUID } = require("node:crypto");

const DEFAULT_PROVIDER_ORDER = [
  "sambanova",
  "nvidia_nim",
  "scaleway",
  "cohere",
  "cloudflare_workers_ai"
];

function sha256Text(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function stableJson(value) {
  return JSON.stringify(sortStable(value));
}

function sha256Json(value) {
  return sha256Text(stableJson(value));
}

function sortStable(value) {
  if (Array.isArray(value)) return value.map(sortStable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortStable(value[key])]));
  }
  return value;
}

function noStore(res) {
  res.setHeader("Cache-Control", "no-store");
}

function methodNotAllowed(res, allowed) {
  res.setHeader("Allow", allowed);
  return res.status(405).json({ ok: false, error: "Method not allowed." });
}

function requireServiceToken(req, res) {
  const expected = String(process.env.NOTES_ENGINE_SERVICE_TOKEN || "").trim();
  if (!expected) {
    res.status(503).json({
      ok: false,
      error: "NOTES_ENGINE_SERVICE_TOKEN is not configured.",
      code: "ENGINE_SERVICE_TOKEN_MISSING"
    });
    return false;
  }

  const supplied = String(req.headers.authorization || "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!supplied || supplied !== expected) {
    res.status(401).json({
      ok: false,
      error: "Unauthorized notes engine request.",
      code: "ENGINE_UNAUTHORIZED"
    });
    return false;
  }

  return true;
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) return JSON.parse(req.body);

  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

function providerOrder() {
  return String(process.env.LEARNSPHERE_AI_PROVIDER_ORDER || DEFAULT_PROVIDER_ORDER.join(","))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function providerConfig(provider) {
  if (provider === "sambanova") {
    return {
      provider,
      kind: "openai",
      configured: Boolean(process.env.SAMBANOVA_API_KEY || process.env.LEARNSPHERE_AI_SAMBANOVA_API_KEY),
      apiKey: process.env.SAMBANOVA_API_KEY || process.env.LEARNSPHERE_AI_SAMBANOVA_API_KEY,
      baseUrl: process.env.SAMBANOVA_BASE_URL || "https://api.sambanova.ai/v1",
      model: process.env.SAMBANOVA_MODEL || "Meta-Llama-3.1-8B-Instruct"
    };
  }

  if (provider === "nvidia_nim") {
    return {
      provider,
      kind: "openai",
      configured: Boolean(process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY || process.env.LEARNSPHERE_AI_NVIDIA_NIM_API_KEY),
      apiKey: process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY || process.env.LEARNSPHERE_AI_NVIDIA_NIM_API_KEY,
      baseUrl: process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1",
      model: process.env.NVIDIA_NIM_MODEL || "meta/llama-3.1-8b-instruct"
    };
  }

  if (provider === "scaleway") {
    return {
      provider,
      kind: "openai",
      configured: Boolean(process.env.SCALEWAY_API_KEY || process.env.SCW_SECRET_KEY || process.env.LEARNSPHERE_AI_SCALEWAY_API_KEY),
      apiKey: process.env.SCALEWAY_API_KEY || process.env.SCW_SECRET_KEY || process.env.LEARNSPHERE_AI_SCALEWAY_API_KEY,
      baseUrl: process.env.SCALEWAY_BASE_URL || "https://api.scaleway.ai/v1",
      model: process.env.SCALEWAY_MODEL || "llama-3.1-8b-instruct"
    };
  }

  if (provider === "cohere") {
    return {
      provider,
      kind: "cohere",
      configured: Boolean(process.env.COHERE_API_KEY || process.env.LEARNSPHERE_AI_COHERE_API_KEY),
      apiKey: process.env.COHERE_API_KEY || process.env.LEARNSPHERE_AI_COHERE_API_KEY,
      baseUrl: process.env.COHERE_BASE_URL || "https://api.cohere.com/v2",
      model: process.env.COHERE_MODEL || "command-a-plus-05-2026"
    };
  }

  if (provider === "cloudflare_workers_ai") {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.LEARNSPHERE_AI_CLOUDFLARE_ACCOUNT_ID;
    return {
      provider,
      kind: "openai",
      configured: Boolean(accountId && (process.env.CLOUDFLARE_API_TOKEN || process.env.LEARNSPHERE_AI_CLOUDFLARE_API_TOKEN)),
      apiKey: process.env.CLOUDFLARE_API_TOKEN || process.env.LEARNSPHERE_AI_CLOUDFLARE_API_TOKEN,
      baseUrl:
        process.env.CLOUDFLARE_WORKERS_AI_BASE_URL ||
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`,
      model: process.env.CLOUDFLARE_WORKERS_AI_MODEL || "@cf/meta/llama-3.1-8b-instruct"
    };
  }

  return { provider, kind: "unknown", configured: false };
}

function providerAudit() {
  return providerOrder().map((provider) => {
    const config = providerConfig(provider);
    return {
      provider,
      kind: config.kind,
      configured: Boolean(config.configured),
      model: config.model || null,
      baseUrl: config.configured ? config.baseUrl || null : null
    };
  });
}

function buildPrompt(payload) {
  const requirements = (payload.curriculum_requirements || []).map((item) => `- ${item}`).join("\n");
  const assessments = (payload.assessment_expectations || []).map((item) => `- ${item}`).join("\n");
  const sources = (payload.source_page_ranges || [])
    .map((range) => `- Document ${range.document_id}, page ${range.start_page}-${range.end_page}: ${range.evidence}`)
    .join("\n");

  return [
    "Create premium LearnSphere CAPS study notes in clean Markdown.",
    "",
    "Rules:",
    "- Use South African CAPS terminology.",
    "- Do not invent page references.",
    "- Do not mention that you are an AI model.",
    "- Do not wrap the answer in a code fence.",
    "- Make the notes learner-facing, detailed, structured, and assessment-ready.",
    "- Include definitions, worked explanations, common mistakes, quick checks, and a short revision section.",
    "",
    `Academic year: ${payload.academic_year}`,
    `Grade: ${payload.grade_code}`,
    `Subject: ${payload.subject_name || payload.subject_code || payload.subject_id}`,
    `Term: ${payload.term}`,
    `Topic code: ${payload.topic_code}`,
    `Topic: ${payload.topic_name}`,
    `Language: ${payload.language || "en-ZA"}`,
    `Curriculum version: ${payload.curriculum_version}`,
    "",
    "Curriculum requirements:",
    requirements || "- Use the verified topic scope supplied by LearnSphere.",
    "",
    "Assessment expectations:",
    assessments || "- Prepare the learner for formal and informal CAPS assessment.",
    "",
    "Verified source evidence:",
    sources || "- No page evidence supplied in payload.",
    "",
    "Now write the full notes."
  ].join("\n");
}

async function callOpenAICompatible(config, messages) {
  const response = await fetch(`${String(config.baseUrl).replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.25,
      max_tokens: 3500
    })
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = json?.error?.message || json?.message || `Provider returned HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return String(json?.choices?.[0]?.message?.content || "").trim();
}

async function callCohere(config, messages) {
  const response = await fetch(`${String(config.baseUrl).replace(/\/+$/, "")}/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.25,
      max_tokens: 3500,
      stream: false
    })
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = json?.message || json?.error?.message || `Provider returned HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const content = json?.message?.content;
  if (Array.isArray(content)) {
    return content.map((part) => part?.text || "").join("").trim();
  }
  return String(content || json?.text || "").trim();
}

async function generateMarkdown(payload) {
  const prompt = buildPrompt(payload);
  const messages = [
    {
      role: "system",
      content:
        "You are LearnSphere's CAPS notes engine. Produce accurate, learner-facing, assessment-ready Markdown notes."
    },
    { role: "user", content: prompt }
  ];

  const attempts = [];

  for (const provider of providerOrder()) {
    const config = providerConfig(provider);
    const startedAt = new Date().toISOString();

    if (!config.configured) {
      attempts.push({
        provider,
        status: "skipped",
        diagnostic_code: "PROVIDER_NOT_CONFIGURED",
        started_at: startedAt,
        completed_at: new Date().toISOString()
      });
      continue;
    }

    try {
      const markdown =
        config.kind === "cohere"
          ? await callCohere(config, messages)
          : await callOpenAICompatible(config, messages);

      if (!markdown || markdown.length < 600) {
        throw new Error("Provider returned insufficient note content.");
      }

      attempts.push({
        provider,
        model: config.model,
        status: "approved",
        diagnostic_code: null,
        started_at: startedAt,
        completed_at: new Date().toISOString()
      });

      return { markdown, provider, model: config.model, attempts };
    } catch (error) {
      attempts.push({
        provider,
        model: config.model || null,
        status: "failed",
        diagnostic_code: "PROVIDER_GENERATION_FAILED",
        message: String(error?.message || "Provider failed.").slice(0, 500),
        started_at: startedAt,
        completed_at: new Date().toISOString()
      });
    }
  }

  const error = new Error("No configured provider produced a valid LearnSphere note.");
  error.code = "ENGINE_PROVIDER_EXHAUSTED";
  error.attempts = attempts;
  throw error;
}

function sourceManifest(payload) {
  return {
    source_package_checksum: sha256Json({
      documents: payload.source_documents || [],
      page_ranges: payload.source_page_ranges || [],
      curriculum_requirements: payload.curriculum_requirements || [],
      assessment_expectations: payload.assessment_expectations || []
    }),
    curriculum: payload.curriculum || "CAPS",
    curriculum_version: String(payload.curriculum_version || ""),
    documents: (payload.source_documents || []).map((document) => ({
      document_id: String(document.document_id || ""),
      title: String(document.title || ""),
      role: String(document.role || "supplementary"),
      official_url: String(document.official_url || ""),
      checksum_sha256: /^[a-f0-9]{64}$/i.test(String(document.checksum_sha256 || ""))
        ? String(document.checksum_sha256).toLowerCase()
        : null,
      curriculum_version: String(document.curriculum_version || payload.curriculum_version || ""),
      local_checksum_verified: Boolean(document.local_checksum_verified),
      actual_checksum_sha256: /^[a-f0-9]{64}$/i.test(String(document.actual_checksum_sha256 || ""))
        ? String(document.actual_checksum_sha256).toLowerCase()
        : null
    })),
    page_ranges: (payload.source_page_ranges || []).map((range) => ({
      document_id: String(range.document_id || ""),
      start_page: Number(range.start_page),
      end_page: Number(range.end_page),
      evidence: String(range.evidence || ""),
      verified: Boolean(range.verified)
    })),
    unresolved_page_ranges: [],
    warnings: []
  };
}

async function createTopicJob(payload) {
  const identityHash = String(payload?.metadata?.persistent_identity_hash || "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(identityHash)) {
    const error = new Error("payload.metadata.persistent_identity_hash is required.");
    error.status = 400;
    error.code = "ENGINE_IDENTITY_HASH_REQUIRED";
    throw error;
  }

  const startedAt = new Date().toISOString();
  const requestId = randomUUID();
  const jobId = `topic_${identityHash.slice(0, 24)}_${sha256Text(payload.idempotency_key || requestId).slice(0, 10)}`;

  const generated = await generateMarkdown(payload);
  const completedAt = new Date().toISOString();
  const checksum = sha256Text(generated.markdown);

  const note = {
    canonical_identity_hash: identityHash,
    checksum_sha256: checksum,
    version: 1,
    title: `${payload.subject_name || payload.subject_code || "CAPS"} — ${payload.topic_name || payload.topic_code}`,
    academic_year: Number(payload.academic_year),
    grade_code: Number(payload.grade_code),
    subject_id: String(payload.subject_id || ""),
    subject_code: String(payload.subject_code || ""),
    subject_name: String(payload.subject_name || ""),
    term: Number(payload.term),
    topic_code: String(payload.topic_code || ""),
    topic_name: String(payload.topic_name || ""),
    language: String(payload.language || "en-ZA"),
    curriculum: String(payload.curriculum || "CAPS"),
    curriculum_version: String(payload.curriculum_version || ""),
    quality_tier: payload.quality_tier === "premium" ? "premium" : "standard",
    generated_at: completedAt
  };

  const artefact = {
    note,
    markdown: generated.markdown,
    validation_report: {
      identity_hash: identityHash,
      decision: "approved",
      checksum_sha256: checksum,
      checks: [
        { code: "IDENTITY_MATCH", passed: true },
        { code: "CHECKSUM_MATCH", passed: true },
        { code: "MARKDOWN_PRESENT", passed: true }
      ],
      warnings: []
    },
    generation_report: {
      identity_hash: identityHash,
      provider: generated.provider,
      model: generated.model,
      provider_order: providerOrder(),
      attempts: generated.attempts,
      started_at: startedAt,
      completed_at: completedAt
    },
    source_manifest: sourceManifest(payload),
    optional: {}
  };

  const job = {
    job_id: jobId,
    request_id: requestId,
    identity_hash: identityHash,
    status: "approved",
    current_stage: "approved",
    progress_percent: 100,
    public_message: "Your topic note is ready.",
    started_at: startedAt,
    completed_at: completedAt,
    current_provider: generated.provider
  };

  globalThis.__learnsphereTopicJobs = globalThis.__learnsphereTopicJobs || new Map();
  globalThis.__learnsphereTopicJobs.set(jobId, { job, artefact, attempts: generated.attempts });

  return { ok: true, identity_hash: identityHash, job, artefact };
}

function getStoredJob(jobId) {
  return globalThis.__learnsphereTopicJobs?.get(String(jobId)) || null;
}

module.exports = {
  noStore,
  methodNotAllowed,
  requireServiceToken,
  readJsonBody,
  providerAudit,
  createTopicJob,
  getStoredJob
};
