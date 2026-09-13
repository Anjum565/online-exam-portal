const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'free_tier_exam_system_jwt_secret_key_change_in_production_2026';

const verifyToken = (req, res, next) => {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No authentication token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
};

const isTeacher = (req, res, next) => {
  if (!req.user || (req.user.role !== 'teacher' && req.user.role !== 'admin')) {
    return res.status(403).json({ error: 'Forbidden. Teacher or Administrator authorization required for this action.' });
  }
  next();
};

const isTeacherOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Forbidden. Teacher authorization required for this action.' });
  }
  next();
};

const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden. Administrator authorization required for this action.' });
  }
  next();
};

const isStudent = (req, res, next) => {
  if (!req.user || req.user.role !== 'student') {
    return res.status(403).json({ error: 'Forbidden. Student authorization required for this action.' });
  }
  next();
};

module.exports = {
  verifyToken,
  isTeacher,
  isTeacherOnly,
  isAdmin,
  isStudent,
  JWT_SECRET
};
