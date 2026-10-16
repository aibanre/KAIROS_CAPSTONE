-- Run against the database named in DB_NAME: mysql -u root -p <DB_NAME> < file.sql
CREATE TABLE IF NOT EXISTS Chatbot_Unanswered (
    unanswered_id INT AUTO_INCREMENT PRIMARY KEY,
    normalized_question VARCHAR(1000) NOT NULL,
    normalized_question_hash BINARY(32) NOT NULL,
    question_text VARCHAR(1000) NOT NULL,
    times_asked INT NOT NULL DEFAULT 1,
    first_asked TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_asked TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status ENUM('open', 'resolved', 'dismissed') NOT NULL DEFAULT 'open',
    resolved_faq_id INT NULL,
    CONSTRAINT fk_chatbot_unanswered_faq FOREIGN KEY (resolved_faq_id)
      REFERENCES Chatbot_Faqs(faq_id) ON DELETE SET NULL,
    KEY idx_chatbot_unanswered_status_times (status, times_asked, last_asked),
    UNIQUE KEY uq_chatbot_unanswered_question_hash (normalized_question_hash)
);

SET @has_question_hash = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Chatbot_Unanswered'
      AND COLUMN_NAME = 'normalized_question_hash'
);
SET @add_question_hash = IF(
    @has_question_hash = 0,
    'ALTER TABLE Chatbot_Unanswered ADD COLUMN normalized_question_hash BINARY(32) NULL AFTER normalized_question',
    'SELECT 1'
);
PREPARE add_question_hash_stmt FROM @add_question_hash;
EXECUTE add_question_hash_stmt;
DEALLOCATE PREPARE add_question_hash_stmt;

UPDATE Chatbot_Unanswered
SET normalized_question_hash = UNHEX(SHA2(normalized_question, 256))
WHERE normalized_question_hash IS NULL;

SET @has_question_unique_index = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Chatbot_Unanswered'
      AND INDEX_NAME = 'normalized_question'
);
SET @drop_question_unique_index = IF(
    @has_question_unique_index > 0,
    'ALTER TABLE Chatbot_Unanswered DROP INDEX normalized_question',
    'SELECT 1'
);
PREPARE drop_question_unique_index_stmt FROM @drop_question_unique_index;
EXECUTE drop_question_unique_index_stmt;
DEALLOCATE PREPARE drop_question_unique_index_stmt;

ALTER TABLE Chatbot_Unanswered
    MODIFY normalized_question_hash BINARY(32) NOT NULL;

SET @has_question_hash_unique_index = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Chatbot_Unanswered'
      AND INDEX_NAME = 'uq_chatbot_unanswered_question_hash'
);
SET @add_question_hash_unique_index = IF(
    @has_question_hash_unique_index = 0,
    'ALTER TABLE Chatbot_Unanswered ADD UNIQUE KEY uq_chatbot_unanswered_question_hash (normalized_question_hash)',
    'SELECT 1'
);
PREPARE add_question_hash_unique_index_stmt FROM @add_question_hash_unique_index;
EXECUTE add_question_hash_unique_index_stmt;
DEALLOCATE PREPARE add_question_hash_unique_index_stmt;
