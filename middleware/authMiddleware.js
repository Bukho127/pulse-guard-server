
const jwt = require('jsonwebtoken');
require('dotenv').config();

const protect = (req, res, next) => {

  console.log('PROTECT MIDDLEWARE - Headers:', req.headers);
  console.log('PROTECT MIDDLEWARE - Auth header:', req.headers.authorization);

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Access token required' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });


    req.user = {
      id: decoded.userId || decoded.security_personnel_id,
      security_personnel_id: decoded.security_personnel_id,  
      user_id: decoded.userId, 
      role: decoded.role
    };


    next();
  });
};

const authorizeUser = (req, res, next) => {
  if (req.user?.role !== 'user') return res.status(403).json({ message: 'Not authorized' });
  next();
};

const authorizePersonnel = (req, res, next) => {
  console.log('AUTHORIZE PERSONNEL - req.user:', req.user);
  console.log('AUTHORIZE PERSONNEL - req.user.role:', req.user?.role);
  if (req.user?.role !== 'personnel') return res.status(403).json({ message: 'Not authorized' });
  next();
};

module.exports = { protect, authorizeUser, authorizePersonnel };
