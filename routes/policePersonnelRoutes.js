const express = require('express');

const {
  addPolicePersonnel,
  loginPolicePersonnel,
  getAllPolicePersonnel,
  getPoliceById,
  updatePolicePersonnel,
  deletePolicePersonnel,
  getCurrentPersonnel
} = require('../controllers/policePersonnelController');
const { protect, authorizePersonnel } = require('../middleware/authMiddleware');

const router = express.Router();

// CREATE (register officer)
router.post('/auth/personnel/login', loginPolicePersonnel);
router.post('/police/login', loginPolicePersonnel);
router.post('/police', addPolicePersonnel);
router.get('/police', protect, authorizePersonnel, getAllPolicePersonnel);
router.get('/police/me', protect, getCurrentPersonnel);
router.get('/police/:id', protect, authorizePersonnel, getPoliceById);
router.put('/police/:id', protect, authorizePersonnel, updatePolicePersonnel);
router.delete('/police/:id', protect, authorizePersonnel, deletePolicePersonnel);

module.exports = router;
