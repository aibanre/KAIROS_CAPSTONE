-- Phase B customer backend additions. Apply manually; startup does not run migrations.
CREATE TABLE IF NOT EXISTS Reservation_Status_History (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    reservation_id INT NOT NULL,
    from_status VARCHAR(30) NULL,
    to_status VARCHAR(30) NOT NULL,
    actor_type ENUM('customer', 'staff', 'system') NOT NULL DEFAULT 'system',
    changed_by INT NULL,
    changed_by_customer_id INT NULL,
    reason VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_status_history_reservation FOREIGN KEY (reservation_id) REFERENCES Reservations(reservation_id),
    CONSTRAINT fk_status_history_user FOREIGN KEY (changed_by) REFERENCES Users(user_id),
    CONSTRAINT fk_status_history_customer FOREIGN KEY (changed_by_customer_id) REFERENCES Customer(customer_id),
    CONSTRAINT chk_status_history_one_actor CHECK (NOT (changed_by IS NOT NULL AND changed_by_customer_id IS NOT NULL)),
    KEY idx_status_history_reservation_created (reservation_id, created_at)
);

CREATE INDEX idx_reservations_customer_created ON Reservations (customer_id, created_at);
CREATE INDEX idx_reservations_customer_status ON Reservations (customer_id, status);
CREATE INDEX idx_payments_customer_lookup ON Payments (reservation_id, created_at);

-- Verify duplicates before applying this constraint:
-- SELECT reservation_id, customer_id, COUNT(*) FROM Reviews
-- GROUP BY reservation_id, customer_id HAVING COUNT(*) > 1;
ALTER TABLE Reviews ADD UNIQUE KEY uq_reviews_reservation_customer (reservation_id, customer_id);
