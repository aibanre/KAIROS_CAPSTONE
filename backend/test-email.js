require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  requireTLS: true,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

(async () => {
  try {
    await transporter.verify();
    console.log('SMTP connection OK');
    const info = await transporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_EMAIL}>`,
      to: 'your-personal-email@gmail.com',
      subject: 'KAIROS test email',
      text: 'If you got this, Brevo SMTP works.',
    });
    console.log('Sent:', info.messageId);
  } catch (err) {
    console.error('Failed:', err.message);
  }
})();