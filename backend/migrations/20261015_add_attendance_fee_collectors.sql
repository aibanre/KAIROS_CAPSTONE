-- Run against the database named in DB_NAME: mysql -u root -p <DB_NAME> < file.sql
-- Apply manually after the existing attendance-fee migration.
-- Idempotent for databases where one or both columns were already added.

DROP PROCEDURE IF EXISTS add_attendance_fee_audit_columns;
DELIMITER //
CREATE PROCEDURE add_attendance_fee_audit_columns()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Reservations'
      AND COLUMN_NAME = 'early_checkin_fees_collected_at'
  ) THEN
    ALTER TABLE Reservations ADD COLUMN early_checkin_fees_collected_at DATETIME NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Reservations'
      AND COLUMN_NAME = 'late_checkout_fees_collected_at'
  ) THEN
    ALTER TABLE Reservations ADD COLUMN late_checkout_fees_collected_at DATETIME NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Reservations'
      AND COLUMN_NAME = 'early_checkin_collected_by'
  ) THEN
    ALTER TABLE Reservations ADD COLUMN early_checkin_collected_by INT NULL,
      ADD CONSTRAINT fk_res_early_fee_collector FOREIGN KEY (early_checkin_collected_by) REFERENCES Users(user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Reservations'
      AND COLUMN_NAME = 'late_checkout_collected_by'
  ) THEN
    ALTER TABLE Reservations ADD COLUMN late_checkout_collected_by INT NULL,
      ADD CONSTRAINT fk_res_late_fee_collector FOREIGN KEY (late_checkout_collected_by) REFERENCES Users(user_id);
  END IF;
END//
DELIMITER ;
CALL add_attendance_fee_audit_columns();
DROP PROCEDURE add_attendance_fee_audit_columns;
