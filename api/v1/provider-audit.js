const {
  noStore,
  methodNotAllowed,
  requireServiceToken,
  providerAudit
} = require("../_lib/engine");

module.exports = function handler(req, res) {
  noStore(res);

  if (req.method !== "GET") return methodNotAllowed(res, "GET");
  if (!requireServiceToken(req, res)) return;

  return res.status(200).json({
    ok: true,
    connectivity: String(req.query?.connectivity || "false") === "true",
    providers: providerAudit(),
    timestamp: new Date().toISOString()
  });
};
