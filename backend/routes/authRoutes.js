const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyToken, JWT_SECRET } = require('../middleware/auth');
const { getIsConnected, memoryDb, saveStore } = require('../config/db');

// @route   POST /api/auth/register
// @desc    Register new user (Teacher or Student)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, rollNumber, department, course, semester, subjects } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please enter all required fields (name, email, password).' });
    }

    const trimmedDept = (department && typeof department === 'string' && department.trim()) ? department.trim() : '';
    if (!trimmedDept) {
      return res.status(400).json({ error: 'Department is required for registration.' });
    }

    const userRole = role === 'admin' ? 'admin' : (role === 'teacher' ? 'teacher' : 'student');
    const emailLower = email.toLowerCase().trim();
    // Admin accounts are auto-verified; teachers and students start as pending admin approval
    const isVerified = userRole === 'admin' ? true : false;

    // Parse subjects if provided (especially for teachers)
    let parsedSubjects = [];
    if (Array.isArray(subjects)) {
      parsedSubjects = subjects.map(s => String(s).trim()).filter(Boolean);
    } else if (typeof subjects === 'string' && subjects.trim()) {
      parsedSubjects = subjects.split(',').map(s => s.trim()).filter(Boolean);
    }

    const trimmedCourse = (course && typeof course === 'string') ? course.trim() : '';
    const trimmedSemester = (semester && typeof semester === 'string') ? semester.trim() : '';

    // Check if connected to MongoDB Atlas
    if (getIsConnected()) {
      const existingUser = await User.findOne({ email: emailLower });
      if (existingUser) {
        return res.status(400).json({ error: 'An account with this email address already exists.' });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const newUser = new User({
        name: name.trim(),
        email: emailLower,
        passwordHash,
        role: userRole,
        department: trimmedDept,
        course: trimmedCourse,
        semester: trimmedSemester,
        subjects: parsedSubjects,
        isVerified,
        rollNumber: rollNumber ? rollNumber.trim() : ''
      });

      await newUser.save();

      const tokenPayload = {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department,
        course: newUser.course,
        semester: newUser.semester,
        subjects: newUser.subjects,
        isVerified: newUser.isVerified
      };

      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

      return res.status(201).json({
        token,
        user: tokenPayload
      });
    } else {
      // In-Memory Fallback
      const existing = memoryDb.users.find(u => u.email === emailLower);
      if (existing) {
        return res.status(400).json({ error: 'An account with this email address already exists.' });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const mockId = 'usr_' + Date.now() + Math.floor(Math.random() * 1000);
      const newUser = {
        id: mockId,
        _id: mockId,
        name: name.trim(),
        email: emailLower,
        passwordHash,
        role: userRole,
        department: trimmedDept,
        course: trimmedCourse,
        semester: trimmedSemester,
        subjects: parsedSubjects,
        isVerified,
        rollNumber: rollNumber ? rollNumber.trim() : '',
        createdAt: new Date()
      };
      memoryDb.users.push(newUser);
      saveStore();

      const tokenPayload = {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department,
        course: newUser.course,
        semester: newUser.semester,
        subjects: newUser.subjects,
        isVerified: newUser.isVerified
      };

      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

      return res.status(201).json({
        token,
        user: tokenPayload
      });
    }
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & return JWT token
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Please enter both email and password.' });
    }

    const emailLower = email.toLowerCase().trim();

    let user;
    if (getIsConnected()) {
      user = await User.findOne({ email: emailLower });
    } else {
      user = memoryDb.users.find(u => u.email === emailLower);
    }

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials. User not found.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials. Password incorrect.' });
    }

    const userId = user._id || user.id;
    // By default demo student is verified, newly registered students are verified if isVerified === true
    const isVerified = user.isVerified !== undefined ? user.isVerified : true;
    const userRole = (emailLower === 'admin@gmail.com' || emailLower === 'admin@test.com') ? 'admin' : user.role;
    const department = user.department || 'General';
    const course = user.course || '';
    const semester = user.semester || '';
    const subjects = user.subjects || [];

    const tokenPayload = {
      id: userId,
      name: user.name,
      email: user.email,
      role: userRole,
      department,
      course,
      semester,
      subjects,
      isVerified
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: tokenPayload
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during authentication.' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile with live verification status
router.get('/me', verifyToken, async (req, res) => {
  try {
    let user;
    if (getIsConnected()) {
      user = await User.findById(req.user.id).select('-passwordHash');
    } else {
      user = memoryDb.users.find(u => (u._id === req.user.id || u.id === req.user.id));
    }

    if (!user) {
      return res.json({ user: req.user });
    }

    const userObj = user.toObject ? user.toObject() : user;
    const { passwordHash, ...safeUser } = userObj;
    if (safeUser.email === 'admin@gmail.com' || safeUser.email === 'admin@test.com') {
      safeUser.role = 'admin';
    }
    res.json({ user: safeUser });
  } catch (err) {
    const fallback = { ...req.user };
    if (fallback.email === 'admin@gmail.com' || fallback.email === 'admin@test.com') {
      fallback.role = 'admin';
    }
    res.json({ user: fallback });
  }
});

module.exports = router;
