-- =========================================
-- KAI AZUL RESORT — DATABASE SCHEMA
-- Safe to run multiple times (IF NOT EXISTS)
-- =========================================

CREATE DATABASE IF NOT EXISTS kairos_db;
USE kairos_db;

-- USERS (staff accounts and legacy customer role)
CREATE TABLE IF NOT EXISTS Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    role ENUM('customer', 'receptionist', 'admin') NOT NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- RESORT SETTINGS (single editable public information row)
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

-- CUSTOMERS (guest or registered, self-contained login)
CREATE TABLE IF NOT EXISTS Customer (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100),
    phone_number VARCHAR(20) NOT NULL,
    address VARCHAR(255),
    password_hash VARCHAR(255) NULL,
    is_registered BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_customer_email (email)
);

-- ROOMS
CREATE TABLE IF NOT EXISTS Rooms (
    room_id INT AUTO_INCREMENT PRIMARY KEY,
    room_number VARCHAR(20) NOT NULL UNIQUE,
    room_type VARCHAR(50) NOT NULL,
    capacity INT NOT NULL,
    max_extra_beds INT NOT NULL DEFAULT 0,
    price_per_night DECIMAL(10,2) NOT NULL,
    description TEXT,
    amenities TEXT,
    status ENUM('available', 'unavailable', 'maintenance') DEFAULT 'available',
    images TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- VENUES
CREATE TABLE IF NOT EXISTS Venues (
    venue_id INT AUTO_INCREMENT PRIMARY KEY,
    venue_name VARCHAR(100) NOT NULL,
    venue_type VARCHAR(50) NOT NULL,
    capacity INT NOT NULL,
    description TEXT,
    amenities TEXT,
    status ENUM('available', 'unavailable', 'maintenance') DEFAULT 'available',
    images TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- RESERVATIONS
CREATE TABLE IF NOT EXISTS Reservations (
    reservation_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    room_id INT NULL,
    venue_id INT NULL,
    booking_source ENUM('online', 'walk-in') NOT NULL,
    booking_reference VARCHAR(20) NOT NULL UNIQUE,
    created_by INT NULL,
    hold_expires_at TIMESTAMP NULL,
    check_in_date DATE NULL,
    check_out_date DATE NULL,
    event_date DATE NULL,
    num_guests INT,
    total_amount DECIMAL(10,2) NOT NULL,
    actual_check_in DATETIME NULL,
    actual_check_out DATETIME NULL,
    early_checkin_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    late_checkout_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    fees_collected_at DATETIME NULL,
    status ENUM(
        'payment_pending',
        'pending_verification',
        'confirmed',
        'checked_in',
        'completed',
        'cancelled',
        'rejected'
    ) DEFAULT 'payment_pending',
    cancellation_reason VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_res_customer FOREIGN KEY (customer_id) REFERENCES Customer(customer_id),
    CONSTRAINT fk_res_room FOREIGN KEY (room_id) REFERENCES Rooms(room_id),
    CONSTRAINT fk_res_venue FOREIGN KEY (venue_id) REFERENCES Venues(venue_id),
    CONSTRAINT fk_res_creator FOREIGN KEY (created_by) REFERENCES Users(user_id),

    KEY idx_room_dates (room_id, check_in_date, check_out_date, status),
    KEY idx_venue_date (venue_id, event_date, status),
    KEY idx_reservations_customer_created (customer_id, created_at),
    KEY idx_reservations_customer_status (customer_id, status),

    CONSTRAINT chk_room_or_venue CHECK (
        (room_id IS NOT NULL AND venue_id IS NULL) OR
        (room_id IS NULL AND venue_id IS NOT NULL)
    )
);

-- RESERVATION STATUS HISTORY
CREATE TABLE IF NOT EXISTS Reservation_Status_History (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    reservation_id INT NOT NULL,
    from_status VARCHAR(30) NULL,
    to_status VARCHAR(30) NOT NULL,
    actor_type ENUM('customer', 'staff', 'system') NOT NULL DEFAULT 'system',
    changed_by INT NULL,
    changed_by_customer_id INT NULL,
    reason VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_status_history_reservation FOREIGN KEY (reservation_id) REFERENCES Reservations(reservation_id),
    CONSTRAINT fk_status_history_user FOREIGN KEY (changed_by) REFERENCES Users(user_id),
    CONSTRAINT fk_status_history_customer FOREIGN KEY (changed_by_customer_id) REFERENCES Customer(customer_id),
    CONSTRAINT chk_status_history_one_actor CHECK (
        NOT (changed_by IS NOT NULL AND changed_by_customer_id IS NOT NULL)
    ),

    KEY idx_status_history_reservation_created (reservation_id, created_at)
);

-- RESERVATION ADD-ONS
CREATE TABLE IF NOT EXISTS Reservation_Addons (
    addon_id INT AUTO_INCREMENT PRIMARY KEY,
    reservation_id INT NOT NULL,
    addon_type ENUM('extra_bed') NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    added_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    KEY idx_reservation_addons_reservation (reservation_id),

    CONSTRAINT fk_addon_reservation FOREIGN KEY (reservation_id) REFERENCES Reservations(reservation_id),
    CONSTRAINT fk_addon_user FOREIGN KEY (added_by) REFERENCES Users(user_id),
    CONSTRAINT chk_addon_quantity CHECK (quantity > 0),
    CONSTRAINT chk_addon_unit_price CHECK (unit_price >= 0)
);

-- PAYMENT METHODS (admin-managed; method_type also supports cash and card)
CREATE TABLE IF NOT EXISTS PaymentMethods (
    payment_method_id INT AUTO_INCREMENT PRIMARY KEY,
    method_name VARCHAR(50) NOT NULL,
    method_type VARCHAR(20) NOT NULL,
    qr_image_url VARCHAR(500) NULL,
    account_name VARCHAR(100),
    account_number VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_payment_method_name (method_name)
);

INSERT INTO PaymentMethods (method_name, method_type, qr_image_url, account_name, account_number)
SELECT 'Cash', 'cash', NULL, NULL, NULL
WHERE NOT EXISTS (
    SELECT 1 FROM PaymentMethods WHERE method_type = 'cash'
);

INSERT INTO PaymentMethods (method_name, method_type, qr_image_url, account_name, account_number)
SELECT 'Card', 'card', NULL, NULL, NULL
WHERE NOT EXISTS (
    SELECT 1 FROM PaymentMethods WHERE method_type = 'card'
);

-- PAYMENTS
CREATE TABLE IF NOT EXISTS Payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    reservation_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_type ENUM('deposit', 'balance', 'full') NOT NULL DEFAULT 'full',
    payment_method_id INT NOT NULL,
    proof_of_payment_url VARCHAR(255),
    payment_status ENUM('pending', 'pending_verification', 'verified', 'rejected') DEFAULT 'pending',
    verified_by INT NULL,
    verified_at TIMESTAMP NULL,
    rejection_reason VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    KEY idx_payments_reservation_status (reservation_id, payment_status),
    KEY idx_payments_customer_lookup (reservation_id, created_at),

    CONSTRAINT fk_pay_reservation FOREIGN KEY (reservation_id) REFERENCES Reservations(reservation_id),
    CONSTRAINT fk_pay_verifier FOREIGN KEY (verified_by) REFERENCES Users(user_id),
    CONSTRAINT fk_pay_method FOREIGN KEY (payment_method_id) REFERENCES PaymentMethods(payment_method_id)
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS Notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NULL,
    user_id INT NULL,
    channel ENUM('email', 'in-system') NOT NULL DEFAULT 'in-system',
    type VARCHAR(50),
    subject VARCHAR(150),
    message TEXT NOT NULL,
    status ENUM('unread', 'read', 'sent', 'failed') DEFAULT 'unread',
    sent_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_notif_customer FOREIGN KEY (customer_id) REFERENCES Customer(customer_id),
    CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

-- REVIEWS
CREATE TABLE IF NOT EXISTS Reviews (
    review_id INT AUTO_INCREMENT PRIMARY KEY,
    reservation_id INT NOT NULL,
    customer_id INT NOT NULL,
    rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_review_reservation FOREIGN KEY (reservation_id) REFERENCES Reservations(reservation_id),
    CONSTRAINT fk_review_customer FOREIGN KEY (customer_id) REFERENCES Customer(customer_id),
    UNIQUE KEY uq_reviews_reservation_customer (reservation_id, customer_id)
);

-- AUDIT LOGS (staff actions and system/customer events; user_id NULL for non-staff actors)
CREATE TABLE IF NOT EXISTS Audit_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INT,
    old_value TEXT,
    new_value TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

-- ROOM INVENTORY CHECKLISTS. This inspection is recorded once at check-out.
CREATE TABLE IF NOT EXISTS Inventory_Items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    item_name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    default_charge_cents INT UNSIGNED NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ,
    CONSTRAINT chk_inventory_item_charge CHECK (default_charge_cents >= 0)
);

CREATE TABLE IF NOT EXISTS room_inventory (
    room_inventory_id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    item_id INT NOT NULL,
    expected_quantity INT UNSIGNED NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_room_inventory_item (room_id, item_id),
    KEY fk_room_inventory_item (item_id),
    CONSTRAINT fk_room_inventory_item FOREIGN KEY (item_id) REFERENCES Inventory_Items(item_id),
    CONSTRAINT fk_room_inventory_room FOREIGN KEY (room_id) REFERENCES Rooms(room_id),
    CONSTRAINT chk_room_inventory_quantity CHECK (expected_quantity > 0)
);

CREATE TABLE IF NOT EXISTS Reservation_Inventory_Checks (
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

CREATE TABLE IF NOT EXISTS Reservation_Inventory_Lines (
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

-- CHATBOT KNOWLEDGE BASE
CREATE TABLE IF NOT EXISTS Chatbot_KB (
    kb_id INT AUTO_INCREMENT PRIMARY KEY,
    question_pattern VARCHAR(255) NOT NULL,
    answer TEXT NOT NULL,
    category VARCHAR(50),
    keywords VARCHAR(255),
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_kb_creator FOREIGN KEY (created_by) REFERENCES Users(user_id)
);

-- =========================================
-- INDEXES to help prevent double bookings
-- (created only if they don't already exist — see initDb.js,
--  since MySQL/MariaDB doesn't support "CREATE INDEX IF NOT EXISTS"
--  reliably across versions)
-- =========================================
