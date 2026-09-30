const nodemailer = require('nodemailer');

let transporter;

const getSmtpPort = () => Number(process.env.SMTP_PORT || 587);

const isSmtpConfigured = () => Boolean(process.env.SMTP_HOST);

const getTransporter = () => {
  if (transporter) return transporter;

  const auth = process.env.SMTP_USER || process.env.SMTP_PASS
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    : undefined;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: getSmtpPort(),
    secure: process.env.SMTP_SECURE === 'true' || getSmtpPort() === 465,
    auth
  });

  return transporter;
};

const formatExpiry = (expiresAt) => {
  const timeZone = process.env.EMAIL_TIME_ZONE || 'Africa/Johannesburg';
  return new Intl.DateTimeFormat('en-ZA', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone
  }).format(expiresAt);
};

const sendVerificationEmail = async ({ email, otp, expiresAt }) => {
  const subject = 'Your Pulse Guard verification code';
  const expiryText = formatExpiry(expiresAt);
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || 'Pulse Guard <no-reply@pulseguard.local>';
  const text = [
    'Your Pulse Guard verification code is:',
    '',
    otp,
    '',
    `This code expires at ${expiryText}.`,
    'If you did not request this code, you can ignore this email.'
  ].join('\n');
  const html = [
    '<p>Your Pulse Guard verification code is:</p>',
    `<p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">${otp}</p>`,
    `<p>This code expires at ${expiryText}.</p>`,
    '<p>If you did not request this code, you can ignore this email.</p>'
  ].join('');

  if (!isSmtpConfigured()) {
    console.warn(`[email] SMTP_HOST is not configured. Verification OTP for ${email}: ${otp}`);
    return { skipped: true };
  }

  await getTransporter().sendMail({
    from,
    to: email,
    subject,
    text,
    html
  });

  return { skipped: false };
};

module.exports = {
  sendVerificationEmail
};
