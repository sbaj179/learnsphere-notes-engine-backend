const {
  noStore,
  methodNotAllowed,
  requireServiceToken,
  readJsonBody,
  createTopicJob
} = require("../_lib/engine");

module.exports = async function handler(req, res) {
  noStore(res);

  if (req.method !== "POST") return methodNotAllowed(res, "POST");
  if (!requireServiceToken(req, res)) return;

  try {
    const payload = await readJsonBody(req);
    const result = await createTopicJob(payload);
    return res.status(200).json(result);
  } catch (error) {
    const status = Number(error?.status || 502);
    return res.status(status).json({
      ok: false,
      error: String(error?.message || "The notes engine failed."),
      code: String(error?.code || "ENGINE_TOPIC_JOB_FAILED"),
      attempts: Array.isArray(error?.attempts) ? error.attempts : undefined
    });
  }
};
