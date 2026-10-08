USE kairos_db;

DELIMITER //
CREATE PROCEDURE kairos_prepare_inventory_checklist()
BEGIN
    DECLARE check_rows INT DEFAULT 0;
    DECLARE line_rows INT DEFAULT 0;
    DECLARE legacy_rows INT DEFAULT 0;
    DECLARE has_signature INT DEFAULT 0;

    SELECT COUNT(*) INTO check_rows FROM Reservation_Inventory_Checks;
    SELECT COUNT(*) INTO line_rows FROM Reservation_Inventory_Lines;
    SELECT COUNT(*) INTO legacy_rows FROM reservation_inventory;

    IF check_rows > 0 OR line_rows > 0 OR legacy_rows > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Inventory migration aborted: existing inventory tables contain rows.';
    END IF;

    SELECT COUNT(*) INTO has_signature
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Reservation_Inventory_Checks'
      AND COLUMN_NAME = 'signature_url';

    IF has_signature = 0 THEN
        SET FOREIGN_KEY_CHECKS = 0;
        DROP TABLE IF EXISTS reservation_inventory_lines;
        DROP TABLE IF EXISTS reservation_inventory_checks;
        DROP TABLE IF EXISTS reservation_inventory;
        SET FOREIGN_KEY_CHECKS = 1;

        CREATE TABLE Reservation_Inventory_Checks (
            check_id INT AUTO_INCREMENT PRIMARY KEY,
            reservation_id INT NOT NULL,
            performed_by INT NOT NULL,
            guest_name VARCHAR(150) NOT NULL,
            attendant_name VARCHAR(150) NOT NULL,
            signature_url VARCHAR(500) NOT NULL,
            signed_at DATETIME NOT NULL,
            no_damage_inside BOOLEAN NOT NULL DEFAULT FALSE,
            no_cr_clogging BOOLEAN NOT NULL DEFAULT FALSE,
            notes TEXT,
            total_charge_cents INT UNSIGNED NOT NULL DEFAULT 0,
            charges_collected_at DATETIME NULL,
            charges_collected_by INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_inventory_reservation (reservation_id),
            CONSTRAINT fk_inventory_check_reservation FOREIGN KEY (reservation_id) REFERENCES Reservations(reservation_id),
            CONSTRAINT fk_inventory_check_user FOREIGN KEY (performed_by) REFERENCES Users(user_id),
            CONSTRAINT fk_inventory_check_collector FOREIGN KEY (charges_collected_by) REFERENCES Users(user_id)
        );

        CREATE TABLE Reservation_Inventory_Lines (
            line_id INT AUTO_INCREMENT PRIMARY KEY,
            check_id INT NOT NULL,
            item_id INT NOT NULL,
            item_name VARCHAR(100) NOT NULL,
            quantity INT UNSIGNED NOT NULL,
            quantity_missing INT UNSIGNED NOT NULL DEFAULT 0,
            unit_charge_cents INT UNSIGNED NOT NULL DEFAULT 0,
            charge_cents INT UNSIGNED NOT NULL DEFAULT 0,
            CONSTRAINT fk_inventory_line_check FOREIGN KEY (check_id) REFERENCES Reservation_Inventory_Checks(check_id),
            CONSTRAINT fk_inventory_line_item FOREIGN KEY (item_id) REFERENCES Inventory_Items(item_id),
            CONSTRAINT chk_inventory_line_missing CHECK (quantity_missing <= quantity)
        );
    END IF;

    INSERT IGNORE INTO Inventory_Items (item_name, description, default_charge_cents, is_active)
    VALUES
        ('Key', 'Room key', 50000, TRUE),
        ('Insert Key', 'Insert key', 50000, TRUE),
        ('Bath Towel', 'Bath towel', 50000, TRUE),
        ('Blanket', 'Blanket', 60000, TRUE),
        ('Bedsheet', 'Bedsheet', 50000, TRUE),
        ('Pillow', 'Pillow', 50000, TRUE),
        ('Remote', 'Room remote', 100000, TRUE),
        ('Flower', 'Room flower', 50000, TRUE),
        ('Trash Bin', 'Trash bin', 50000, TRUE);
END//
DELIMITER ;

CALL kairos_prepare_inventory_checklist();
DROP PROCEDURE kairos_prepare_inventory_checklist;
