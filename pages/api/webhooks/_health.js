// pages/api/webhooks/_health.js
export default function handler(req, res) {
  res.status(200).json({ ok: true, path: "/api/webhooks/_health", ts: Date.now() });
}
