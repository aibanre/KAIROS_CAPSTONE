const pool = require('../config/db');
const { PLACEHOLDER_CUSTOMER_MARKER } = require('../config/reservationConfig');
const logAudit = require('../utils/logAudit');

const MAX_QUESTION = 255;
const MAX_ANSWER = 10000;
const MAX_TOPIC = 80;
const MAX_TITLE = 150;
const MAX_CONTENT = 20000;

function missingTable(error) {
  return ['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR', 'ER_TABLEACCESS_DENIED_ERROR'].includes(error?.code)
    || [1051, 1054, 1146].includes(error?.errno);
}

function text(value, max) {
  return typeof value === 'string' && value.trim() && value.trim().length <= max ? value.trim() : null;
}

function id(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function audit(req, action, entityType, entityId, oldValue, newValue) {
  return logAudit({
    userId: req.user.user_id,
    action,
    entityType,
    entityId,
    oldValue,
    newValue: { ...newValue, actor_role: req.user.role },
    ipAddress: req.ip,
  });
}

async function listFaqs(req, res) {
  try {
    const [rows] = await pool.query(`SELECT faq_id, question, answer, is_active, sort_order, created_at, updated_at
      FROM Chatbot_Faqs ORDER BY sort_order, faq_id`);
    return res.json({ faqs: rows });
  } catch (error) {
    if (missingTable(error)) return res.json({ faqs: [] });
    console.error('[admin chatbot faqs] Error:', error.message);
    return res.status(500).json({ error: 'Failed to load chatbot FAQs.' });
  }
}

async function createFaq(req, res) {
  const question = text(req.body?.question, MAX_QUESTION);
  const answer = text(req.body?.answer, MAX_ANSWER);
  if (!question || !answer) return res.status(400).json({ error: 'A valid question and answer are required.' });
  try {
    const [result] = await pool.query(
      `INSERT INTO Chatbot_Faqs (question, answer, sort_order, created_by, updated_by)
       VALUES (?, ?, COALESCE((SELECT MAX(sort_order) + 10 FROM Chatbot_Faqs existing_faqs), 10), ?, ?)`,
      [question, answer, req.user.user_id, req.user.user_id]
    );
    await audit(req, 'chatbot.faq.create', 'chatbot_faq', result.insertId, null, { question, answer });
    const [[faq]] = await pool.query('SELECT faq_id, question, answer, is_active, sort_order, created_at, updated_at FROM Chatbot_Faqs WHERE faq_id = ?', [result.insertId]);
    return res.status(201).json({ faq });
  } catch (error) {
    if (missingTable(error)) return res.status(503).json({ error: 'Chatbot management is temporarily unavailable.' });
    console.error('[admin chatbot create faq] Error:', error.message);
    return res.status(500).json({ error: 'Failed to create chatbot FAQ.' });
  }
}

async function updateFaq(req, res) {
  const faqId = id(req.params.id);
  const question = text(req.body?.question, MAX_QUESTION);
  const answer = text(req.body?.answer, MAX_ANSWER);
  if (!faqId || !question || !answer) return res.status(400).json({ error: 'A valid FAQ, question, and answer are required.' });
  try {
    const [[oldFaq]] = await pool.query('SELECT * FROM Chatbot_Faqs WHERE faq_id = ?', [faqId]);
    if (!oldFaq) return res.status(404).json({ error: 'FAQ not found.' });
    await pool.query('UPDATE Chatbot_Faqs SET question = ?, answer = ?, updated_by = ? WHERE faq_id = ?', [question, answer, req.user.user_id, faqId]);
    await audit(req, 'chatbot.faq.update', 'chatbot_faq', faqId, { question: oldFaq.question, answer: oldFaq.answer }, { question, answer });
    const [[faq]] = await pool.query('SELECT faq_id, question, answer, is_active, sort_order, created_at, updated_at FROM Chatbot_Faqs WHERE faq_id = ?', [faqId]);
    return res.json({ faq });
  } catch (error) {
    if (missingTable(error)) return res.status(503).json({ error: 'Chatbot management is temporarily unavailable.' });
    console.error('[admin chatbot update faq] Error:', error.message);
    return res.status(500).json({ error: 'Failed to update chatbot FAQ.' });
  }
}

async function deactivateFaq(req, res) {
  const faqId = id(req.params.id);
  if (!faqId) return res.status(400).json({ error: 'Invalid FAQ ID.' });
  try {
    const [[oldFaq]] = await pool.query('SELECT * FROM Chatbot_Faqs WHERE faq_id = ?', [faqId]);
    if (!oldFaq) return res.status(404).json({ error: 'FAQ not found.' });
    await pool.query('UPDATE Chatbot_Faqs SET is_active = FALSE, updated_by = ? WHERE faq_id = ?', [req.user.user_id, faqId]);
    await audit(req, 'chatbot.faq.deactivate', 'chatbot_faq', faqId, { is_active: oldFaq.is_active }, { is_active: false });
    return res.json({ message: 'FAQ deactivated.' });
  } catch (error) {
    if (missingTable(error)) return res.status(503).json({ error: 'Chatbot management is temporarily unavailable.' });
    console.error('[admin chatbot deactivate faq] Error:', error.message);
    return res.status(500).json({ error: 'Failed to deactivate chatbot FAQ.' });
  }
}

async function reorderFaqs(req, res) {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!items.length || items.some((item) => !id(item?.faq_id) || !Number.isInteger(Number(item.sort_order)))) {
    return res.status(400).json({ error: 'A valid FAQ order is required.' });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const item of items) {
      await connection.query('UPDATE Chatbot_Faqs SET sort_order = ?, updated_by = ? WHERE faq_id = ?', [Number(item.sort_order), req.user.user_id, Number(item.faq_id)]);
    }
    await connection.commit();
    await audit(req, 'chatbot.faq.reorder', 'chatbot_faq', null, null, { count: items.length });
    return res.json({ message: 'FAQ order updated.' });
  } catch (error) {
    try { await connection.rollback(); } catch (rollbackError) { console.error('[admin chatbot reorder rollback] Error:', rollbackError.message); }
    if (missingTable(error)) return res.status(503).json({ error: 'Chatbot management is temporarily unavailable.' });
    console.error('[admin chatbot reorder faq] Error:', error.message);
    return res.status(500).json({ error: 'Failed to reorder chatbot FAQs.' });
  } finally {
    connection.release();
  }
}

