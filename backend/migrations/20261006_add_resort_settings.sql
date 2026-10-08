-- Apply manually; do not run automatically.
-- mysql -u root -p kairos_db < backend/migrations/20261006_add_resort_settings.sql
USE kairos_db;

CREATE TABLE IF NOT EXISTS ResortSettings (
    settings_id TINYINT PRIMARY KEY DEFAULT 1,
    resort_name VARCHAR(150) NOT NULL,
    address VARCHAR(255) NOT NULL,
    contact_number VARCHAR(30) NOT NULL,
    email VARCHAR(150) NOT NULL,
    updated_by INT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CHECK (settings_id = 1),
    CONSTRAINT fk_resort_settings_user FOREIGN KEY (updated_by) REFERENCES Users(user_id)
);

INSERT INTO ResortSettings (settings_id, resort_name, address, contact_number, email)
VALUES (1, 'Kai Azul Beach Resort', '123 Shoreline Drive, Beach City', '+63 912 345 6789', 'info@kaiazul.com')
ON DUPLICATE KEY UPDATE settings_id = settings_id;
