-- Drop the unused legacy chatbot knowledge-base table; live chatbot content uses the managed chatbot tables.
DROP TABLE IF EXISTS chatbot_kb;