async function liveKnowledge() {
  const topics = [];
  const [rooms] = await pool.query('SELECT room_number, room_type, capacity, price_per_night, description, amenities FROM Rooms WHERE status = "available" ORDER BY room_number');
  if (rooms.length) topics.push({ topic_key: 'live_rooms', title: 'Available rooms', content: JSON.stringify(rooms), is_active: true, is_live: true });
  const [venues] = await pool.query('SELECT venue_name, venue_type, capacity, description, amenities, booking_mode, flat_price FROM Venues WHERE status = "available" ORDER BY venue_name');
  if (venues.length) topics.push({ topic_key: 'live_venues', title: 'Available venues', content: JSON.stringify(venues), is_active: true, is_live: true });
  const [packages] = await pool.query(`SELECT v.venue_name, p.package_name, p.description, p.inclusions, p.pricing_type, p.price, p.min_pax, p.max_pax, p.included_hours, p.extra_hour_rate
    FROM Venue_Packages p INNER JOIN Venues v ON v.venue_id = p.venue_id
    WHERE p.is_active = TRUE AND v.status = 'available' ORDER BY v.venue_name, p.sort_order`);
  topics.push({ topic_key: 'live_packages', title: 'Active venue packages', content: JSON.stringify(packages), is_active: true, is_live: true });
  const [[settings]] = await pool.query('SELECT resort_name, address, contact_number, email FROM ResortSettings WHERE settings_id = 1');
  topics.push({ topic_key: 'live_resort_info', title: 'Resort information', content: JSON.stringify(settings || {}), is_active: true, is_live: true });
  topics.push({ topic_key: 'live_payment_policy', title: 'Payment policy', content: 'A 50% non-refundable deposit confirms a reservation. All bookings are final; no cancellations, refunds, rebooking, rescheduling, or date changes.', is_active: true, is_live: true });
  return topics;
}

async function listKnowledge(req, res) {
  try {
    const [editable] = await pool.query(`SELECT knowledge_id, topic_key, title, content, is_active, is_live, updated_at
      FROM Chatbot_Knowledge WHERE is_live = FALSE ORDER BY title`);
    return res.json({ knowledge: [...await liveKnowledge(), ...editable] });
  } catch (error) {
    if (missingTable(error)) {
      try { return res.json({ knowledge: await liveKnowledge() }); } catch (liveError) {
        console.error('[admin chatbot live knowledge] Error:', liveError.message);
        return res.json({ knowledge: [] });
      }
    }
    console.error('[admin chatbot knowledge] Error:', error.message);
    return res.status(500).json({ error: 'Failed to load chatbot knowledge.' });
  }
}

