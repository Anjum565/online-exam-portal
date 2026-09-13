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

// @route   DELETE /api/admin/teachers/:id
// @desc    Permanently delete a teacher account (Admin only)
router.delete('/teachers/:id', async (req, res) => {
  try {
    const teacherId = req.params.id;

    if (getIsConnected()) {
      try {
        if (mongoose.Types.ObjectId.isValid(teacherId)) {
          const teacher = await User.findById(teacherId);
          if (!teacher) return res.status(404).json({ error: 'Teacher account not found.' });
          if (teacher.role === 'admin') {
            return res.status(400).json({ error: 'Cannot delete an administrator account.' });
          }
          await User.findByIdAndDelete(teacherId);
        }
      } catch (dbErr) {
        console.warn('MongoDB teacher delete warning:', dbErr.message);
      }
    }

    // Always remove from local persistent memory store
    const idx = memoryDb.users.findIndex(u => (String(u._id) === String(teacherId) || String(u.id) === String(teacherId)) && u.role === 'teacher');
    if (idx !== -1) {
      memoryDb.users.splice(idx, 1);
      saveStore();
    }

    return res.json({ message: 'Teacher account deleted permanently.' });
  } catch (err) {
    console.error('Error deleting teacher:', err);
    res.status(500).json({ error: 'Failed to delete teacher account.' });
  }
});

// @route   DELETE /api/admin/exams/:id
// @desc    Permanently delete an examination and its student submissions (Admin only)
router.delete('/exams/:id', async (req, res) => {
  try {
    const examId = req.params.id;
    const Exam = require('../models/Exam');

    if (getIsConnected()) {
      try {
        let deletedExam = null;
        if (mongoose.Types.ObjectId.isValid(examId)) {
          deletedExam = await Exam.findByIdAndDelete(examId);
        }
        if (!deletedExam) {
          deletedExam = await Exam.findOneAndDelete({
            $or: [{ id: examId }, { examCode: String(examId).toUpperCase() }]
          });
        }
        // Delete all submissions associated with this exam
        await Submission.deleteMany({
          $or: [
            { examId },
            ...(mongoose.Types.ObjectId.isValid(examId) ? [{ examId: new mongoose.Types.ObjectId(examId) }] : [])
          ]
        });
      } catch (dbErr) {
        console.warn('MongoDB exam delete warning:', dbErr.message);
      }
    }

    // Remove from local persistent memory store
    const examIdx = memoryDb.exams.findIndex(e => String(e._id) === String(examId) || String(e.id) === String(examId) || e.examCode === String(examId).toUpperCase());
    if (examIdx !== -1) {
      memoryDb.exams.splice(examIdx, 1);
    }
    memoryDb.submissions = memoryDb.submissions.filter(s => String(s.examId) !== String(examId));
    saveStore();

    return res.json({ message: 'Examination and all related student submissions deleted permanently.' });
  } catch (err) {
    console.error('Error deleting exam:', err);
    res.status(500).json({ error: 'Failed to delete examination.' });
  }
});

