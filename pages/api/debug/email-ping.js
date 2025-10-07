// pages/api/debug/email-ping.js
export default function handler(req, res) {
  const user = !!process.env.GMAIL_USER;
  const pass = !!process.env.GMAIL_APP_PASSWORD;
  const dest = !!process.env.MERCHANT_NOTIF_EMAIL;
  res.status(200).json({ GMAIL_USER: user, GMAIL_APP_PASSWORD: pass, MERCHANT_NOTIF_EMAIL: dest });
}
