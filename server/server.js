const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const pool = require('./config/db');
const initLocationSocket = require('./sockets/locationSocket');
require('dotenv').config();

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Initialize Socket.IO with CORS enabled for frontend Vite dev server
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173', // Vite default port
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Attach socket handlers
initLocationSocket(io);

async function startServer() {
  try {
    await pool.query('SELECT 1 + 1 AS test');
    console.log('✅ Database connected successfully');

    server.listen(PORT, () => {
      console.log(`🚀 RideSync server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

startServer();