const nodemailer = require('nodemailer');
const logger = require('./logger');

const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, '')
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error(`Email error: ${error.message}`);
    throw error;
  }
};

// Email templates
const emailTemplates = {
  emailVerification: (name, url) => ({
    subject: 'Verify Your Email - Quiz Management',
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#6366f1">Email Verification</h2>
      <p>Hello ${name},</p>
      <p>Please click the button below to verify your email address:</p>
      <a href="${url}" style="background:#6366f1;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">Verify Email</a>
      <p>This link expires in 24 hours.</p>
    </div>`
  }),
  passwordReset: (name, url) => ({
    subject: 'Password Reset - Quiz Management',
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#6366f1">Password Reset</h2>
      <p>Hello ${name},</p>
      <p>You requested a password reset. Click the button below:</p>
      <a href="${url}" style="background:#6366f1;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">Reset Password</a>
      <p>This link expires in 10 minutes. Ignore if you didn't request this.</p>
    </div>`
  }),
  quizAssigned: (name, quizTitle) => ({
    subject: `New Quiz Assigned: ${quizTitle}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#6366f1">New Quiz Assigned</h2>
      <p>Hello ${name},</p>
      <p>A new quiz has been assigned to you: <strong>${quizTitle}</strong></p>
      <p>Login to your dashboard to take the quiz.</p>
    </div>`
  })
};

module.exports = { sendEmail, emailTemplates };
