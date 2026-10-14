const { escapeHtml, renderEmail } = require('./templateUtils');

function verificationCode({ code, purpose }) {
  const isLogin = purpose === 'login';
  const action = isLogin ? 'sign in' : 'complete your registration';
  const subject = isLogin ? 'Your Kai Azul sign-in code' : 'Verify your Kai Azul email';
  const safeCode = escapeHtml(code);
  const body = `
    <p>Use this code to ${action} at Kai Azul Beach Resort:</p>
    <p style="margin:24px 0;text-align:center;font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:bold;letter-spacing:8px;color:#0b6174;">${safeCode}</p>
    <p>This code expires in 10 minutes. If you did not request this, ignore this email.</p>`;
  return {
    to: null,
    subject,
    html: renderEmail(isLogin ? 'Sign-in verification' : 'Email verification', body),
    text: `Your Kai Azul verification code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`,
  };
}

module.exports = verificationCode;
