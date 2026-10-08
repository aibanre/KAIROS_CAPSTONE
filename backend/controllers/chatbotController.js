const pool = require('../config/db');
async function message(req, res) {
  const text = typeof req.body.message === 'string' ? req.body.message.trim() : '';
  if (!text) return res.status(400).json({ error: 'message is required.' });
  try {
    const [rows] = await pool.query(
      `SELECT answer FROM Chatbot_KB WHERE LOWER(?) LIKE CONCAT('%', LOWER(question_pattern), '%')
       OR LOWER(?) LIKE CONCAT('%', LOWER(COALESCE(keywords, '')), '%') ORDER BY kb_id LIMIT 1`, [text, text]
    );
    return res.json({ message: rows[0]?.answer || 'I am sorry, I do not have an answer for that yet. Please contact the resort.' });
  } catch (err) { return res.status(500).json({ error: 'Failed to process chatbot message.' }); }
}
module.exports = { message };
