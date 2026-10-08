-- Apply manually after 20261006_add_payment_type_to_payments.sql.
-- Target: MySQL 8.0.16 or later. Application validation remains authoritative
-- for older MySQL versions that parse but do not enforce CHECK constraints.
USE kairos_db;

ALTER TABLE Rooms
  ADD COLUMN max_extra_beds INT NOT NULL DEFAULT 0
  AFTER capacity;

CREATE TABLE Reservation_Addons (
  addon_id INT AUTO_INCREMENT PRIMARY KEY,
  reservation_id INT NOT NULL,
  addon_type ENUM('extra_bed') NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  added_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_addon_reservation FOREIGN KEY (reservation_id) REFERENCES Reservations(reservation_id),
  CONSTRAINT fk_addon_user FOREIGN KEY (added_by) REFERENCES Users(user_id),
  CONSTRAINT chk_addon_quantity CHECK (quantity > 0),
  CONSTRAINT chk_addon_unit_price CHECK (unit_price >= 0)
);

CREATE INDEX idx_reservation_addons_reservation
  ON Reservation_Addons (reservation_id);
