const fs = require('fs');

function getMysqlSslOptions(env = process.env) {
  if (String(env.DB_SSL || '').toLowerCase() !== 'true') return undefined;
  const configuredCa = String(env.DB_SSL_CA || '').replace(/\\n/g, '\n').trim();
  if (!configuredCa) throw new Error('DB_SSL_CA must contain the Aiven CA certificate or its file path when DB_SSL=true.');
  const ca = configuredCa.includes('-----BEGIN CERTIFICATE-----')
    ? configuredCa
    : fs.readFileSync(configuredCa, 'utf8').trim();
  if (!ca.includes('-----BEGIN CERTIFICATE-----') || !ca.includes('-----END CERTIFICATE-----')) {
    throw new Error('DB_SSL_CA must be a PEM certificate or a path to a PEM certificate file.');
  }
  return { rejectUnauthorized: true, ca };
}

module.exports = { getMysqlSslOptions };
