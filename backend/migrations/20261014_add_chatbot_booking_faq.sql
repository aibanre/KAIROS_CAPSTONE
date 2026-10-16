-- Run against the database named in DB_NAME: mysql -u root -p <DB_NAME> < file.sql
-- Add the booking-chatbot FAQ to existing installations without creating duplicates.
INSERT INTO Chatbot_Faqs (question, answer, sort_order)
SELECT 'Can I book through the chatbot?', 'Reservations are made on the website, not in this chat. Guests can use /rooms-and-venues, choose a room or venue, open the venue details page, and select Reserve Now. Guests can book without an account and pay by uploading proof of payment. Logged-in customers can use /portal/browse. I can help compare options or check availability and quotes first.', 50
WHERE NOT EXISTS (SELECT 1 FROM Chatbot_Faqs WHERE question = 'Can I book through the chatbot?');
