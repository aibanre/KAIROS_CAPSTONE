require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../config/db');

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_NAME?.trim();

  if (!email || !password || !fullName) {
    throw new Error('Set ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_NAME before running this script.');
  }

  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters long.');
  }

  const [existingUsers] = await pool.query(
    'SELECT user_id FROM Users WHERE email = ? LIMIT 1',
    [email]
  );

  if (existingUsers.length > 0) {
    throw new Error(`An account already exists for ${email}.`);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO Users (username, password_hash, email, full_name, role)
     VALUES (?, ?, ?, ?, 'admin')`,
    [email, passwordHash, email, fullName]
  );

  await pool.query(
    `INSERT IGNORE INTO Inventory_Items (item_name, description, default_charge_cents, is_active)
     VALUES
       ('Key', 'Room key', 50000, 1),
       ('Insert Key', 'Insert key', 50000, 1),
       ('Bath Towel', 'Bath towel', 50000, 1),
       ('Blanket', 'Blanket', 60000, 1),
       ('Bedsheet', 'Bedsheet', 50000, 1),
       ('Pillow', 'Pillow', 50000, 1),
       ('Remote', 'Room remote', 100000, 1),
       ('Flower', 'Room flower', 50000, 1),
       ('Trash Bin', 'Trash bin', 50000, 1)`
  );

  console.log(`Admin account created for ${email}.`);
}

createAdmin()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());