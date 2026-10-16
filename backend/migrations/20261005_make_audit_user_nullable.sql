-- Run against the database named in DB_NAME: mysql -u root -p <DB_NAME> < file.sql
-- Audit log system and customer events may not have a staff user.
-- Apply manually; this migration is intentionally not run by the application.
ALTER TABLE Audit_logs
  MODIFY COLUMN user_id INT NULL;
