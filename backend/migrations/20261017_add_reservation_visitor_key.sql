-- Run manually against the database named in DB_NAME.
-- Apply before deploying application code that enforces visitor reservation caps.

ALTER TABLE Reservations
  ADD COLUMN visitor_key CHAR(64) NULL AFTER customer_id,
  ADD KEY idx_reservations_visitor_status (visitor_key, status, hold_expires_at);
