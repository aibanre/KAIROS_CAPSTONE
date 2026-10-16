-- Run against the database named in DB_NAME: mysql -u root -p <DB_NAME> < file.sql

ALTER TABLE Reservations
  MODIFY COLUMN status ENUM(
    'payment_pending',
    'pending_verification',
    'confirmed',
    'checked_in',
    'completed',
    'cancelled',
    'rejected',
    'no_show'
  ) DEFAULT 'payment_pending';
