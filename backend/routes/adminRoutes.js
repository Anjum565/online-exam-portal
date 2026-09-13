const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Submission = require('../models/Submission');
const { verifyToken, isTeacher } = require('../middleware/auth');
const { getIsConnected, memoryDb, saveStore } = require('../config/db');

// All admin routes require teacher/admin role
router.use(verifyToken, isTeacher);

// @route   GET /api/admin/students
// @desc    Get all students with verification status and submission counts
router.get('/students', async (req, res) => {
  try {
    if (getIsConnected()) {
      const students = await User.find({ role: 'student' }).sort({ createdAt: -1 }).select('-passwordHash');
      
      // Fetch submission counts
      const studentsWithStats = await Promise.all(students.map(async (st) => {
        const submissionCount = await Submission.countDocuments({ studentId: st._id });
        return {
          ...st.toObject(),
          id: st._id,
          submissionCount
        };
      }));

      const total = studentsWithStats.length;
      const verified = studentsWithStats.filter(s => s.isVerified).length;
      const pending = total - verified;

      return res.json({
        students: studentsWithStats,
        stats: { total, verified, pending }
      });
    } else {
      const students = memoryDb.users.filter(u => u.role === 'student');
      const studentsWithStats = students.map(st => {
        const subCount = memoryDb.submissions.filter(s => s.studentId === st.id || String(s.studentId) === String(st.id)).length;
        const { passwordHash, ...rest } = st;
        return {
          ...rest,
          submissionCount: subCount
        };
      });

      const total = studentsWithStats.length;
      const verified = studentsWithStats.filter(s => s.isVerified).length;
      const pending = total - verified;

      return res.json({
        students: studentsWithStats,
        stats: { total, verified, pending }
      });
    }
  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).json({ error: 'Failed to retrieve students list.' });
  }
});

// @route   PUT /api/admin/students/:id/verify
// @desc    Approve/verify a student to allow taking examinations
router.put('/students/:id/verify', async (req, res) => {
  try {
    const studentId = req.params.id;

    if (getIsConnected()) {
      const student = await User.findById(studentId);
      if (!student) return res.status(404).json({ error: 'Student not found.' });

      student.isVerified = true;
      student.verifiedAt = new Date();
      student.verifiedBy = req.user.id;
      await student.save();

      const { passwordHash, ...safeStudent } = student.toObject();
      return res.json({ message: `${student.name} has been verified successfully!`, student: safeStudent });
    } else {
      const student = memoryDb.users.find(u => u._id === studentId || u.id === studentId || String(u._id) === String(studentId));
      if (!student) return res.status(404).json({ error: 'Student not found.' });

      student.isVerified = true;
      student.verifiedAt = new Date();
      student.verifiedBy = req.user.id;
      saveStore();

      const { passwordHash, ...safeStudent } = student;
      return res.json({ message: `${student.name} has been verified successfully!`, student: safeStudent });
    }
  } catch (err) {
    console.error('Error verifying student:', err);
    res.status(500).json({ error: 'Failed to verify student.' });
  }
});

// @route   PUT /api/admin/students/:id/revoke
// @desc    Revoke student verification / suspend exam access
router.put('/students/:id/revoke', async (req, res) => {
  try {
    const studentId = req.params.id;

    if (getIsConnected()) {
      const student = await User.findById(studentId);
      if (!student) return res.status(404).json({ error: 'Student not found.' });

      student.isVerified = false;
      student.verifiedAt = null;
      await student.save();

      const { passwordHash, ...safeStudent } = student.toObject();
      return res.json({ message: `Verification revoked for ${student.name}.`, student: safeStudent });
    } else {
      const student = memoryDb.users.find(u => u._id === studentId || u.id === studentId || String(u._id) === String(studentId));
      if (!student) return res.status(404).json({ error: 'Student not found.' });

      student.isVerified = false;
      student.verifiedAt = null;
      saveStore();

      const { passwordHash, ...safeStudent } = student;
      return res.json({ message: `Verification revoked for ${student.name}.`, student: safeStudent });
    }
  } catch (err) {
    console.error('Error revoking student verification:', err);
    res.status(500).json({ error: 'Failed to update student verification.' });
  }
});

