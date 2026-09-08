// server.js
require('dotenv').config();
const express = require('express');
const initDb = require('./database/initDb');
const roomRoutes = require('./routes/roomRoutes');

const app = express();
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});
app.use(express.json());

// Example route to prove the app + db are alive
app.get('/', (req, res) => {
  res.send('Kai Azul Resort API is running.');
});

app.use('/api/rooms', roomRoutes);

const PORT = process.env.PORT || 5000;

// Ensure the schema exists BEFORE the server starts accepting requests.
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server due to database init error:', err);
    process.exit(1);
  });