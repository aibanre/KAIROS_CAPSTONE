-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: kairos_db
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `audit_logs` (
  `log_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `entity_type` varchar(50) DEFAULT NULL,
  `entity_id` int(11) DEFAULT NULL,
  `old_value` text DEFAULT NULL,
  `new_value` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`log_id`),
  KEY `fk_audit_user` (`user_id`),
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,1,'verify_payment','Payment',1,'{\"payment_status\":\"pending_verification\",\"reservation_status\":\"pending_verification\"}','{\"payment_status\":\"verified\",\"reservation_status\":\"confirmed\",\"rejection_reason\":null}','::1','2026-10-05 03:22:51'),(2,1,'reject_payment','Payment',2,'{\"payment_status\":\"pending_verification\",\"reservation_status\":\"pending_verification\"}','{\"payment_status\":\"rejected\",\"reservation_status\":\"rejected\",\"rejection_reason\":null}','::1','2026-10-05 03:24:57'),(3,1,'auth.login','user_session',NULL,NULL,'{\"email\":\"admin@kairos.com\",\"role\":\"admin\"}',NULL,'2026-10-05 03:46:41'),(4,NULL,'auth.login_failed','user_session',NULL,NULL,'{\"email\":\"admin@kairos.x\",\"reason\":\"invalid_credentials_or_inactive_account\"}',NULL,'2026-10-05 03:47:57'),(5,NULL,'auth.login_failed','user_session',NULL,NULL,'{\"email\":\"rocaa@gmail.com\",\"reason\":\"invalid_credentials_or_inactive_account\"}',NULL,'2026-10-05 03:48:09'),(6,NULL,'reservation.create','reservation',3,NULL,'{\"booking_reference\":\"KAB-2026-10-5311\",\"customer_id\":4,\"room_id\":1,\"check_in_date\":\"2026-10-06\",\"check_out_date\":\"2026-10-07\",\"status\":\"payment_pending\"}','::1','2026-10-05 03:49:48'),(7,NULL,'reservation.create','reservation',4,NULL,'{\"booking_reference\":\"KAB-2026-10-6539\",\"customer_id\":5,\"room_id\":1,\"check_in_date\":\"2026-10-07\",\"check_out_date\":\"2026-10-09\",\"status\":\"payment_pending\"}','::1','2026-10-05 03:50:32'),(8,1,'payment.accept','payment',3,'{\"payment_status\":\"pending_verification\",\"reservation_status\":\"pending_verification\"}','{\"payment_status\":\"verified\",\"reservation_status\":\"confirmed\",\"rejection_reason\":null}','::1','2026-10-05 03:51:03'),(9,1,'payment.decline','payment',4,'{\"payment_status\":\"pending_verification\",\"reservation_status\":\"pending_verification\"}','{\"payment_status\":\"rejected\",\"reservation_status\":\"rejected\",\"rejection_reason\":null}','::1','2026-10-05 03:51:14'),(10,NULL,'reservation.create','reservation',5,NULL,'{\"booking_reference\":\"KAB-2026-10-4626\",\"customer_id\":6,\"room_id\":1,\"check_in_date\":\"2026-10-07\",\"check_out_date\":\"2026-10-09\",\"status\":\"payment_pending\"}','::1','2026-10-05 03:51:44'),(11,1,'payment.decline','payment',5,'{\"payment_status\":\"pending_verification\",\"reservation_status\":\"pending_verification\"}','{\"payment_status\":\"rejected\",\"reservation_status\":\"rejected\",\"rejection_reason\":null}','::1','2026-10-05 03:54:16'),(12,1,'auth.login','user_session',NULL,NULL,'{\"email\":\"admin@kairos.com\",\"role\":\"admin\"}',NULL,'2026-10-05 06:01:46'),(13,1,'auth.logout','user_session',NULL,NULL,'{\"reason\":\"logout\"}',NULL,'2026-10-05 07:44:42'),(14,1,'auth.login','user_session',NULL,NULL,'{\"email\":\"admin@kairos.com\",\"role\":\"admin\"}',NULL,'2026-10-05 07:44:45'),(15,1,'reservation.create','reservation',6,NULL,'{\"booking_reference\":\"KAB-2026-10-6339\",\"booking_source\":\"walk-in\",\"customer_id\":7,\"room_id\":2,\"venue_id\":null,\"total_amount\":12,\"payment_id\":6,\"notes\":null}','::1','2026-10-05 13:21:44');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chatbot_kb`
--

DROP TABLE IF EXISTS `chatbot_kb`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chatbot_kb` (
  `kb_id` int(11) NOT NULL AUTO_INCREMENT,
  `question_pattern` varchar(255) NOT NULL,
  `answer` text NOT NULL,
  `category` varchar(50) DEFAULT NULL,
  `keywords` varchar(255) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`kb_id`),
  KEY `fk_kb_creator` (`created_by`),
  CONSTRAINT `fk_kb_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chatbot_kb`
--

LOCK TABLES `chatbot_kb` WRITE;
/*!40000 ALTER TABLE `chatbot_kb` DISABLE KEYS */;
/*!40000 ALTER TABLE `chatbot_kb` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer`
--

DROP TABLE IF EXISTS `customer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `customer` (
  `customer_id` int(11) NOT NULL AUTO_INCREMENT,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone_number` varchar(20) NOT NULL,
  `address` varchar(255) DEFAULT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `is_registered` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`customer_id`),
  UNIQUE KEY `uq_customer_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer`