async function updateKnowledge(req, res) {
  const knowledgeId = id(req.params.id);
  const title = text(req.body?.title, MAX_TITLE);
  const content = text(req.body?.content, MAX_CONTENT);
  if (!knowledgeId || !title || !content) return res.status(400).json({ error: 'A valid topic title and content are required.' });
  try {
    const [[oldTopic]] = await pool.query('SELECT * FROM Chatbot_Knowledge WHERE knowledge_id = ? AND is_live = FALSE', [knowledgeId]);
    if (!oldTopic) return res.status(404).json({ error: 'Editable knowledge topic not found.' });
    await pool.query('UPDATE Chatbot_Knowledge SET title = ?, content = ?, updated_by = ? WHERE knowledge_id = ?', [title, content, req.user.user_id, knowledgeId]);
    await audit(req, 'chatbot.knowledge.update', 'chatbot_knowledge', knowledgeId, { title: oldTopic.title, content: oldTopic.content }, { title, content });
    const [[topic]] = await pool.query('SELECT knowledge_id, topic_key, title, content, is_active, is_live, updated_at FROM Chatbot_Knowledge WHERE knowledge_id = ?', [knowledgeId]);
    return res.json({ knowledge: topic });
  } catch (error) {
    if (missingTable(error)) return res.status(503).json({ error: 'Chatbot management is temporarily unavailable.' });
    console.error('[admin chatbot update knowledge] Error:', error.message);
    return res.status(500).json({ error: 'Failed to update chatbot knowledge.' });
  }
}

async function listUnanswered(req, res) {
  try {
    const [rows] = await pool.query(`SELECT unanswered_id, question_text, times_asked, first_asked, last_asked, status, resolved_faq_id
      FROM Chatbot_Unanswered ORDER BY status = 'open' DESC, times_asked DESC, last_asked DESC`);
    return res.json({ unanswered: rows });
  } catch (error) {
    if (missingTable(error)) return res.json({ unanswered: [] });
    console.error('[admin chatbot unanswered] Error:', error.message);
    return res.status(500).json({ error: 'Failed to load unanswered questions.' });
  }
}

