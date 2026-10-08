-- Apply manually after reviewing. This migration is intentionally not run by the application.
ALTER TABLE Reservations
  ADD COLUMN actual_check_in DATETIME NULL,
  ADD COLUMN actual_check_out DATETIME NULL,
  ADD COLUMN early_checkin_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN late_checkout_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN fees_collected_at DATETIME NULL;