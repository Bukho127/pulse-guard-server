const express = require('express');

const {
  addPolicePersonnel,
  getAllPolicePersonnel,
  getPoliceById,
  updatePolicePersonnel,
  deletePolicePersonnel
} = require('../controllers/policePersonnelController');

const router = express.Router();

// CREATE (register officer)
router.post('/police', addPolicePersonnel);
router.get('/police', getAllPolicePersonnel);
router.get('/police/:id', getPoliceById);
router.put('/police/:id', updatePolicePersonnel);
router.delete('/police/:id', deletePolicePersonnel);

module.exports = router;