--

LOCK TABLES `customer` WRITE;
/*!40000 ALTER TABLE `customer` DISABLE KEYS */;
INSERT INTO `customer` VALUES (1,'Ivan Ray Neil','Rocat','rocat@gmail.com','09123456789',NULL,'$2b$12$vhx5oFqXDkyMlES6QH2FQuL0PCG7GKpYWKGTJ0Ci9JWwQWGjJzh5u',1,'2026-09-12 09:56:04',1),(2,'asd','asd','rocs@gmail.com','09123456789','cm cm',NULL,0,'2026-10-05 02:53:12',1),(3,'ds','ds','ds@gmail.com','s','ss',NULL,0,'2026-10-05 03:24:12',1),(4,'Ivan Ray Neil','Rocat','ss@m.com','2','CM Homes, Brgy. 24 - A',NULL,0,'2026-10-05 03:49:48',1),(5,'Aiban','Rocat','ivat13@gmail.com','dd','ds',NULL,0,'2026-10-05 03:50:32',1),(6,'Aiban','Rocat','ivocat13@gmail.com','2','asd',NULL,0,'2026-10-05 03:51:44',1),(7,'Ivan Ray Neil','Rocat',NULL,'asd',NULL,NULL,0,'2026-10-05 13:21:44',1);
/*!40000 ALTER TABLE `customer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `notifications` (
  `notification_id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `channel` enum('email','in-system') NOT NULL DEFAULT 'in-system',
  `type` varchar(50) DEFAULT NULL,
  `subject` varchar(150) DEFAULT NULL,
  `message` text NOT NULL,
  `status` enum('unread','read','sent','failed') DEFAULT 'unread',
  `sent_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`notification_id`),
  KEY `fk_notif_customer` (`customer_id`),
  KEY `fk_notif_user` (`user_id`),
  CONSTRAINT `fk_notif_customer` FOREIGN KEY (`customer_id`) REFERENCES `customer` (`customer_id`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paymentmethods`
--

DROP TABLE IF EXISTS `paymentmethods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `paymentmethods` (
  `payment_method_id` int(11) NOT NULL AUTO_INCREMENT,
  `method_name` varchar(50) NOT NULL,
  `method_type` varchar(20) NOT NULL,
  `qr_image_url` varchar(500) NOT NULL,
  `account_name` varchar(100) DEFAULT NULL,
  `account_number` varchar(50) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`payment_method_id`),
  UNIQUE KEY `uq_payment_method_name` (`method_name`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paymentmethods`
--

LOCK TABLES `paymentmethods` WRITE;
/*!40000 ALTER TABLE `paymentmethods` DISABLE KEYS */;
INSERT INTO `paymentmethods` VALUES (1,'TEST','gcash','https://res.cloudinary.com/k1fgotqf/image/upload/v1789209263/kairos/payment-methods/qy5ywoumdwfj8r4ewyrr.png','TESTT','0912 345 6789',1,'2026-09-12 10:34:23');
/*!40000 ALTER TABLE `paymentmethods` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `payments` (
  `payment_id` int(11) NOT NULL AUTO_INCREMENT,
  `reservation_id` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_method_id` int(11) NOT NULL,
  `proof_of_payment_url` varchar(255) DEFAULT NULL,
  `payment_status` enum('pending','pending_verification','verified','rejected') DEFAULT 'pending',
  `verified_by` int(11) DEFAULT NULL,
  `verified_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`payment_id`),
  KEY `fk_pay_reservation` (`reservation_id`),
  KEY `fk_pay_verifier` (`verified_by`),
  KEY `fk_pay_method` (`payment_method_id`),
  CONSTRAINT `fk_pay_method` FOREIGN KEY (`payment_method_id`) REFERENCES `paymentmethods` (`payment_method_id`),
  CONSTRAINT `fk_pay_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations` (`reservation_id`),
  CONSTRAINT `fk_pay_verifier` FOREIGN KEY (`verified_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
INSERT INTO `payments` VALUES (1,1,3500.00,1,'https://res.cloudinary.com/k1fgotqf/image/upload/v1791168808/kairos/payment-proofs/xvjzkazxrbtcxxmxydad.png','verified',1,'2026-10-05 03:22:51',NULL,'2026-10-05 02:53:29'),(2,2,3500.00,1,'https://res.cloudinary.com/k1fgotqf/image/upload/v1791170674/kairos/payment-proofs/ld6ntplicr4jlycumody.jpg','rejected',1,'2026-10-05 03:24:57',NULL,'2026-10-05 03:24:35'),(3,3,3500.00,1,'https://res.cloudinary.com/k1fgotqf/image/upload/v1791172199/kairos/payment-proofs/n01u8rxdxkuedglzgusj.jpg','verified',1,'2026-10-05 03:51:03',NULL,'2026-10-05 03:50:00'),(4,4,7000.00,1,'https://res.cloudinary.com/k1fgotqf/image/upload/v1791172248/kairos/payment-proofs/nmjrwhlbcqxs17s6nx1g.jpg','rejected',1,'2026-10-05 03:51:14',NULL,'2026-10-05 03:50:49'),(5,5,7000.00,1,'https://res.cloudinary.com/k1fgotqf/image/upload/v1791172317/kairos/payment-proofs/tp3vtxpruaxofwb1eixn.jpg','rejected',1,'2026-10-05 03:54:16',NULL,'2026-10-05 03:51:57'),(6,6,12.00,1,NULL,'verified',1,'2026-10-05 13:21:44',NULL,'2026-10-05 13:21:44');
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reservations`
--

DROP TABLE IF EXISTS `reservations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `reservations` (
  `reservation_id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL,
  `room_id` int(11) DEFAULT NULL,
  `venue_id` int(11) DEFAULT NULL,
  `booking_source` enum('online','walk-in') NOT NULL,
  `booking_reference` varchar(20) NOT NULL,
  `created_by` int(11) DEFAULT NULL,
  `hold_expires_at` timestamp NULL DEFAULT NULL,
  `check_in_date` date DEFAULT NULL,
  `check_out_date` date DEFAULT NULL,
  `event_date` date DEFAULT NULL,
  `num_guests` int(11) DEFAULT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `status` enum('payment_pending','pending_verification','confirmed','checked_in','completed','cancelled','rejected') DEFAULT 'payment_pending',
  `cancellation_reason` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`reservation_id`),
  UNIQUE KEY `booking_reference` (`booking_reference`),
  KEY `fk_res_customer` (`customer_id`),
  KEY `fk_res_creator` (`created_by`),
  KEY `idx_room_dates` (`room_id`,`check_in_date`,`check_out_date`,`status`),
  KEY `idx_venue_date` (`venue_id`,`event_date`,`status`),
  CONSTRAINT `fk_res_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_res_customer` FOREIGN KEY (`customer_id`) REFERENCES `customer` (`customer_id`),
  CONSTRAINT `fk_res_room` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`room_id`),
  CONSTRAINT `fk_res_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`venue_id`),
  CONSTRAINT `chk_room_or_venue` CHECK (`room_id` is not null and `venue_id` is null or `room_id` is null and `venue_id` is not null)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reservations`
--

LOCK TABLES `reservations` WRITE;
/*!40000 ALTER TABLE `reservations` DISABLE KEYS */;
INSERT INTO `reservations` VALUES (1,2,1,NULL,'online','KAB-2026-10-1200',NULL,NULL,'2026-10-05','2026-10-06',NULL,2,3500.00,'confirmed',NULL,'2026-10-05 02:53:12','2026-10-05 03:22:51'),(2,3,1,NULL,'online','KAB-2026-10-9545',NULL,NULL,'2026-10-06','2026-10-07',NULL,2,3500.00,'rejected',NULL,'2026-10-05 03:24:12','2026-10-05 03:24:57'),(3,4,1,NULL,'online','KAB-2026-10-5311',NULL,NULL,'2026-10-06','2026-10-07',NULL,2,3500.00,'confirmed',NULL,'2026-10-05 03:49:48','2026-10-05 03:51:03'),(4,5,1,NULL,'online','KAB-2026-10-6539',NULL,NULL,'2026-10-07','2026-10-09',NULL,2,7000.00,'rejected',NULL,'2026-10-05 03:50:32','2026-10-05 03:51:14'),(5,6,1,NULL,'online','KAB-2026-10-4626',NULL,NULL,'2026-10-07','2026-10-09',NULL,2,7000.00,'rejected',NULL,'2026-10-05 03:51:44','2026-10-05 03:54:16'),(6,7,2,NULL,'walk-in','KAB-2026-10-6339',1,NULL,'2026-10-05','2026-10-06',NULL,1,12.00,'confirmed',NULL,'2026-10-05 13:21:44','2026-10-05 13:21:44');
/*!40000 ALTER TABLE `reservations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reviews`
--

DROP TABLE IF EXISTS `reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `reviews` (
  `review_id` int(11) NOT NULL AUTO_INCREMENT,
  `reservation_id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `rating` tinyint(4) NOT NULL CHECK (`rating` between 1 and 5),
  `comment` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`review_id`),
  KEY `fk_review_reservation` (`reservation_id`),
  KEY `fk_review_customer` (`customer_id`),
  CONSTRAINT `fk_review_customer` FOREIGN KEY (`customer_id`) REFERENCES `customer` (`customer_id`),
  CONSTRAINT `fk_review_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations` (`reservation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reviews`
--

LOCK TABLES `reviews` WRITE;
/*!40000 ALTER TABLE `reviews` DISABLE KEYS */;
/*!40000 ALTER TABLE `reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rooms`
--

DROP TABLE IF EXISTS `rooms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rooms` (
  `room_id` int(11) NOT NULL AUTO_INCREMENT,
  `room_number` varchar(20) NOT NULL,
  `room_type` varchar(50) NOT NULL,
  `capacity` int(11) NOT NULL,
  `price_per_night` decimal(10,2) NOT NULL,
  `description` text DEFAULT NULL,
  `amenities` text DEFAULT NULL,
  `status` enum('available','unavailable','maintenance') DEFAULT 'available',
  `images` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`room_id`),
  UNIQUE KEY `room_number` (`room_number`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rooms`
--

LOCK TABLES `rooms` WRITE;
/*!40000 ALTER TABLE `rooms` DISABLE KEYS */;
INSERT INTO `rooms` VALUES (1,'TEST-101','Test Garden Room',2,3500.00,'room ni gwenet ug ivan','WiFi, Air Conditioning, Mini Bar','available','https://res.cloudinary.com/k1fgotqf/image/upload/v1789209954/kairos/rooms/p8f8tfpvwkhyurwpiv51.jpg','2026-09-08 15:16:08'),(2,'TEST-102','Test',1,12.00,'A sample room for testing availability and reservation flowsssss','WiFi, Air Conditioning, Mini Bar, Basketball Court','available',NULL,'2026-09-10 17:45:23');
/*!40000 ALTER TABLE `rooms` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `user_id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `email` varchar(100) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `role` enum('customer','receptionist','admin') NOT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `last_login` timestamp NULL DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin@kairos.com','$2b$12$rHB5GAu/4Te19v3E8NzRoOW34oMkh46fYsK27sPCmQd1sWPWhJAxS','admin@kairos.com','Admin','admin','active','2026-09-10 17:24:49',NULL,1);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `venues`
--

DROP TABLE IF EXISTS `venues`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `venues` (
  `venue_id` int(11) NOT NULL AUTO_INCREMENT,
  `venue_name` varchar(100) NOT NULL,
  `venue_type` varchar(50) NOT NULL,
  `capacity` int(11) NOT NULL,
  `description` text DEFAULT NULL,
  `amenities` text DEFAULT NULL,
  `status` enum('available','unavailable','maintenance') DEFAULT 'available',
  `images` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`venue_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `venues`
--

LOCK TABLES `venues` WRITE;
/*!40000 ALTER TABLE `venues` DISABLE KEYS */;
INSERT INTO `venues` VALUES (1,'Test Sunset Pavilion','Test Event Venue',50,'A sample venue for testing venue browsing and reservation flows.','WiFi, Sound System, Outdoor Seating','available',NULL,'2026-09-08 15:16:08');
/*!40000 ALTER TABLE `venues` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-05 22:18:03
