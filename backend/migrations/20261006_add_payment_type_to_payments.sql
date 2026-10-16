-- Run against the database named in DB_NAME: mysql -u root -p <DB_NAME> < file.sql
-- Apply manually after reviewing. Do not run automatically.
-- Target: MySQL 8.0.16 or later. CHECK constraints in the add-ons migration
-- require MySQL 8.0.16+ for enforcement.

ALTER TABLE Payments
  ADD COLUMN payment_type ENUM('deposit', 'balance', 'full')
  NOT NULL DEFAULT 'full'
  AFTER amount;

CREATE INDEX idx_payments_reservation_status
  ON Payments (reservation_id, payment_status);
