-- =========================================
-- KAI AZUL RESORT — DATABASE SCHEMA
-- Safe to run multiple times (IF NOT EXISTS)
-- =========================================

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
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    password_changed_at TIMESTAMP(6) NULL DEFAULT NULL
);

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
    date_of_birth DATE NULL,
    google_sub VARCHAR(64) NULL,
    is_registered BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_customer_email (email),
    UNIQUE KEY uq_customer_google_sub (google_sub)
);

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

CREATE TABLE IF NOT EXISTS PasswordResetTokens (
    token_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    requested_ip VARCHAR(45) NULL,
    CONSTRAINT fk_password_reset_customer FOREIGN KEY (customer_id) REFERENCES Customer(customer_id) ON DELETE CASCADE,
    INDEX idx_password_reset_customer (customer_id),
    INDEX idx_password_reset_expiry (expires_at)
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
    booking_mode ENUM('day_use', 'packaged') NOT NULL DEFAULT 'day_use',
    start_time TIME NULL,
    end_time TIME NULL,
    earliest_start TIME NULL,
    latest_end TIME NULL,
    slot_step_minutes INT NOT NULL DEFAULT 30,
    buffer_minutes INT NOT NULL DEFAULT 0,
    flat_price DECIMAL(10,2) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Venue_Packages (
    package_id INT AUTO_INCREMENT PRIMARY KEY,
    venue_id INT NOT NULL,
    package_name VARCHAR(150) NOT NULL,
    description TEXT,
    inclusions JSON NOT NULL,
    pricing_type ENUM('flat', 'per_person') NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    min_pax INT NOT NULL DEFAULT 1,
    max_pax INT NULL,
    included_hours DECIMAL(5,2) NOT NULL DEFAULT 5,
    extra_hour_rate DECIMAL(10,2) NULL DEFAULT 1500,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_venue_package_venue FOREIGN KEY (venue_id) REFERENCES Venues(venue_id) ON DELETE CASCADE,
    CONSTRAINT chk_venue_package_price CHECK (price > 0),
    CONSTRAINT chk_venue_package_pax CHECK (min_pax >= 1 AND (max_pax IS NULL OR max_pax >= min_pax)),
    CONSTRAINT chk_venue_package_hours CHECK (included_hours > 0 AND (extra_hour_rate IS NULL OR extra_hour_rate >= 0)),
    KEY idx_venue_packages_active (venue_id, is_active, sort_order)
);

INSERT INTO Venues (venue_name, venue_type, capacity, description, booking_mode, start_time, end_time, slot_step_minutes, buffer_minutes, flat_price, status)
SELECT 'Small Cottage', 'cottage', 10, 'Day-use small cottage.', 'day_use', '08:00', '17:00', 30, 0, 1500, 'available'
WHERE NOT EXISTS (SELECT 1 FROM Venues WHERE venue_name = 'Small Cottage');
INSERT INTO Venues (venue_name, venue_type, capacity, description, booking_mode, start_time, end_time, earliest_start, latest_end, slot_step_minutes, buffer_minutes, status)
SELECT 'Conference Hall', 'hall', 300, 'Packaged conference hall.', 'packaged', '08:00', '22:00', '08:00', '22:00', 30, 0, 'available'
WHERE NOT EXISTS (SELECT 1 FROM Venues WHERE venue_name = 'Conference Hall');
INSERT INTO Venues (venue_name, venue_type, capacity, description, booking_mode, start_time, end_time, slot_step_minutes, buffer_minutes, flat_price, status)
SELECT 'Big Cottage', 'cottage', 20, 'Day-use big cottage.', 'day_use', '08:00', '17:00', 30, 0, 3000, 'available'
WHERE NOT EXISTS (SELECT 1 FROM Venues WHERE venue_name = 'Big Cottage');
INSERT INTO Venue_Packages (venue_id, package_name, description, inclusions, pricing_type, price, min_pax, included_hours, extra_hour_rate, sort_order)
SELECT v.venue_id, 'Free Venue (Per Person)', 'Venue fee included.', JSON_ARRAY('Venue fee included'), 'per_person', 590, 100, 5, 1500, 1 FROM Venues v
WHERE v.venue_name = 'Conference Hall' AND NOT EXISTS (SELECT 1 FROM Venue_Packages p WHERE p.venue_id = v.venue_id AND p.package_name = 'Free Venue (Per Person)');
INSERT INTO Venue_Packages (venue_id, package_name, description, inclusions, pricing_type, price, min_pax, included_hours, extra_hour_rate, sort_order)
SELECT v.venue_id, 'Package 10K', 'Placeholder inclusions - edit in admin.', JSON_ARRAY('Placeholder inclusion'), 'flat', 10000, 1, 5, 1500, 2 FROM Venues v
WHERE v.venue_name = 'Conference Hall' AND NOT EXISTS (SELECT 1 FROM Venue_Packages p WHERE p.venue_id = v.venue_id AND p.package_name = 'Package 10K');
INSERT INTO Venue_Packages (venue_id, package_name, description, inclusions, pricing_type, price, min_pax, included_hours, extra_hour_rate, sort_order)
SELECT v.venue_id, 'Package 15K', 'Placeholder inclusions - edit in admin.', JSON_ARRAY('Placeholder inclusion'), 'flat', 15000, 1, 5, 1500, 3 FROM Venues v
WHERE v.venue_name = 'Conference Hall' AND NOT EXISTS (SELECT 1 FROM Venue_Packages p WHERE p.venue_id = v.venue_id AND p.package_name = 'Package 15K');
INSERT INTO Venue_Packages (venue_id, package_name, description, inclusions, pricing_type, price, min_pax, included_hours, extra_hour_rate, sort_order)
SELECT v.venue_id, 'Package 20K', 'Placeholder inclusions - edit in admin.', JSON_ARRAY('Placeholder inclusion'), 'flat', 20000, 1, 5, 1500, 4 FROM Venues v
WHERE v.venue_name = 'Conference Hall' AND NOT EXISTS (SELECT 1 FROM Venue_Packages p WHERE p.venue_id = v.venue_id AND p.package_name = 'Package 20K');

-- RESERVATIONS
CREATE TABLE IF NOT EXISTS Reservations (
    reservation_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    visitor_key CHAR(64) NULL,
    room_id INT NULL,
    venue_id INT NULL,
    booking_source ENUM('online', 'walk-in') NOT NULL,
    booking_reference VARCHAR(20) NOT NULL UNIQUE,
    created_by INT NULL,
    hold_expires_at TIMESTAMP NULL,
    check_in_date DATE NULL,
    check_out_date DATE NULL,
    event_date DATE NULL,
    start_time TIME NULL,
    end_time TIME NULL,
    duration_hours DECIMAL(5,2) NULL,
    num_guests INT,
    children INT NOT NULL DEFAULT 0,
    pax INT NULL,
    package_id INT NULL,
    package_name VARCHAR(150) NULL,
    package_inclusions JSON NULL,
    unit_price DECIMAL(10,2) NULL,
    pricing_type ENUM('flat', 'per_person') NULL,
    extra_hours DECIMAL(5,2) NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    actual_check_in DATETIME NULL,
    actual_check_out DATETIME NULL,
    early_checkin_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    late_checkout_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    fees_collected_at DATETIME NULL,
    early_checkin_fees_collected_at DATETIME NULL,
    late_checkout_fees_collected_at DATETIME NULL,
    early_checkin_collected_by INT NULL,
    late_checkout_collected_by INT NULL,
    status ENUM(
        'payment_pending',
        'pending_verification',
        'confirmed',
        'checked_in',
        'completed',
        'cancelled',
        'rejected',
        'no_show'
    ) DEFAULT 'payment_pending',
    cancellation_reason VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_res_customer FOREIGN KEY (customer_id) REFERENCES Customer(customer_id),
    CONSTRAINT fk_res_room FOREIGN KEY (room_id) REFERENCES Rooms(room_id),
    CONSTRAINT fk_res_venue FOREIGN KEY (venue_id) REFERENCES Venues(venue_id),
    CONSTRAINT fk_res_creator FOREIGN KEY (created_by) REFERENCES Users(user_id),
    CONSTRAINT fk_res_early_fee_collector FOREIGN KEY (early_checkin_collected_by) REFERENCES Users(user_id),
    CONSTRAINT fk_res_late_fee_collector FOREIGN KEY (late_checkout_collected_by) REFERENCES Users(user_id),

    KEY idx_room_dates (room_id, check_in_date, check_out_date, status),
    KEY idx_res_venue_date (venue_id, event_date, start_time),
    KEY idx_reservations_customer_created (customer_id, created_at),
    KEY idx_reservations_customer_status (customer_id, status),
    KEY idx_reservations_visitor_status (visitor_key, status, hold_expires_at),

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

INSERT IGNORE INTO Inventory_Items (item_name, description, default_charge_cents, is_active)
VALUES
    ('Key', 'Room key', 50000, 1),
    ('Insert Key', 'Insert key', 50000, 1),
    ('Bath Towel', 'Bath towel', 50000, 1),
    ('Blanket', 'Blanket', 60000, 1),
    ('Bedsheet', 'Bedsheet', 50000, 1),
    ('Pillow', 'Pillow', 50000, 1),
    ('Remote', 'Room remote', 100000, 1),
    ('Flower', 'Room flower', 50000, 1),
    ('Trash Bin', 'Trash bin', 50000, 1);

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

-- CHATBOT MANAGEMENT
CREATE TABLE IF NOT EXISTS Chatbot_Faqs (
    faq_id INT AUTO_INCREMENT PRIMARY KEY,
    question VARCHAR(255) NOT NULL,
    answer TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_chatbot_faq_created_by FOREIGN KEY (created_by) REFERENCES Users(user_id),
    CONSTRAINT fk_chatbot_faq_updated_by FOREIGN KEY (updated_by) REFERENCES Users(user_id),
    KEY idx_chatbot_faq_active_order (is_active, sort_order)
);

CREATE TABLE IF NOT EXISTS Chatbot_Knowledge (
    knowledge_id INT AUTO_INCREMENT PRIMARY KEY,
    topic_key VARCHAR(80) NOT NULL UNIQUE,
    title VARCHAR(150) NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_live BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by INT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_chatbot_knowledge_updated_by FOREIGN KEY (updated_by) REFERENCES Users(user_id),
    KEY idx_chatbot_knowledge_active (is_active)
);

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
    CONSTRAINT fk_chatbot_unanswered_faq FOREIGN KEY (resolved_faq_id) REFERENCES Chatbot_Faqs(faq_id) ON DELETE SET NULL,
    KEY idx_chatbot_unanswered_status_times (status, times_asked, last_asked),
    UNIQUE KEY uq_chatbot_unanswered_question_hash (normalized_question_hash)
);

INSERT INTO Chatbot_Faqs (question, answer, sort_order)
SELECT 'What time is check-in and check-out?', 'Check-in is at 2:00 PM and check-out is at 12:00 noon.', 10
WHERE NOT EXISTS (SELECT 1 FROM Chatbot_Faqs WHERE question = 'What time is check-in and check-out?');
INSERT INTO Chatbot_Faqs (question, answer, sort_order)
SELECT 'Do you have parking and WiFi?', 'Yes. Kai Azul lists Parking and Piso WiFi among its resort amenities.', 20
WHERE NOT EXISTS (SELECT 1 FROM Chatbot_Faqs WHERE question = 'Do you have parking and WiFi?');
INSERT INTO Chatbot_Faqs (question, answer, sort_order)
SELECT 'What is the deposit policy?', 'A 50% deposit is required to confirm a reservation, and the deposit is non-refundable.', 30
WHERE NOT EXISTS (SELECT 1 FROM Chatbot_Faqs WHERE question = 'What is the deposit policy?');
INSERT INTO Chatbot_Faqs (question, answer, sort_order)
SELECT 'Can I cancel, get a refund, or rebook?', 'All bookings are final. Cancellations, refunds, rebooking, rescheduling, and date changes are not available.', 40
WHERE NOT EXISTS (SELECT 1 FROM Chatbot_Faqs WHERE question = 'Can I cancel, get a refund, or rebook?');
INSERT INTO Chatbot_Faqs (question, answer, sort_order)
SELECT 'Can I book through the chatbot?', 'Reservations are made on the website, not in this chat. Guests can use /rooms-and-venues, choose a room or venue, open the venue details page, and select Reserve Now. Guests can book without an account and pay by uploading proof of payment. Logged-in customers can use /portal/browse. I can help compare options or check availability and quotes first.', 50
WHERE NOT EXISTS (SELECT 1 FROM Chatbot_Faqs WHERE question = 'Can I book through the chatbot?');
INSERT INTO Chatbot_Knowledge (topic_key, title, content)
SELECT 'resort_amenities', 'Resort amenities', 'Verified resort amenities include Restaurant & Bar, Piso WiFi, Parking, Recreational Activities, and KTV Room.'
WHERE NOT EXISTS (SELECT 1 FROM Chatbot_Knowledge WHERE topic_key = 'resort_amenities');
INSERT INTO Chatbot_Knowledge (topic_key, title, content)
SELECT 'booking_policy', 'Booking and payment policy', 'Check-in is at 2:00 PM and check-out is at 12:00 noon. A 50% non-refundable deposit confirms a reservation. All bookings are final: no cancellations, refunds, rebooking, rescheduling, or date changes.'
WHERE NOT EXISTS (SELECT 1 FROM Chatbot_Knowledge WHERE topic_key = 'booking_policy');
INSERT INTO Chatbot_Knowledge (topic_key, title, content)
SELECT 'cottage_and_conference_hall', 'Cottages and Conference Hall', 'Cottages are day-use venues. The Conference Hall is a packaged venue; active package names, descriptions, inclusions, prices, and booking rules come from live venue and package records.'
WHERE NOT EXISTS (SELECT 1 FROM Chatbot_Knowledge WHERE topic_key = 'cottage_and_conference_hall');

-- CHATBOT CONVERSATION HISTORY (customer-owned; no prompts, tools, or secrets)
CREATE TABLE IF NOT EXISTS Chatbot_Conversations (
    conversation_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_chatbot_conversation_customer FOREIGN KEY (customer_id)
        REFERENCES Customer(customer_id) ON DELETE CASCADE,
    KEY idx_chatbot_conversations_customer_updated (customer_id, updated_at)
);

CREATE TABLE IF NOT EXISTS Chatbot_Messages (
    message_id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    role ENUM('user', 'assistant') NOT NULL,
    content TEXT NOT NULL,
    model VARCHAR(255) NULL,
    prompt_tokens INT NULL,
    completion_tokens INT NULL,
    matched_faq_id INT NULL,
    was_answered BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_chatbot_message_conversation FOREIGN KEY (conversation_id)
        REFERENCES Chatbot_Conversations(conversation_id) ON DELETE CASCADE,
    CONSTRAINT fk_chatbot_message_faq FOREIGN KEY (matched_faq_id)
        REFERENCES Chatbot_Faqs(faq_id) ON DELETE SET NULL,
    KEY idx_chatbot_messages_conversation_created (conversation_id, created_at)
);

-- =========================================
-- INDEXES to help prevent double bookings
-- (created only if they don't already exist — see initDb.js,
--  since MySQL/MariaDB doesn't support "CREATE INDEX IF NOT EXISTS"
--  reliably across versions)
-- =========================================
