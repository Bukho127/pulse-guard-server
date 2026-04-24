const PolicePersonnel = require('../models/policePersonnelModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');


const addPolicePersonnel = async (req, res) => {
  try {
    const officer = await PolicePersonnel.create(req.body);
    res.status(201).json(officer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const loginPolicePersonnel = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const officer = await PolicePersonnel.scope('withPassword').findOne({ where: { email } });

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
      where: { security_personnel_id: req.params.id },
      individualHooks: true
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
