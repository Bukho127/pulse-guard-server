const express = require('express');
const {
  addNewUser,
  loginUser,
  getUsers,
  getUserWithID,
  updateUser,
  deleteUser,
} = require('../controllers/userControllers.js');

const router = express.Router();

// Auth endpoints
router.post('/auth/register', addNewUser);
router.post('/auth/login', loginUser);

// Legacy user endpoints (optional)
router.post('/users', addNewUser);
router.post('/users/login', loginUser);

router.get('/users', getUsers);
router.get('/users/:userId', getUserWithID);
router.put('/users/:userId', updateUser);
router.delete('/users/:userId', deleteUser);

module.exports = router;