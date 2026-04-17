const PolicePersonnel = require('../models/policePersonnelModel');

// CREATE
const addPolicePersonnel = async (req, res) => {
  try {
    const officer = await PolicePersonnel.create(req.body);
    res.status(201).json(officer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getAllPolicePersonnel = async (req, res) => {
  try {
    const officers = await PolicePersonnel.findAll();
    res.json(officers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getPoliceById = async (req, res) => {
  try {
    const officer = await PolicePersonnel.findByPk(req.params.id);

    if (!officer) {
      return res.status(404).json({ message: 'Officer not found' });
    }

    res.json(officer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updatePolicePersonnel = async (req, res) => {
  try {
    const [updated] = await PolicePersonnel.update(req.body, {
      where: { security_personnel_id: req.params.id }
    });

    if (!updated) {
      return res.status(404).json({ message: 'Officer not found' });
    }

    const updatedOfficer = await PolicePersonnel.findByPk(req.params.id);
    res.json(updatedOfficer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deletePolicePersonnel = async (req, res) => {
  try {
    const deleted = await PolicePersonnel.destroy({
      where: { id: req.params.id }
    });

    if (!deleted) {
      return res.status(404).json({ message: 'Officer not found' });
    }

    res.json({ message: 'Officer deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  addPolicePersonnel,
  getAllPolicePersonnel,
  getPoliceById,
  updatePolicePersonnel,
  deletePolicePersonnel
};