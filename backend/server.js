// server.js
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const initDb = require('./database/initDb');
const authRoutes = require('./routes/authRoutes');
const roomRoutes = require('./routes/roomRoutes');
const venueRoutes = require('./routes/venueRoutes');
const availabilityRoutes = require('./routes/availabilityRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const publicReservationRoutes = require('./routes/publicReservationRoutes');
const paymentMethodRoutes = require('./routes/paymentMethodRoutes');
const adminDashboardRoutes = require('./routes/adminDashboardRoutes');
const adminReservationRoutes = require('./routes/adminReservationRoutes');
const adminWalkInRoutes = require('./routes/adminWalkInRoutes');
const adminRoomRoutes = require('./routes/adminRoomRoutes');
const adminVenueRoutes = require('./routes/adminVenueRoutes');
const adminImageRoutes = require('./routes/adminImageRoutes');
const adminPaymentRoutes = require('./routes/adminPaymentRoutes');
const adminPaymentMethodRoutes = require('./routes/adminPaymentMethodRoutes');
const adminCustomerRoutes = require('./routes/adminCustomerRoutes');
const adminUserRoutes = require('./routes/adminUserRoutes');
const adminReportRoutes = require('./routes/adminReportRoutes');
const adminAuditLogRoutes = require('./routes/adminAuditLogRoutes');
const adminNotificationRoutes = require('./routes/adminNotificationRoutes');
const adminInventoryRoutes = require('./routes/adminInventoryRoutes');
const adminChatbotRoutes = require('./routes/adminChatbotRoutes');
const { publicRouter: resortInfoRoutes, adminRouter: adminResortInfoRoutes } = require('./routes/resortSettingsRoutes');
const customerRoutes = require('./routes/customerRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const chatbotRoutes = require('./routes/chatbotRoutes');
const trackRoutes = require('./routes/trackRoutes');
const { startExpiredReservationCleanup } = require('./utils/cleanupExpiredReservations');
const { allowedOrigins, trustProxy } = require('./config/security');

const app = express();
if (trustProxy) app.set('trust proxy', 1);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Reservation-Token');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json());
app.use(cookieParser());

// Example route to prove the app + db are alive
app.get('/', (req, res) => {
  res.send('Kai Azul Resort API is running.');
});

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/reservations', publicReservationRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/reservations/track', trackRoutes);
app.use('/api/payment-methods', paymentMethodRoutes);
app.use('/api/resort-info', resortInfoRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/reservations', adminReservationRoutes);
app.use('/api/admin/walk-in', adminWalkInRoutes);
app.use('/api/admin/rooms', adminRoomRoutes);
app.use('/api/admin/venues', adminVenueRoutes);
app.use('/api/admin/images', adminImageRoutes);
app.use('/api/admin/payments', adminPaymentRoutes);
app.use('/api/admin/payment-methods', adminPaymentMethodRoutes);
app.use('/api/admin/customers', adminCustomerRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/reports', adminReportRoutes);
app.use('/api/admin/audit-logs', adminAuditLogRoutes);
app.use('/api/admin/notifications', adminNotificationRoutes);
app.use('/api/admin', adminInventoryRoutes);
app.use('/api/admin/chatbot', adminChatbotRoutes);
app.use('/api/admin/settings/resort', adminResortInfoRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use((err, req, res, next) => {
  console.error('[server] Unhandled request error:', err.message);
  if (res.headersSent) return next(err);
  return res.status(500).json({ error: 'Internal server error.' });
});

const PORT = process.env.PORT || 5000;

async function startServer(port = PORT) {
  await initDb();
  startExpiredReservationCleanup();
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error('Failed to start server due to database init error:', err);
    process.exit(1);
  });
}

module.exports = { app, startServer };