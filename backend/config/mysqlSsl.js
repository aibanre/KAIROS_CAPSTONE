function getMysqlSslOptions(env = process.env) {
  if (String(env.DB_SSL || '').toLowerCase() !== 'true') return undefined;
  const ca = String(env.DB_SSL_CA || '').replace(/\\n/g, '\n').trim();
  if (!ca) throw new Error('DB_SSL_CA must contain the Aiven CA certificate when DB_SSL=true.');
  return { rejectUnauthorized: true, ca };
}

module.exports = { getMysqlSslOptions };
