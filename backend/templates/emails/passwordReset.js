const { escapeHtml, renderEmail } = require('./templateUtils');

function passwordReset({ link }) {
  const safeLink = escapeHtml(link);
  const body = `
    <p>We received a request to reset your Kai Azul account password.</p>
    <p style="margin:24px 0;"><a href="${safeLink}" style="display:inline-block;padding:12px 20px;background:#0b6174;color:#ffffff;text-decoration:none;border-radius:6px;">Reset your password</a></p>
    <p>This link expires in 60 minutes. If you did not request this, you can safely ignore this email.</p>
    <p style="font-size:13px;color:#52606d;">If the button does not work, copy and paste this link into your browser:<br>${safeLink}</p>`;
  return {
    to: null,
    subject: 'Reset your Kai Azul password',
    html: renderEmail('Password reset', body),
    text: `Reset your Kai Azul password: ${link}\n\nThis link expires in 60 minutes. If you did not request this, you can safely ignore this email.`,
  };
}

function passwordChanged({ name }) {
  const body = `<p>Hello ${escapeHtml(name || 'there')},</p><p>Your Kai Azul account password was changed successfully. If you did not make this change, please contact the resort.</p>`;
  return {
    to: null,
    subject: 'Your Kai Azul password was changed',
    html: renderEmail('Password changed', body),
    text: 'Your Kai Azul account password was changed successfully. If you did not make this change, please contact the resort.',
  };
}

module.exports = { passwordReset, passwordChanged };
