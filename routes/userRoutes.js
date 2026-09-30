const express = require('express');
const {
  addNewUser,
  loginUser,
  verifyEmail,
  resendVerification,
  googleAuth,
  getUsers,
  getUserWithID,
  updateUser,
  deleteUser,
  getCurrentUser
} = require('../controllers/userControllers.js');
const { 
  protect, 
  authorizePersonnel 
} = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const verifyEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  ipv6Subnet: 56,
  message: { message: 'Too many verification attempts. Please try again later.' }
});

const resendVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  ipv6Subnet: 56,
  message: { message: 'Too many verification code requests. Please try again later.' }
});

// Auth endpoints
router.post('/auth/register', addNewUser);
router.post('/auth/login', loginUser);
router.post('/auth/verify-email', verifyEmailLimiter, verifyEmail);
router.post('/auth/resend-verification', resendVerificationLimiter, resendVerification);

// Legacy user endpoints (optional)
router.post('/users', addNewUser);
router.post('/users/login', loginUser);
router.post('/auth/google', googleAuth);
router.get('/users/me', protect, getCurrentUser);
router.get('/users', protect, authorizePersonnel, getUsers);
router.get('/users/:userId', protect, getUserWithID);
router.put('/users/:userId', protect, updateUser);
router.delete('/users/:userId', protect, deleteUser);

module.exports = router;