// @route   PUT /api/admin/students/verify-all
// @desc    1-Click approve all pending students at once
router.put('/students/verify-all', async (req, res) => {
  try {
    if (getIsConnected()) {
      await User.updateMany(
        { role: 'student', isVerified: false },
        { $set: { isVerified: true, verifiedAt: new Date(), verifiedBy: req.user.id } }
      );
      return res.json({ message: 'All pending students have been verified successfully at once!' });
    } else {
      memoryDb.users.forEach(u => {
        if (u.role === 'student' && !u.isVerified) {
          u.isVerified = true;
          u.verifiedAt = new Date();
          u.verifiedBy = req.user.id;
        }
      });
      saveStore();
      return res.json({ message: 'All pending students have been verified successfully at once!' });
    }
  } catch (err) {
    console.error('Error verifying all students:', err);
    res.status(500).json({ error: 'Failed to batch verify students.' });
  }
});

// @route   PUT /api/admin/students/verify-batch
// @desc    Approve selected student IDs at once
router.put('/students/verify-batch', async (req, res) => {
  try {
    const { studentIds = [] } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'No student IDs provided for batch approval.' });
    }

    if (getIsConnected()) {
      await User.updateMany(
        { _id: { $in: studentIds } },
        { $set: { isVerified: true, verifiedAt: new Date(), verifiedBy: req.user.id } }
      );
      return res.json({ message: `${studentIds.length} selected students approved successfully!` });
    } else {
      memoryDb.users.forEach(u => {
        if (studentIds.includes(u._id) || studentIds.includes(u.id)) {
          u.isVerified = true;
          u.verifiedAt = new Date();
          u.verifiedBy = req.user.id;
        }
      });
      saveStore();
      return res.json({ message: `${studentIds.length} selected students approved successfully!` });
    }
  } catch (err) {
    console.error('Error batch verifying students:', err);
    res.status(500).json({ error: 'Failed to approve selected students.' });
  }
});

// @route   DELETE /api/admin/students/:id
// @desc    Delete a student and their submissions
router.delete('/students/:id', async (req, res) => {
  try {
    const studentId = req.params.id;

    if (getIsConnected()) {
      try {
        if (mongoose.Types.ObjectId.isValid(studentId)) {
          await User.findByIdAndDelete(studentId);
          await Submission.deleteMany({ studentId });
        }
      } catch (dbErr) {
        console.warn('MongoDB delete warning:', dbErr.message);
      }
    }

    // Always ensure removed from local persistent memory store
    const idx = memoryDb.users.findIndex(u => String(u._id) === String(studentId) || String(u.id) === String(studentId));
    if (idx !== -1) memoryDb.users.splice(idx, 1);
    memoryDb.submissions = memoryDb.submissions.filter(s => String(s.studentId) !== String(studentId));
    saveStore();

    return res.json({ message: 'Student removed successfully.' });
  } catch (err) {
    console.error('Error deleting student:', err);
    res.status(500).json({ error: 'Failed to delete student.' });
  }
});

// @route   POST /api/admin/students/delete-batch
// @desc    Delete multiple selected students and their submissions
router.post('/students/delete-batch', async (req, res) => {
  try {
    const { studentIds = [] } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'No student IDs provided for batch deletion.' });
    }

    if (getIsConnected()) {
      try {
        const validIds = studentIds
          .filter(id => mongoose.Types.ObjectId.isValid(id))
          .map(id => new mongoose.Types.ObjectId(id));

        if (validIds.length > 0) {
          await User.deleteMany({ _id: { $in: validIds } });
          await Submission.deleteMany({ studentId: { $in: validIds } });
        }
      } catch (dbErr) {
        console.warn('MongoDB batch delete warning:', dbErr.message);
      }
    }

    // Always ensure removed from local persistent memory store
    const stringIds = studentIds.map(id => String(id));
    memoryDb.users = memoryDb.users.filter(u => !stringIds.includes(String(u._id)) && !stringIds.includes(String(u.id)));
    memoryDb.submissions = memoryDb.submissions.filter(s => !stringIds.includes(String(s.studentId)));
    saveStore();

    return res.json({ message: `${studentIds.length} student(s) removed permanently.` });
  } catch (err) {
    console.error('Error batch deleting students:', err);
    res.status(500).json({ error: 'Failed to delete selected students.' });
  }
});

