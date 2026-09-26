const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');
const authenticateToken = require('../middleware/authMiddleware');

router.use(authenticateToken); // Protect all ride endpoints

router.post('/', rideController.createRide);
router.post('/join', rideController.joinRide);
router.get('/:rideId', rideController.getRideDetails);
router.patch('/:rideId/status', rideController.updateRideStatus);
router.delete('/:rideId/leave', rideController.leaveRide);

module.exports = router;