const crypto = require('crypto');
const db = require('../config/db');

const generateRideCode = () => {
  return crypto.randomBytes(3).toString('hex').toUpperCase(); // e.g. "9F4B2A"
};

// Create a new ride and make the creator an active member
exports.createRide = async (req, res) => {
  const { name, destination } = req.body;
  const creatorId = req.user.id;

  if (!name) {
    return res.status(400).json({ message: 'Ride name is required.' });
  }

  const rideCode = generateRideCode();

  try {
    const [rideResult] = await db.query(
      'INSERT INTO rides (ride_code, name, creator_id, destination) VALUES (?, ?, ?, ?)',
      [rideCode, name, creatorId, destination || null]
    );

    const rideId = rideResult.insertId;

    // Creator automatically joins the ride
    await db.query(
      'INSERT INTO ride_members (ride_id, user_id, status) VALUES (?, ?, "online")',
      [rideId, creatorId]
    );

    res.status(201).json({
      message: 'Ride created successfully.',
      ride: { id: rideId, rideCode, name, destination, creatorId },
    });
  } catch (error) {
    console.error('Create ride error:', error);
    res.status(500).json({ message: 'Failed to create ride.' });
  }
};

// Join a ride using ride_code
exports.joinRide = async (req, res) => {
  const { rideCode } = req.body;
  const userId = req.user.id;

  if (!rideCode) {
    return res.status(400).json({ message: 'Ride code is required.' });
  }

  try {
    const [rides] = await db.query('SELECT * FROM rides WHERE ride_code = ? AND status = "active"', [rideCode]);
    if (rides.length === 0) {
      return res.status(404).json({ message: 'Ride not found or is no longer active.' });
    }

    const ride = rides[0];

    // Check if user is already a member
    const [existing] = await db.query(
      'SELECT id FROM ride_members WHERE ride_id = ? AND user_id = ?',
      [ride.id, userId]
    );

    if (existing.length === 0) {
      await db.query(
        'INSERT INTO ride_members (ride_id, user_id, status) VALUES (?, ?, "online")',
        [ride.id, userId]
      );
    } else {
      // If rejoining, ensure status is online
      await db.query(
        'UPDATE ride_members SET status = "online" WHERE ride_id = ? AND user_id = ?',
        [ride.id, userId]
      );
    }

    res.status(200).json({
      message: 'Joined ride successfully.',
      ride: { id: ride.id, rideCode: ride.ride_code, name: ride.name, destination: ride.destination },
    });
  } catch (error) {
    console.error('Join ride error:', error);
    res.status(500).json({ message: 'Failed to join ride.' });
  }
};

// Get ride details along with current members & their latest known locations
exports.getRideDetails = async (req, res) => {
  const { rideId } = req.params;
  const userId = req.user.id;

  try {
    // Verify membership
    const [membership] = await db.query(
      'SELECT id FROM ride_members WHERE ride_id = ? AND user_id = ?',
      [rideId, userId]
    );

    if (membership.length === 0) {
      return res.status(403).json({ message: 'You are not a member of this ride.' });
    }

    // Fetch ride base information
    const [rides] = await db.query('SELECT * FROM rides WHERE id = ?', [rideId]);
    if (rides.length === 0) {
      return res.status(404).json({ message: 'Ride not found.' });
    }

    // Fetch members with latest location
    const [members] = await db.query(
      `SELECT 
        u.id, 
        u.name, 
        u.email, 
        rm.status, 
        rm.joined_at,
        l.latitude, 
        l.longitude, 
        l.updated_at AS last_location_update
      FROM ride_members rm
      JOIN users u ON rm.user_id = u.id
      LEFT JOIN locations l ON (l.ride_id = rm.ride_id AND l.user_id = rm.user_id)
      WHERE rm.ride_id = ?`,
      [rideId]
    );

    res.status(200).json({
      ride: rides[0],
      members,
    });
  } catch (error) {
    console.error('Fetch ride details error:', error);
    res.status(500).json({ message: 'Failed to fetch ride details.' });
  }
};

// Leave a ride
exports.leaveRide = async (req, res) => {
  const { rideId } = req.params;
  const userId = req.user.id;

  try {
    await db.query('DELETE FROM ride_members WHERE ride_id = ? AND user_id = ?', [rideId, userId]);
    res.status(200).json({ message: 'Successfully left the ride.' });
  } catch (error) {
    console.error('Leave ride error:', error);
    res.status(500).json({ message: 'Failed to leave ride.' });
  }
};


// Update status: only the creator/leader can perform this
exports.updateRideStatus = async (req, res) => {
  const { rideId } = req.params;
  const { status } = req.body; // 'active', 'paused', 'completed'
  const userId = req.user.id;

  const validStatuses = ['active', 'paused', 'completed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid ride status.' });
  }

  try {
    // 1. Fetch the ride to verify creator
    const [rides] = await db.query('SELECT * FROM rides WHERE id = ?', [rideId]);
    if (rides.length === 0) {
      return res.status(404).json({ message: 'Ride not found.' });
    }

    const ride = rides[0];

    // 2. Strict authorization: Only the creator is the leader
    if (ride.creator_id !== userId) {
      return res.status(403).json({ message: 'Only the ride leader can change the trip status.' });
    }

    // 3. Update the status in MySQL
    await db.query('UPDATE rides SET status = ? WHERE id = ?', [status, rideId]);

    res.status(200).json({
      message: `Ride status updated to ${status}.`,
      status,
    });
  } catch (error) {
    console.error('Update ride status error:', error);
    res.status(500).json({ message: 'Failed to update ride status.' });
  }
};