async function promoteUnanswered(req, res) {
  const unansweredId = id(req.params.id);
  const answer = text(req.body?.answer, MAX_ANSWER);
  if (!unansweredId || !answer) return res.status(400).json({ error: 'A valid answer is required.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[question]] = await connection.query('SELECT * FROM Chatbot_Unanswered WHERE unanswered_id = ? FOR UPDATE', [unansweredId]);
    if (!question) { await connection.rollback(); return res.status(404).json({ error: 'Unanswered question not found.' }); }
    const [faqResult] = await connection.query(
      'INSERT INTO Chatbot_Faqs (question, answer, created_by, updated_by) VALUES (?, ?, ?, ?)',
      [question.question_text, answer, req.user.user_id, req.user.user_id]
    );
    await connection.query('UPDATE Chatbot_Unanswered SET status = "resolved", resolved_faq_id = ? WHERE unanswered_id = ?', [faqResult.insertId, unansweredId]);
    await connection.commit();
    await audit(req, 'chatbot.unanswered.promote', 'chatbot_unanswered', unansweredId, { status: question.status }, { status: 'resolved', faq_id: faqResult.insertId });
    return res.status(201).json({ faq_id: faqResult.insertId, message: 'Question promoted to an FAQ.' });
  } catch (error) {
    try { await connection.rollback(); } catch (rollbackError) { console.error('[admin chatbot promote rollback] Error:', rollbackError.message); }
    if (missingTable(error)) return res.status(503).json({ error: 'Chatbot management is temporarily unavailable.' });
    console.error('[admin chatbot promote] Error:', error.message);
    return res.status(500).json({ error: 'Failed to promote unanswered question.' });
  } finally { connection.release(); }
}

async function dismissUnanswered(req, res) {
  const unansweredId = id(req.params.id);
  if (!unansweredId) return res.status(400).json({ error: 'Invalid unanswered question ID.' });
  try {
    const [[oldQuestion]] = await pool.query('SELECT * FROM Chatbot_Unanswered WHERE unanswered_id = ?', [unansweredId]);
    if (!oldQuestion) return res.status(404).json({ error: 'Unanswered question not found.' });
    await pool.query('UPDATE Chatbot_Unanswered SET status = "dismissed" WHERE unanswered_id = ?', [unansweredId]);
    await audit(req, 'chatbot.unanswered.dismiss', 'chatbot_unanswered', unansweredId, { status: oldQuestion.status }, { status: 'dismissed' });
    return res.json({ message: 'Question dismissed.' });
  } catch (error) {
    if (missingTable(error)) return res.status(503).json({ error: 'Chatbot management is temporarily unavailable.' });
    console.error('[admin chatbot dismiss] Error:', error.message);
    return res.status(500).json({ error: 'Failed to dismiss unanswered question.' });
  }
}

async function listConversations(req, res) {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = ['cu.first_name <> ?', 'cu.phone_number NOT LIKE ?'];
  params.push(PLACEHOLDER_CUSTOMER_MARKER, `${PLACEHOLDER_CUSTOMER_MARKER}-%`);
  if (req.query.answered === 'true') conditions.push('EXISTS (SELECT 1 FROM Chatbot_Messages mx WHERE mx.conversation_id = c.conversation_id AND mx.role = "assistant" AND mx.was_answered = TRUE)');
  if (req.query.answered === 'false') conditions.push('EXISTS (SELECT 1 FROM Chatbot_Messages mx WHERE mx.conversation_id = c.conversation_id AND mx.role = "assistant" AND mx.was_answered = FALSE)');
  if (req.query.start_date) { conditions.push('c.updated_at >= ?'); params.push(`${req.query.start_date} 00:00:00`); }
  if (req.query.end_date) { conditions.push('c.updated_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(req.query.end_date); }
  if (req.query.search) { conditions.push('CONCAT(cu.first_name, " ", LEFT(cu.last_name, 1)) LIKE ?'); params.push(`%${String(req.query.search).slice(0, 80)}%`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  try {
    const [[countRow]] = await pool.query(`SELECT COUNT(*) AS count FROM Chatbot_Conversations c INNER JOIN Customer cu ON cu.customer_id = c.customer_id ${where}`, params);
    const [rows] = await pool.query(`SELECT c.conversation_id, CONCAT(cu.first_name, ' ', LEFT(cu.last_name, 1), '.') AS customer_name,
      c.created_at, c.updated_at,
      (SELECT m.content FROM Chatbot_Messages m WHERE m.conversation_id = c.conversation_id AND m.role = 'user' ORDER BY m.created_at, m.message_id LIMIT 1) AS first_message,
      (SELECT COUNT(*) FROM Chatbot_Messages m WHERE m.conversation_id = c.conversation_id AND m.role = 'assistant' AND m.was_answered = FALSE) AS unanswered_count
      FROM Chatbot_Conversations c INNER JOIN Customer cu ON cu.customer_id = c.customer_id ${where}
      ORDER BY c.updated_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    return res.json({ conversations: rows, page, limit, total: Number(countRow.count) });
  } catch (error) {
    if (missingTable(error)) return res.json({ conversations: [], page, limit, total: 0 });
    console.error('[admin chatbot conversations] Error:', error.message);
    return res.status(500).json({ error: 'Failed to load chatbot conversations.' });
  }
}

async function getConversationMessages(req, res) {
  const conversationId = id(req.params.id);
  if (!conversationId) return res.status(400).json({ error: 'Invalid conversation ID.' });
  try {
    const [messages] = await pool.query(`SELECT message_id, role, content, matched_faq_id, was_answered, created_at
      FROM Chatbot_Messages WHERE conversation_id = ? ORDER BY created_at, message_id`, [conversationId]);
    return res.json({ messages });
  } catch (error) {
    if (missingTable(error)) return res.json({ messages: [] });
    console.error('[admin chatbot conversation] Error:', error.message);
    return res.status(500).json({ error: 'Failed to load chatbot conversation.' });
  }
}

async function getStats(req, res) {
  try {
    const [[faq]] = await pool.query('SELECT COUNT(*) AS count FROM Chatbot_Faqs WHERE is_active = TRUE');
    const [[unanswered]] = await pool.query('SELECT COUNT(*) AS count FROM Chatbot_Unanswered WHERE status = "open"');
    const [[conversations]] = await pool.query('SELECT COUNT(*) AS count FROM Chatbot_Conversations WHERE updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    const [[answers]] = await pool.query(`SELECT COUNT(*) AS total, SUM(was_answered = TRUE) AS answered
      FROM Chatbot_Messages WHERE role = 'assistant' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`);
    return res.json({ total_faqs: Number(faq.count), open_unanswered: Number(unanswered.count), conversations_week: Number(conversations.count), answer_rate: answers.total ? Math.round((Number(answers.answered || 0) / Number(answers.total)) * 100) : 0 });
  } catch (error) {
    if (missingTable(error)) return res.json({ total_faqs: 0, open_unanswered: 0, conversations_week: 0, answer_rate: 0 });
    console.error('[admin chatbot stats] Error:', error.message);
    return res.status(500).json({ error: 'Failed to load chatbot statistics.' });
  }
}

module.exports = {
  listFaqs, createFaq, updateFaq, deactivateFaq, reorderFaqs,
  listKnowledge, updateKnowledge,
  listUnanswered, promoteUnanswered, dismissUnanswered,
  listConversations, getConversationMessages, getStats,
};
