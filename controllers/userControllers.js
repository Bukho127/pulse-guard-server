const User = require('../models/userModel');
const EmailVerificationOtp = require('../models/emailVerificationOtpModel');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { sequelize } = require('../config/db');
const { sendVerificationEmail } = require('../services/emailService');

const googleClient = new OAuth2Client(process.env.GOOGLE_WEB_CLIENT_ID);
const OTP_EXPIRY_MINUTES = Number(process.env.EMAIL_OTP_EXPIRY_MINUTES || 10);
const MAX_OTP_ATTEMPTS = Number(process.env.EMAIL_OTP_MAX_ATTEMPTS || 5);

const canAccessUser = (req, userId) => (
  req.user?.role === 'personnel' || Number(req.user?.user_id) === Number(userId)
);

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const generateOtp = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

const createUserToken = (user) => (
  jwt.sign({ user_id: user.user_id, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '1h' })
);

const sanitizeUser = (user) => {
  const plainUser = user?.toJSON ? user.toJSON() : user;
  if (!plainUser) return plainUser;
  delete plainUser.password;
  return plainUser;
};

const issueEmailVerificationOtp = async (user, options = {}) => {
  const transaction = options.transaction;
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  const otpHash = await bcrypt.hash(otp, 10);

  await EmailVerificationOtp.update(
    { consumed_at: new Date() },
    {
      where: {
        user_id: user.user_id,
        consumed_at: null
      },
      transaction
    }
  );

  await EmailVerificationOtp.create(
    {
      user_id: user.user_id,
      email: user.email,
      otp_hash: otpHash,
      expires_at: expiresAt,
      attempts: 0
    },
    { transaction }
  );

  return { otp, expiresAt };
};

// CREATE
const addNewUser = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const fullName = String(req.body.full_name || req.body.name || '').trim();
    const { password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'Full name, email, and password are required' });
    }

    let verification;

    await sequelize.transaction(async (transaction) => {
      const user = await User.create(
        {
          full_name: fullName,
          email,
          password,
          email_verified: false
        },
        { transaction }
      );

      verification = await issueEmailVerificationOtp(user, { transaction });
    });

    await sendVerificationEmail({
      email,
      otp: verification.otp,
      expiresAt: verification.expiresAt
    });

    res.json({
      requiresEmailVerification: true,
      email,
      message: 'Verification code sent to your email.'
    });
  } catch (err) {
    if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: err.errors.map((e) => e.message) });
    }
    res.status(500).json({ error: err.message });
  }
};

// LOGIN
const loginUser = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    const user = await User.scope('withPassword').findOne({ where: { email } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.password) return res.status(401).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    if (!user.email_verified) {
      return res.status(403).json({ message: 'Please verify your email before signing in.' });
    }

    const token = createUserToken(user);
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || req.body.code || '').trim();

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and verification code are required' });
    }

    const user = await User.findOne({ where: { email } });
    const pendingOtp = await EmailVerificationOtp.findOne({
      where: {
        email,
        consumed_at: null
      },
      order: [
        ['created_at', 'DESC'],
        ['id', 'DESC']
      ]
    });

    if (!user || !pendingOtp) {
      return res.status(400).json({ message: 'Verification code is invalid or has expired.' });
    }

    if (pendingOtp.expires_at <= new Date()) {
      await pendingOtp.updateAttributes({ consumed_at: new Date() });
      return res.status(400).json({ message: 'Verification code is invalid or has expired.' });
    }

    if (pendingOtp.attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({ message: 'Too many verification attempts. Request a new code.' });
    }

    const isMatch = await bcrypt.compare(otp, pendingOtp.otp_hash);
    if (!isMatch) {
      const attempts = pendingOtp.attempts + 1;
      await pendingOtp.updateAttributes({ attempts });

      if (attempts >= MAX_OTP_ATTEMPTS) {
        return res.status(429).json({ message: 'Too many verification attempts. Request a new code.' });
      }

      return res.status(401).json({ message: 'Verification code is invalid or has expired.' });
    }

    await sequelize.transaction(async (transaction) => {
      await User.update(
        { email_verified: true },
        {
          where: { user_id: user.user_id },
          transaction
        }
      );

      await EmailVerificationOtp.update(
        { consumed_at: new Date() },
        {
          where: { id: pendingOtp.id },
          transaction
        }
      );
    });

    const verifiedUser = await User.findById(user.user_id);
    const token = createUserToken(verifiedUser);

    res.json({
      token,
      user: sanitizeUser(verifiedUser),
      message: 'Email verified successfully.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const resendVerification = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.json({ message: 'If the account exists, a new verification code has been sent.' });
    }

    if (user.email_verified) {
      return res.json({ message: 'Email is already verified.' });
    }

    const verification = await sequelize.transaction(async (transaction) => (
      issueEmailVerificationOtp(user, { transaction })
    ));

    await sendVerificationEmail({
      email,
      otp: verification.otp,
      expiresAt: verification.expiresAt
    });

    res.json({ message: 'A new verification code has been sent.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// GOOGLE AUTH
const googleAuth = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: 'idToken is required' });

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_WEB_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, name } = payload;
    const email = normalizeEmail(payload.email);

    let user = await User.findOne({ where: { googleId } });

    if (!user) {
      user = await User.findOne({ where: { email } });

      if (user) {
        user.googleId = googleId;
        user.email_verified = true;
        await user.save();
      } else {
        user = await User.create({ full_name: name, email, googleId, email_verified: true });
      }
    }

    const token = createUserToken(user);
    res.json({ token });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.user_id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET ALL
const getUsers = async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET ONE
const getUserWithID = async (req, res) => {
  try {
    if (!canAccessUser(req, req.params.userId)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE
const updateUser = async (req, res) => {
  try {
    if (!canAccessUser(req, req.params.userId)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const [updated] = await User.update(req.body, {
      where: { user_id: req.params.userId },
      individualHooks: true
    });

    if (!updated) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updatedUser = await User.findById(req.params.userId);
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE
const deleteUser = async (req, res) => {
  try {
    if (!canAccessUser(req, req.params.userId)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const deleted = await User.destroy({
      where: { user_id: req.params.userId }
    });

    if (!deleted) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


module.exports = {
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
};