// @route   GET /api/admin/reports/department-results
// @desc    Get departmental examination results with statistics for institutional reporting and printouts
router.get('/reports/department-results', async (req, res) => {
  try {
    const { department, course, semester, subject, search } = req.query;
    const Exam = require('../models/Exam');
    const { enrichSubmissions } = require('./gradingRoutes');

    let examQuery = {};
    if (department && department !== 'ALL') {
      examQuery.department = department;
    }
    if (course && course !== 'ALL') {
      examQuery.course = course;
    }
    if (semester && semester !== 'ALL') {
      examQuery.semester = semester;
    }
    if (subject && subject !== 'ALL') {
      examQuery.subject = subject;
    }

    let matchingExams = [];
    if (getIsConnected()) {
      matchingExams = await Exam.find(examQuery).select('_id id title examCode subject department course semester totalMarks passingPercentage');
    } else {
      matchingExams = memoryDb.exams.filter(e => {
        if (department && department !== 'ALL' && e.department !== department) return false;
        if (course && course !== 'ALL' && e.course !== course) return false;
        if (semester && semester !== 'ALL' && e.semester !== semester) return false;
        if (subject && subject !== 'ALL' && e.subject !== subject) return false;
        return true;
      });
    }

    const examIds = matchingExams.map(e => e._id || e.id);
    const examIdsStrings = examIds.map(id => String(id));

    let rawSubmissions = [];
    if (getIsConnected()) {
      rawSubmissions = await Submission.find({
        $or: [
          { examId: { $in: examIds } },
          { examId: { $in: examIdsStrings } }
        ]
      }).sort({ submittedAt: -1 });
    } else {
      rawSubmissions = memoryDb.submissions.filter(s => examIdsStrings.includes(String(s.examId)));
    }

    let enriched = await enrichSubmissions(rawSubmissions);

    // Apply secondary filters on enriched results if needed
    if (department && department !== 'ALL') {
      enriched = enriched.filter(s => s.studentDepartment && s.studentDepartment.toLowerCase() === department.toLowerCase());
    }
    if (course && course !== 'ALL') {
      enriched = enriched.filter(s => s.studentCourse && s.studentCourse.toLowerCase() === course.toLowerCase());
    }
    if (semester && semester !== 'ALL') {
      enriched = enriched.filter(s => s.studentSemester && s.studentSemester.toLowerCase() === semester.toLowerCase());
    }
    if (subject && subject !== 'ALL') {
      enriched = enriched.filter(s => s.subject && s.subject.toLowerCase() === subject.toLowerCase());
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      enriched = enriched.filter(s =>
        (s.studentName && s.studentName.toLowerCase().includes(q)) ||
        (s.studentRollNumber && s.studentRollNumber.toLowerCase().includes(q)) ||
        (s.studentEmail && s.studentEmail.toLowerCase().includes(q)) ||
        (s.examTitle && s.examTitle.toLowerCase().includes(q))
      );
    }

    // Compute Departmental Institutional Analytics
    const totalCandidates = enriched.length;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalTerminated = 0;
    let sumPercentage = 0;

    enriched.forEach(sub => {
      const passing = sub.examPassingPercentage || 40;
      const pct = sub.percentage !== undefined ? sub.percentage : (sub.examTotalMarks ? Math.round(((sub.marksObtained || 0) / sub.examTotalMarks) * 100) : 0);
      sumPercentage += pct;

      if (sub.status === 'terminated' || sub.isTerminated) {
        totalTerminated++;
        totalFailed++;
      } else if (sub.passed || pct >= passing) {
        totalPassed++;
      } else {
        totalFailed++;
      }
    });

    const passPercentage = totalCandidates > 0 ? Math.round((totalPassed / totalCandidates) * 100) : 0;
    const averageScore = totalCandidates > 0 ? Math.round((sumPercentage / totalCandidates) * 10) / 10 : 0;

    // Collect available unique filter options across institutional records
    let allExams = [];
    if (getIsConnected()) {
      allExams = await Exam.find().select('department course semester subject');
    } else {
      allExams = memoryDb.exams;
    }

    const availableDepartments = Array.from(new Set(allExams.map(e => e.department).filter(Boolean)));
    const availableCourses = Array.from(new Set(allExams.map(e => e.course).filter(Boolean)));
    const availableSemesters = Array.from(new Set(allExams.map(e => e.semester).filter(Boolean)));
    const availableSubjects = Array.from(new Set(allExams.map(e => e.subject).filter(Boolean)));

    return res.json({
      results: enriched,
      analytics: {
        totalCandidates,
        totalPassed,
        totalFailed,
        totalTerminated,
        passPercentage,
        averageScore
      },
      filterOptions: {
        departments: availableDepartments,
        courses: availableCourses,
        semesters: availableSemesters,
        subjects: availableSubjects
      }
    });
  } catch (err) {
    console.error('Error generating department report:', err);
    res.status(500).json({ error: 'Failed to generate department results report.' });
  }
});

module.exports = router;


