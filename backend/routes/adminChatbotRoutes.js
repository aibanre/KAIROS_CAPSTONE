const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const controller = require('../controllers/adminChatbotController');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/stats', controller.getStats);
router.get('/faqs', controller.listFaqs);
router.post('/faqs', controller.createFaq);
router.patch('/faqs/reorder', controller.reorderFaqs);
router.put('/faqs/:id', controller.updateFaq);
router.patch('/faqs/:id/deactivate', controller.deactivateFaq);
router.get('/knowledge', controller.listKnowledge);
router.put('/knowledge/:id', controller.updateKnowledge);
router.get('/unanswered', controller.listUnanswered);
router.post('/unanswered/:id/promote', controller.promoteUnanswered);
router.patch('/unanswered/:id/dismiss', controller.dismissUnanswered);
router.get('/conversations', controller.listConversations);
router.get('/conversations/:id', controller.getConversationMessages);

module.exports = router;