// @route   GET /api/admin/ai-config
// @desc    Get status of Gemini AI configuration
router.get('/ai-config', async (req, res) => {
  const key = process.env.GEMINI_API_KEY || '';
  const isConfigured = key.length > 15 && !key.includes('YOUR_FREE_TIER_GEMINI_API_KEY');
  const preview = isConfigured ? (key.slice(0, 7) + '...' + key.slice(-4)) : null;
  res.json({
    isConfigured,
    preview,
    model: 'gemini-1.5-flash / gemini-2.0-flash'
  });
});

// @route   POST /api/admin/ai-config
// @desc    Save Google Gemini API Key
router.post('/ai-config', async (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey || apiKey.trim().length < 15) {
      return res.status(400).json({ error: 'Please provide a valid Gemini API key (usually starts with AIza...).' });
    }

    const cleanKey = apiKey.trim();
    process.env.GEMINI_API_KEY = cleanKey;

    // Update or append to backend/.env
    const fs = require('fs');
    const path = require('path');
    const envPath = path.resolve(__dirname, '../.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    if (envContent.includes('GEMINI_API_KEY=')) {
      envContent = envContent.replace(/GEMINI_API_KEY=.*/g, `GEMINI_API_KEY=${cleanKey}`);
    } else {
      envContent += `\nGEMINI_API_KEY=${cleanKey}\n`;
    }
    fs.writeFileSync(envPath, envContent, 'utf8');

    return res.json({
      message: 'Google Gemini AI Key connected successfully! AI question generation is now active.',
      isConfigured: true,
      preview: cleanKey.slice(0, 7) + '...' + cleanKey.slice(-4)
    });
  } catch (err) {
    console.error('Error saving AI config:', err);
    res.status(500).json({ error: 'Failed to update AI configuration.' });
  }
});

// @route   GET /api/admin/overview
// @desc    Get institutional summary across all departments (Admin only)
router.get('/overview', async (req, res) => {
  try {
    const Exam = require('../models/Exam');
    if (getIsConnected()) {
      const [totalStudents, totalTeachers, totalExams, totalSubmissions, examsList, studentsList] = await Promise.all([
        User.countDocuments({ role: 'student' }),
        User.countDocuments({ role: 'teacher' }),
        Exam.countDocuments(),
        Submission.countDocuments(),
        Exam.find().select('department'),
        User.find({ role: 'student' }).select('department')
      ]);

      const departmentsSet = new Set();
      examsList.forEach(e => { if (e.department) departmentsSet.add(e.department); });
      studentsList.forEach(s => { if (s.department) departmentsSet.add(s.department); });
      const departments = Array.from(departmentsSet);

      res.json({
        totalStudents,
        totalTeachers,
        totalExams,
        totalSubmissions,
        totalDepartments: departments.length,
        departments
      });
    } else {
      const totalStudents = memoryDb.users.filter(u => u.role === 'student').length;
      const totalTeachers = memoryDb.users.filter(u => u.role === 'teacher').length;
      const totalExams = memoryDb.exams.length;
      const totalSubmissions = memoryDb.submissions.length;
      const depts = Array.from(new Set([
        ...memoryDb.exams.map(e => e.department).filter(Boolean),
        ...memoryDb.users.map(u => u.department).filter(Boolean)
      ]));

      res.json({
        totalStudents,
        totalTeachers,
        totalExams,
        totalSubmissions,
        totalDepartments: depts.length,
        departments: depts
      });
    }
  } catch (err) {
    console.error('Error fetching admin overview:', err);
    res.status(500).json({ error: 'Failed to fetch institutional overview.' });
  }
});

