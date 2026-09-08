-- =========================================
-- KAI AZUL RESORT — DATABASE SCHEMA
-- Safe to run multiple times (IF NOT EXISTS)
-- =========================================

CREATE DATABASE IF NOT EXISTS kairos_db;
USE kairos_db;

-- STAFF (Admin & Receptionist only)
CREATE TABLE IF NOT EXISTS Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    role ENUM('admin', 'receptionist') NOT NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
);

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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_customer_email (email)
);

-- ROOMS
CREATE TABLE IF NOT EXISTS Rooms (
    room_id INT AUTO_INCREMENT PRIMARY KEY,
    room_number VARCHAR(20) NOT NULL UNIQUE,
    room_type VARCHAR(50) NOT NULL,
    capacity INT NOT NULL,
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

    CONSTRAINT chk_room_or_venue CHECK (
        (room_id IS NOT NULL AND venue_id IS NULL) OR
        (room_id IS NULL AND venue_id IS NOT NULL)
    )
);

-- PAYMENTS
CREATE TABLE IF NOT EXISTS Payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    reservation_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    proof_of_payment_url VARCHAR(255),
    payment_status ENUM('pending', 'pending_verification', 'verified', 'rejected') DEFAULT 'pending',
    verified_by INT NULL,
    verified_at TIMESTAMP NULL,
    rejection_reason VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_pay_reservation FOREIGN KEY (reservation_id) REFERENCES Reservations(reservation_id),
    CONSTRAINT fk_pay_verifier FOREIGN KEY (verified_by) REFERENCES Users(user_id)
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
    CONSTRAINT fk_review_customer FOREIGN KEY (customer_id) REFERENCES Customer(customer_id)
);

-- AUDIT LOGS (staff actions only)
CREATE TABLE IF NOT EXISTS Audit_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INT,
    old_value TEXT,
    new_value TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES Users(user_id)
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
