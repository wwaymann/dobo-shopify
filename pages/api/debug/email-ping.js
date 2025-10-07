// pages/api/debug/email-ping.js
export default async function handler(req, res) {
  const u = !!process.env.GMAIL_USER;
  const p = !!process.env.GMAIL_APP_PASSWORD;
  const d = !!process.env.MERCHANT_NOTIF_EMAIL;
  res.status(200).json({ GMAIL_USER: u, GMAIL_APP_PASSWORD: p, MERCHANT_NOTIF_EMAIL: d });
}
