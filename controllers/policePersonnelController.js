const PolicePersonnel = require('../models/policePersonnelModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');


const addPolicePersonnel = async (req, res) => {
  try {
    const officer = await PolicePersonnel.create(req.body);
    res.status(201).json(officer);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      const details = err.errors.map(e => {
        const dbField = e.path || e.origin && e.origin.column || null;
        const field = dbField === 'badge_number' ? 'force_number' : dbField;
        return { field, value: e.value, message: `${field || dbField} must be unique` };
      });
      return res.status(400).json({ error: 'Unique constraint error', details });
    }
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ error: 'Validation error', details: err.errors.map(e => e.message) });
    }
    res.status(500).json({ error: err.message });
  }
};

const formatForceNumber = (value) => {
  if (!value) return value;
  const digits = String(value).replace(/\D/g, '');
  return digits.length === 8 ? `${digits.slice(0, 7)}-${digits.slice(7)}` : String(value);
};

const loginPolicePersonnel = async (req, res) => {
  try {
    const { force_number, password } = req.body;
    const normalizedForceNumber = formatForceNumber(force_number);

    if (!normalizedForceNumber || !password) {
      return res.status(400).json({ message: 'Force number and password are required' });
    }

    const officer = await PolicePersonnel.scope('withPassword').findOne({ where: { force_number: normalizedForceNumber } });

    if (!officer) {
      return res.status(404).json({ message: 'Officer not found' });
    }

    const isMatch = await bcrypt.compare(password, officer.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        security_personnel_id: officer.security_personnel_id,
        role: 'personnel'
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ token });
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
    const officer = await PolicePersonnel.findById(req.params.id);

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
      where: { security_personnel_id: req.params.id },
      individualHooks: true
    });

    if (!updated) {
      return res.status(404).json({ message: 'Officer not found' });
    }

    const updatedOfficer = await PolicePersonnel.findById(req.params.id);
    res.json(updatedOfficer);
  } catch (err) {
    if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Validation error', details: err.errors.map(e => e.message) });
    }
    res.status(500).json({ error: err.message });
  }
};

const deletePolicePersonnel = async (req, res) => {
  try {
    const deleted = await PolicePersonnel.destroy({
      where: { security_personnel_id: req.params.id }
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
  loginPolicePersonnel,
  getAllPolicePersonnel,
  getPoliceById,
  updatePolicePersonnel,
  deletePolicePersonnel
};
