require('dotenv').config();
const pool = require('../config/db');

function configured(value, placeholders = []) {
  return Boolean(value && !placeholders.includes(value.trim()));
}

function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${detail}`);
}

async function checkPilotReadiness() {
  const origins = String(process.env.ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean);
  const adminUrl = String(process.env.ADMIN_APP_URL || '').trim();
  const jwt = String(process.env.JWT_SECRET || '');
  const secure = String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true';
  check('JWT secret', jwt.length >= 32 && jwt !== '12345678' && jwt !== 'change-me', 'long and non-default');
  check('Cookie/origin configuration', configured(process.env.COOKIE_SECURE) && configured(adminUrl) && origins.includes(adminUrl)
    && (!secure || origins.every((origin) => origin.startsWith('https://'))), 'COOKIE_SECURE, ADMIN_APP_URL, and ALLOWED_ORIGINS are consistent');
  check('SMTP', configured(process.env.SMTP_HOST) && configured(process.env.SMTP_USER, ['your-brevo-smtp-login'])
    && configured(process.env.SMTP_PASS, ['your-brevo-smtp-key']), 'host and credentials configured');
  check('Cloudinary', configured(process.env.CLOUDINARY_CLOUD_NAME) && configured(process.env.CLOUDINARY_API_KEY)
    && configured(process.env.CLOUDINARY_API_SECRET), 'cloud name and credentials configured');
  const defaultAdminPassword = ['12345678', 'password', 'admin123', 'change-me'];
  check('Default admin credentials', !defaultAdminPassword.includes(String(process.env.ADMIN_PASSWORD || '').trim().toLowerCase()),
    'no known default ADMIN_PASSWORD configured');

  const [[testRooms]] = await pool.query("SELECT COUNT(*) AS count FROM Rooms WHERE room_number LIKE 'TEST-%' OR room_type LIKE '%test%'");
  const [[defaultUsers]] = await pool.query(
    "SELECT COUNT(*) AS count FROM Users WHERE LOWER(username) IN ('admin','testadmin') OR LOWER(email) IN ('admin@example.com','admin@kaiazul.com')"
  );
  check('Seeded test/default staff data', Number(testRooms.count) === 0 && Number(defaultUsers.count) === 0, 'no test rooms or known default admin identities');

  const [[venueIssues]] = await pool.query(
    `SELECT COUNT(*) AS count FROM Venues v
     WHERE v.status='available' AND ((v.booking_mode='day_use' AND (v.flat_price IS NULL OR v.flat_price <= 0))
       OR (v.booking_mode='packaged' AND NOT EXISTS (
         SELECT 1 FROM Venue_Packages p WHERE p.venue_id=v.venue_id AND p.is_active=TRUE
           AND p.price > 0 AND p.inclusions IS NOT NULL AND JSON_LENGTH(p.inclusions) > 0
           AND LOWER(CAST(p.inclusions AS CHAR)) NOT LIKE '%placeholder%'
       )))`
  );
  const [[packageIssues]] = await pool.query(
    "SELECT COUNT(*) AS count FROM Venue_Packages WHERE is_active=TRUE AND (price <= 0 OR inclusions IS NULL OR JSON_LENGTH(inclusions)=0 OR LOWER(CAST(inclusions AS CHAR)) LIKE '%placeholder%')"
  );
  check('Active venue/package pricing', Number(venueIssues.count) === 0 && Number(packageIssues.count) === 0, 'prices and non-placeholder inclusions present');
  const [[paymentIssues]] = await pool.query("SELECT COUNT(*) AS count FROM PaymentMethods WHERE is_active=TRUE AND (qr_image_url IS NULL OR qr_image_url='')");
  check('Active payment method images', Number(paymentIssues.count) === 0, 'every active method has a QR image uploaded in admin UI');
  const [[settings]] = await pool.query('SELECT resort_name,address,contact_number,email FROM ResortSettings WHERE settings_id=1');
  const fallback = settings && settings.resort_name === 'Kai Azul Beach Resort' && settings.address === '123 Shoreline Drive, Beach City'
    && settings.contact_number === '+63 912 345 6789' && settings.email === 'info@kaiazul.com';
  check('Resort settings', Boolean(settings) && !fallback, 'not the schema fallback');
  await pool.end();
}

checkPilotReadiness().catch((error) => {
  console.error(`[checkPilotReadiness] Failed: ${error.message}`);
  process.exitCode = 1;
});