// @route   GET /api/admin/teachers
// @desc    Get all teachers with their department and subjects
router.get('/teachers', async (req, res) => {
  try {
    if (getIsConnected()) {
      const teachers = await User.find({ role: 'teacher' }).sort({ createdAt: -1 }).select('-passwordHash');
      res.json({ teachers });
    } else {
      const teachers = memoryDb.users.filter(u => u.role === 'teacher').map(({ passwordHash, ...rest }) => rest);
      res.json({ teachers });
    }
  } catch (err) {
    console.error('Error fetching teachers:', err);
    res.status(500).json({ error: 'Failed to retrieve teachers.' });
  }
});

// @route   PUT /api/admin/teachers/:id/verify
// @desc    Approve/verify a faculty teacher to grant access to manage exams
router.put('/teachers/:id/verify', async (req, res) => {
  try {
    const teacherId = req.params.id;

    if (getIsConnected()) {
      const teacher = await User.findById(teacherId);
      if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });

      teacher.isVerified = true;
      teacher.verifiedAt = new Date();
      teacher.verifiedBy = req.user.id;
      await teacher.save();

      const { passwordHash, ...safeTeacher } = teacher.toObject();
      return res.json({ message: `${teacher.name} has been approved as faculty!`, teacher: safeTeacher });
    } else {
      const teacher = memoryDb.users.find(u => u._id === teacherId || u.id === teacherId || String(u._id) === String(teacherId));
      if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });

      teacher.isVerified = true;
      teacher.verifiedAt = new Date();
      teacher.verifiedBy = req.user.id;
      saveStore();

      const { passwordHash, ...safeTeacher } = teacher;
      return res.json({ message: `${teacher.name} has been approved as faculty!`, teacher: safeTeacher });
    }
  } catch (err) {
    console.error('Error verifying teacher:', err);
    res.status(500).json({ error: 'Failed to approve teacher.' });
  }
});

// @route   PUT /api/admin/teachers/:id/revoke
// @desc    Revoke teacher approval / suspend exam creation privileges
router.put('/teachers/:id/revoke', async (req, res) => {
  try {
    const teacherId = req.params.id;

    if (getIsConnected()) {
      const teacher = await User.findById(teacherId);
      if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });

      teacher.isVerified = false;
      teacher.verifiedAt = null;
      await teacher.save();

      const { passwordHash, ...safeTeacher } = teacher.toObject();
      return res.json({ message: `Access approval revoked for ${teacher.name}.`, teacher: safeTeacher });
    } else {
      const teacher = memoryDb.users.find(u => u._id === teacherId || u.id === teacherId || String(u._id) === String(teacherId));
      if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });

      teacher.isVerified = false;
      teacher.verifiedAt = null;
      saveStore();

      const { passwordHash, ...safeTeacher } = teacher;
      return res.json({ message: `Access approval revoked for ${teacher.name}.`, teacher: safeTeacher });
    }
  } catch (err) {
    console.error('Error revoking teacher:', err);
    res.status(500).json({ error: 'Failed to update teacher approval status.' });
  }
});

// @route   PUT /api/admin/teachers/verify-all
// @desc    1-Click approve all pending teachers at once
router.put('/teachers/verify-all', async (req, res) => {
  try {
    if (getIsConnected()) {
      await User.updateMany(
        { role: 'teacher', isVerified: false },
        { $set: { isVerified: true, verifiedAt: new Date(), verifiedBy: req.user.id } }
      );
      return res.json({ message: 'All pending faculty teachers approved successfully!' });
    } else {
      memoryDb.users.forEach(u => {
        if (u.role === 'teacher' && !u.isVerified) {
          u.isVerified = true;
          u.verifiedAt = new Date();
          u.verifiedBy = req.user.id;
        }
      });
      saveStore();
      return res.json({ message: 'All pending faculty teachers approved successfully!' });
    }
  } catch (err) {
    console.error('Error approving all teachers:', err);
    res.status(500).json({ error: 'Failed to approve all teachers.' });
  }
});

module.exports = router;
