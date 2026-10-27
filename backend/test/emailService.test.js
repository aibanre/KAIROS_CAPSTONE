const assert = require('node:assert/strict');
const test = require('node:test');
const { sendVerificationCode } = require('../services/emailService');

test('Brevo fallback omits attachment when sending a message without attachments', async (t) => {
  const envNames = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM_NAME', 'MAIL_FROM_EMAIL', 'BREVO_API_KEY'];
  const previousEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  t.after(() => {
    for (const name of envNames) {
      if (previousEnv[name] === undefined) delete process.env[name];
      else process.env[name] = previousEnv[name];
    }
  });

  process.env.SMTP_HOST = '';
  process.env.SMTP_PORT = '';
  process.env.SMTP_USER = '';
  process.env.SMTP_PASS = '';
  process.env.MAIL_FROM_NAME = 'Kai Azul';
  process.env.MAIL_FROM_EMAIL = 'noreply@example.com';
  process.env.BREVO_API_KEY = 'test-api-key';

  let payload;
  t.mock.method(global, 'fetch', async (_url, options) => {
    payload = JSON.parse(options.body);
    return { ok: true, status: 201 };
  });

  await sendVerificationCode({ to: 'guest@example.com', code: '123456', purpose: 'register' });

  assert.equal(Object.hasOwn(payload, 'attachment'), false);
  assert.equal(payload.to[0].email, 'guest@example.com');
});
