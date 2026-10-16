-- Run against the database named in DB_NAME: mysql -u root -p <DB_NAME> < file.sql

CREATE TABLE IF NOT EXISTS Login_Attempts (
    email_hash CHAR(64) PRIMARY KEY,
    account_user_id INT NULL,
    failed_attempts INT UNSIGNED NOT NULL DEFAULT 0,
    cooldown_level TINYINT UNSIGNED NOT NULL DEFAULT 0,
    locked_until DATETIME(6) NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_login_attempt_user FOREIGN KEY (account_user_id) REFERENCES Users(user_id) ON DELETE SET NULL,
    KEY idx_login_attempt_updated_at (updated_at)
);
