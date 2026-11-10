const nodemailer = require('nodemailer');

let transport;

function getTransport() {
  if (transport) return transport;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
  return transport;
}

async function sendVerificationCode({ email, code, purpose }) {
  const mailer = getTransport();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const reset = purpose === 'password_reset';
  const subject = reset ? 'Reset your ApexStore password' : 'Verify your ApexStore email';
  const action = reset ? 'reset your password' : 'verify your email address';
  const text = `Use this code to ${action}: ${code}\n\nThis code expires in 10 minutes. If you did not request it, you can ignore this message.`;

  if (!mailer) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[development email] ${purpose} code for ${email}: ${code}`);
      return;
    }
    throw new Error('Email delivery is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM.');
  }

  await mailer.sendMail({ from, to: email, subject, text });
}

module.exports = { sendVerificationCode };
