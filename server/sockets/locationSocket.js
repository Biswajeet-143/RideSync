const jwt = require('jsonwebtoken');
const db = require('../config/db');

// In-memory throttling map to prevent MySQL write overload
// Structure: `${rideId}:${userId}` -> { latitude, longitude, accuracy, timestamp }
const pendingDbUpdates = new Map();

// Periodically flush cached locations to MySQL every 10 seconds
setInterval(async () => {
  if (pendingDbUpdates.size === 0) return;

  const updates = Array.from(pendingDbUpdates.entries());
  pendingDbUpdates.clear();

  for (const [key, data] of updates) {
    const [rideId, userId] = key.split(':');
    try {
      await db.query(
        `INSERT INTO locations (ride_id, user_id, latitude, longitude, accuracy, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE 
           latitude = VALUES(latitude), 
           longitude = VALUES(longitude), 
           accuracy = VALUES(accuracy), 
           updated_at = NOW()`,
        [rideId, userId, data.latitude, data.longitude, data.accuracy || null]
      );
    } catch (err) {
      console.error(`Failed to persist location for user ${userId}:`, err.message);
    }
  }
}, 10000);

function initLocationSocket(io) {
  // 1. Socket Authentication Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // Contains id, name, email
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Connected: ${socket.user.name} (Socket ID: ${socket.id})`);

    // 2. Join Ride Room
    socket.on('join-ride-room', async ({ rideId }) => {
      if (!rideId) return;

      // Verify membership before allowing access to room
      try {
        const [membership] = await db.query(
          'SELECT id FROM ride_members WHERE ride_id = ? AND user_id = ?',
          [rideId, socket.user.id]
        );

        if (membership.length === 0) {
          return socket.emit('error-message', 'Not authorized to join this ride channel.');
        }

        const roomName = `ride_${rideId}`;
        socket.join(roomName);
        socket.currentRideId = rideId;

        // Mark member as online in DB
        await db.query(
          'UPDATE ride_members SET status = "online" WHERE ride_id = ? AND user_id = ?',
          [rideId, socket.user.id]
        );

        // Notify other room members
        io.to(roomName).emit('member-status-changed', {
          userId: socket.user.id,
          status: 'online',
        });

        console.log(`👤 ${socket.user.name} joined room ${roomName}`);
      } catch (err) {
        console.error('Error joining socket room:', err);
      }
    });



    // 3. Real-Time Location Update
    socket.on('send-location', ({ rideId, latitude, longitude, accuracy, isPaused }) => {
      if (!rideId || latitude == null || longitude == null || isPaused) return;

      const roomName = `ride_${rideId}`;

      socket.to(roomName).emit('member-location-updated', {
        userId: socket.user.id,
        userName: socket.user.name,
        latitude,
        longitude,
        accuracy,
        updatedAt: new Date().toISOString(),
    });

  const cacheKey = `${rideId}:${socket.user.id}`;
  pendingDbUpdates.set(cacheKey, { latitude, longitude, accuracy });
});

    // 4. Handle Disconnect / Leave
    socket.on('disconnect', async () => {
      console.log(`❌ Disconnected: ${socket.user.name}`);
      if (socket.currentRideId) {
        const roomName = `ride_${socket.currentRideId}`;

        try {
          await db.query(
            'UPDATE ride_members SET status = "offline" WHERE ride_id = ? AND user_id = ?',
            [socket.currentRideId, socket.user.id]
          );

          socket.to(roomName).emit('member-status-changed', {
            userId: socket.user.id,
            status: 'offline',
          });
        } catch (err) {
          console.error('Error updating status on disconnect:', err);
        }
      }
    });

    // Leader triggers pause, resume, or end
    socket.on('ride-status-change', async ({ rideId, status }) => {
      if (!rideId || !status) return;

      const roomName = `ride_${rideId}`;

      // Broadcast to all participants in this ride room
      io.to(roomName).emit('ride-status-updated', { status });
    });

  });
}

module.exports = initLocationSocket;