SET @has_email_verified_at = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Customer' AND COLUMN_NAME = 'email_verified_at'
);
SET @add_email_verified_at = IF(
    @has_email_verified_at = 0,
    'ALTER TABLE Customer ADD COLUMN email_verified_at TIMESTAMP NULL DEFAULT NULL',
    'SELECT 1'
);
PREPARE add_email_verified_at_stmt FROM @add_email_verified_at;
EXECUTE add_email_verified_at_stmt;
DEALLOCATE PREPARE add_email_verified_at_stmt;

CREATE TABLE IF NOT EXISTS Auth_Verification_Codes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    purpose ENUM('register', 'login') NOT NULL,
    customer_id INT NULL,
    email VARCHAR(100) NOT NULL,
    code_hash CHAR(64) NOT NULL,
    challenge_hash CHAR(64) NULL,
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    max_attempts TINYINT UNSIGNED NOT NULL DEFAULT 5,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_sent_at DATETIME NOT NULL,
    CONSTRAINT fk_auth_verification_customer FOREIGN KEY (customer_id) REFERENCES Customer(customer_id) ON DELETE CASCADE,
    INDEX idx_auth_verification_lookup (email, purpose, consumed_at),
    INDEX idx_auth_verification_expiry (expires_at),
    UNIQUE KEY uq_auth_verification_challenge (challenge_hash)
);

UPDATE Customer
SET email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP)
WHERE is_registered = TRUE;
