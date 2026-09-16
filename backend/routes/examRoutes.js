const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Exam = require('../models/Exam');
const Submission = require('../models/Submission');
const { verifyToken, isTeacher } = require('../middleware/auth');
const { generateQuestionsFromLLM } = require('../services/geminiService');
const { getIsConnected, memoryDb, saveStore } = require('../config/db');
const { getSeededRandomQuestions } = require('../utils/randomSampler');

// Safe helper to find exam in Mongo or memoryDb without ObjectId CastError
async function findExam(examId) {
  if (!examId) return null;
  let exam = null;
  if (getIsConnected()) {
    try {
      if (mongoose.Types.ObjectId.isValid(examId)) {
        exam = await Exam.findById(examId);
      }
      if (!exam) {
        exam = await Exam.findOne({
          $or: [
            { examCode: String(examId).toUpperCase() },
            { id: examId },
            { _id: examId }
          ]
        });
      }
    } catch (e) {}
  }
  if (!exam) {
    exam = memoryDb.exams.find(e => (
      e._id === examId ||
      e.id === examId ||
      String(e._id) === String(examId) ||
      String(e.id) === String(examId) ||
      (e.examCode && e.examCode.toUpperCase() === String(examId).toUpperCase())
    )) || null;
  }
  return exam;
}

// Helper to generate a clean, uppercase 6-char exam code
function generateExamCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Strictly verifies that a teacher only accesses exams within their own department
function isTeacherAllowedForExam(user, exam) {
  if (!user || !exam) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'teacher') {
    const teacherDept = user.department || 'General';
    const examDept = exam.department || 'General';
    return teacherDept === examDept;
  }
  return true;
}

// Strictly verifies that a student only accesses exams matching BOTH their department and course
function isStudentEligibleForExam(student, exam) {
  if (!student || !exam) return { eligible: false, reason: 'Invalid student or exam.' };
  if (student.role !== 'student') return { eligible: true };

  // 1. Department match
  const studentDept = (student.department || '').trim();
  const examDept = (exam.department || '').trim();
  if (examDept && examDept !== 'General' && studentDept && studentDept !== 'General') {
    if (studentDept.toLowerCase() !== examDept.toLowerCase()) {
      return {
        eligible: false,
        reason: `This exam is restricted to candidates from the "${examDept}" department. Your registered department is "${studentDept}".`
      };
    }
  }

  // 2. Course match (Strict: students of same department but different course are BLOCKED)
  const studentCourse = (student.course || '').trim();
  const examCourse = (exam.course || '').trim();
  if (examCourse && examCourse !== 'All Courses' && examCourse !== 'Other') {
    if (!studentCourse || studentCourse.toLowerCase() !== examCourse.toLowerCase()) {
      return {
        eligible: false,
        reason: `This examination is strictly restricted to "${examCourse}" candidates. Your registered course is "${studentCourse || 'Not Assigned'}". Candidates from other courses cannot access or sit for this examination.`
      };
    }
  }

  // 3. Semester match (if exam specifies a specific semester)
  const studentSem = (student.semester || '').trim();
  const examSem = (exam.semester || '').trim();
  if (examSem && examSem !== 'All Semesters' && examSem !== 'Other') {
    if (!studentSem || studentSem.toLowerCase() !== examSem.toLowerCase()) {
      return {
        eligible: false,
        reason: `This examination is scheduled for "${examSem}" candidates. Your registered semester is "${studentSem || 'Not Assigned'}".`
      };
    }
  }

  return { eligible: true };
}

// @route   GET /api/exams
// @desc    Get exams (Teachers see all created exams; Students see active/published exams matching their department & course)
router.get('/', verifyToken, async (req, res) => {
  try {
    if (getIsConnected()) {
      if (req.user.role === 'admin') {
        const query = req.query.department ? { department: req.query.department } : {};
        const exams = await Exam.find(query).sort({ createdAt: -1 });
        return res.json(exams);
      } else if (req.user.role === 'teacher') {
        // Teacher strictly only sees exams from their own department
        const teacherDept = req.user.department || 'General';
        const exams = await Exam.find({ department: teacherDept }).sort({ createdAt: -1 });
        return res.json(exams);
      } else {
        const studentDept = req.user.department;
        const studentCourse = (req.user.course || '').trim();
        const query = { status: { $in: ['published', 'completed'] } };
        if (studentDept && studentDept !== 'General') {
          query.department = { $in: [studentDept, 'General'] };
        }
        if (studentCourse && studentCourse !== 'All Courses') {
          query.course = { $in: [studentCourse, 'All Courses', '', null] };
        } else if (!studentCourse) {
          query.course = { $in: ['All Courses', '', null] };
        }
        const candidateExams = await Exam.find(query).sort({ startTime: 1 });
        const eligibleExams = candidateExams.filter(exam => isStudentEligibleForExam(req.user, exam).eligible);
        return res.json(eligibleExams);
      }
    } else {
      if (req.user.role === 'admin') {
        const queryDept = req.query.department;
        const exams = queryDept ? memoryDb.exams.filter(e => e.department === queryDept) : memoryDb.exams;
        return res.json(exams);
      } else if (req.user.role === 'teacher') {
        const teacherDept = req.user.department || 'General';
        const exams = memoryDb.exams.filter(e => e.department === teacherDept);
        return res.json(exams);
      } else {
        const candidateExams = memoryDb.exams.filter(e => ['published', 'completed'].includes(e.status));
        const eligibleExams = candidateExams.filter(exam => isStudentEligibleForExam(req.user, exam).eligible);
        return res.json(eligibleExams);
      }
    }
  } catch (err) {
    console.error('Error fetching exams:', err);
    res.status(500).json({ error: 'Failed to retrieve exams.' });
  }
});

// @route   GET /api/exams/code/:code
// @desc    Find an exam by its exam code (for student quick-join with course/department verification)
router.get('/code/:code', verifyToken, async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    let exam;

    if (getIsConnected()) {
      exam = await Exam.findOne({ examCode: code, status: { $in: ['published', 'completed'] } });
    } else {
      exam = memoryDb.exams.find(e => e.examCode === code && ['published', 'completed'].includes(e.status));
    }

    if (!exam) {
      return res.status(404).json({ error: `No active exam found with code "${code}".` });
    }

    // Role eligibility check: Verify department & course match for students
    if (req.user.role === 'student') {
      const eligibility = isStudentEligibleForExam(req.user, exam);
      if (!eligibility.eligible) {
        return res.status(403).json({ error: eligibility.reason, isCourseMismatch: true });
      }
    }

    res.json(exam);
  } catch (err) {
    console.error('Error finding exam by code:', err);
    res.status(500).json({ error: 'Failed to search for exam code.' });
  }
});

// @route   POST /api/exams
// @desc    Create a new exam draft definition (Teacher only, strictly locked to teacher department)
router.post('/', verifyToken, isTeacher, async (req, res) => {
  try {
    const {
      title,
      subject,
      topic,
      examCode,
      examType = 'combined_objective',
      questionComposition = 'combined_objective',
      difficulty = 'medium',
      questionCount = 5,
      durationMinutes = 30,
      passingPercentage = 40,
      startTime,
      endTime
    } = req.body;

    if (!title || !subject || !topic || !startTime || !endTime) {
      return res.status(400).json({ error: 'Missing required exam parameters (title, subject, topic, startTime, endTime).' });
    }

    // Role Enforcement: Only Teachers can create exams; Admin is view-only
    if (req.user.role === 'admin') {
      return res.status(403).json({
        error: 'Administrator accounts have view-only access. Exam question creation is strictly reserved for department teachers.'
      });
    }

    // Teacher Approval Enforcement: Must be approved by administrator (checked against live DB status)
    let isTeacherVerified = req.user.isVerified;
    const User = require('../models/User');
    if (getIsConnected()) {
      const teacherUser = await User.findById(req.user.id);
      if (teacherUser) isTeacherVerified = (teacherUser.isVerified ?? true);
    } else {
      const teacherUser = memoryDb.users.find(u => u._id === req.user.id || u.id === req.user.id);
      if (teacherUser) isTeacherVerified = (teacherUser.isVerified ?? true);
    }
    if (isTeacherVerified === false) {
      return res.status(403).json({
        error: 'Your faculty account is pending administrative approval. The institution administrator must approve your account before you can create examinations.',
        isPendingApproval: true
      });
    }

    // Strictly assign department based on teacher profile
    const targetDepartment = req.user.department || 'General';

    const course = req.body.course || req.user.course || '';
    const semester = req.body.semester || req.user.semester || '';

    const assignedCode = (examCode && typeof examCode === 'string' && examCode.trim().length > 0) ? examCode.trim().toUpperCase() : generateExamCode();

    const preProvidedQuestions = Array.isArray(req.body.questions) && req.body.questions.length > 0 ? req.body.questions : [];
    
    // If teacher provided questions (e.g. 50 in pool), questionCount sets how many questions each student receives (e.g. 10)
    const targetQuestionCount = req.body.questionCount && parseInt(req.body.questionCount, 10) > 0
      ? parseInt(req.body.questionCount, 10)
      : (preProvidedQuestions.length > 0 ? preProvidedQuestions.length : 5);

    const avgMarks = preProvidedQuestions.length > 0 ? (Number(preProvidedQuestions[0]?.maxMarks) || 2) : 2;
    const calculatedTotal = targetQuestionCount * avgMarks;

    const examData = {
      title,
      department: targetDepartment,
      course,
      semester,
      subject,
      topic,
      examCode: assignedCode,
      examType: examType || 'combined_objective',
      questionComposition: questionComposition || examType || 'combined_objective',
      difficulty,
      questionCount: targetQuestionCount,
      randomizeQuestions: req.body.randomizeQuestions !== undefined ? Boolean(req.body.randomizeQuestions) : true,
      durationMinutes: parseInt(durationMinutes) || 30,
      passingPercentage: parseInt(passingPercentage) || 40,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      status: 'draft',
      isResultsPublished: true,
      instantFeedback: true,
      createdBy: req.user.id,
      questions: preProvidedQuestions,
      totalMarks: calculatedTotal,
      createdAt: new Date()
    };

    if (getIsConnected()) {
      const exam = new Exam(examData);
      await exam.save();
      return res.status(201).json(exam);
    } else {
      const mockId = 'ex_' + Date.now() + Math.floor(Math.random() * 1000);
      const exam = { _id: mockId, id: mockId, ...examData };
      memoryDb.exams.push(exam);
      saveStore();
      return res.status(201).json(exam);
    }
  } catch (err) {
    console.error('Error creating exam:', err);
    res.status(500).json({ error: 'Failed to create exam.' });
  }
});

// @route   POST /api/exams/:id/generate-questions
// @desc    Trigger AI / template question generation for an exam
router.post('/:id/generate-questions', verifyToken, isTeacher, async (req, res) => {
  try {
    const examId = req.params.id;
    let exam;

    if (getIsConnected()) {
      exam = await Exam.findById(examId);
    } else {
      exam = memoryDb.exams.find(e => (e._id === examId || e.id === examId));
    }

    if (!exam) {
      return res.status(404).json({ error: 'Exam not found.' });
    }

    if (!isTeacherAllowedForExam(req.user, exam)) {
      return res.status(403).json({
        error: `Access denied. You can only generate questions for exams in your department ("${req.user.department || 'General'}"). This exam belongs to "${exam.department}".`
      });
    }

    const questions = await generateQuestionsFromLLM({
      subject: exam.subject,
      topic: exam.topic,
      difficulty: exam.difficulty,
      questionCount: exam.questionCount || 5,
      examType: exam.examType || 'combined_objective',
      questionComposition: exam.questionComposition || exam.examType || 'combined_objective'
    });

    const totalMarks = questions.reduce((sum, q) => sum + (Number(q.maxMarks) || 2), 0);

    if (getIsConnected()) {
      exam.questions = questions;
      exam.totalMarks = totalMarks;
      await exam.save();
      return res.json(exam);
    } else {
      exam.questions = questions;
      exam.totalMarks = totalMarks;
      saveStore();
      return res.json(exam);
    }
  } catch (err) {
    console.error('Error generating questions:', err);
    res.status(500).json({ error: 'Failed to auto-generate questions.' });
  }
});

// @route   GET /api/exams/:id
// @desc    Get exam details & questions (Sanitizes answers if student is actively taking test)
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const examId = req.params.id;
    const exam = await findExam(examId);

    if (!exam) {
      return res.status(404).json({ error: 'Exam not found.' });
    }

    if (!isTeacherAllowedForExam(req.user, exam)) {
      return res.status(403).json({
        error: `Access denied. You can only view exams within your department ("${req.user.department || 'General'}"). This exam belongs to "${exam.department}".`
      });
    }

    // Student course & department match check
    if (req.user.role === 'student') {
      const eligibility = isStudentEligibleForExam(req.user, exam);
      if (!eligibility.eligible) {
        return res.status(403).json({
          error: eligibility.reason,
          isCourseMismatch: true
        });
      }
    }

    const examObj = exam.toObject ? exam.toObject() : JSON.parse(JSON.stringify(exam));

    // Student verification gate: Check if student has been verified by the administrator
    if (req.user.role === 'student') {
      let isVerified = false;
      const User = require('../models/User');
      if (getIsConnected()) {
        let studentUser = null;
        if (mongoose.Types.ObjectId.isValid(req.user.id)) {
          studentUser = await User.findById(req.user.id);
        }
        if (!studentUser) {
          studentUser = await User.findOne({ $or: [{ id: req.user.id }, { email: req.user.email }] });
        }
        isVerified = studentUser ? (studentUser.isVerified ?? true) : false;
      } else {
        const studentUser = memoryDb.users.find(u => u._id === req.user.id || u.id === req.user.id || u.email === req.user.email);
        isVerified = studentUser ? (studentUser.isVerified ?? true) : false;
      }

      if (!isVerified) {
        return res.status(403).json({
          error: 'Your student account is pending approval by the exam administrator. Please contact your instructor to verify your account.',
          isPendingVerification: true
        });
      }
    }

    // Student safety guard: If user is a student taking the exam, check status and omit correctOptionIndex and correctAnswer
    if (req.user.role === 'student') {
      let existingSub = null;
      if (getIsConnected()) {
        try {
          existingSub = await Submission.findOne({
            $or: [
              { examId: exam._id, studentId: req.user.id },
              { examId: examId, studentId: req.user.id }
            ]
          });
        } catch (e) {}
      }
      if (!existingSub) {
        existingSub = memoryDb.submissions.find(s => (
          (s.examId === examId || String(s.examId) === String(examId) || String(s.examId) === String(exam._id)) &&
          (s.studentId === req.user.id || String(s.studentId) === String(req.user.id))
        ));
      }

      if (existingSub) {
        if (existingSub.isTerminated || existingSub.status === 'terminated') {
          return res.status(403).json({
            error: 'You cannot take this exam. Your attempt was terminated because the browser was closed or navigated back during the examination.',
            isTerminated: true,
            terminationReason: existingSub.terminationReason || 'Browser was closed or Back button was pressed during the examination.'
          });
        }

        // Only mark as already submitted if officially submitted or graded (not when re-allowed / in-progress)
        if (existingSub.status === 'submitted' || existingSub.status === 'graded') {
          examObj.questions = [];
          examObj.hasSubmitted = true;
          examObj.submissionStatus = existingSub.status;
          return res.json(examObj);
        }
      }

      const pool = examObj.questions || [];
        const targetCount = (examObj.questionCount && examObj.questionCount > 0)
          ? Math.min(examObj.questionCount, pool.length)
          : pool.length;

        // Use attempt seed from header or student identity + exam
        const attemptSeed = req.headers['x-exam-attempt-seed'] || `${req.user.id}_${req.user.email}_${examId}`;

        // Sample randomized questions & shuffle options deterministically for this student seat
        const sampled = getSeededRandomQuestions(pool, targetCount, attemptSeed, { shuffleOptions: true });

        examObj.totalPoolCount = pool.length;
        examObj.questionCount = targetCount;
        examObj.questions = sampled.map((q, idx) => ({
          _id: q._id || q.id,
          id: q._id || q.id,
          type: q.type,
          category: q.category || 'theory',
          codeSnippet: q.codeSnippet || '',
          prompt: q.prompt,
          options: q.options || [],
          maxMarks: Number(q.maxMarks) || 2,
          order: idx + 1
        }));
        examObj.totalMarks = examObj.questions.reduce((sum, q) => sum + (Number(q.maxMarks) || 2), 0);
      }

    res.json(examObj);
  } catch (err) {
    console.error('Error fetching exam:', err);
    res.status(500).json({ error: 'Failed to fetch exam details.' });
  }
});

// @route   PUT /api/exams/:id
// @desc    Update exam questions or publish exam (Teacher only)
router.put('/:id', verifyToken, isTeacher, async (req, res) => {
  try {
    const examId = req.params.id;
    const { questions, status, title, startTime, endTime, passingPercentage, examCode, subject, topic, questionCount, randomizeQuestions } = req.body;

    const exam = await findExam(examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found.' });

    if (!isTeacherAllowedForExam(req.user, exam)) {
      return res.status(403).json({
        error: `Access denied. You can only modify exams within your department ("${req.user.department || 'General'}").`
      });
    }

    if (questions) {
      exam.questions = questions;
    }
    if (questionCount !== undefined) {
      exam.questionCount = Math.max(1, parseInt(questionCount, 10));
    }
    if (randomizeQuestions !== undefined) {
      exam.randomizeQuestions = Boolean(randomizeQuestions);
    }

    // Calculate total marks according to delivered question count
    const activeQCount = Math.min(exam.questionCount || (exam.questions ? exam.questions.length : 5), exam.questions ? exam.questions.length : 5);
    const avgMarks = exam.questions && exam.questions.length > 0 ? (Number(exam.questions[0]?.maxMarks) || 2) : 2;
    exam.totalMarks = activeQCount * avgMarks;

    if (status) exam.status = status;
    if (title) exam.title = title;
    if (subject) exam.subject = subject;
    if (topic) exam.topic = topic;
    if (passingPercentage) exam.passingPercentage = Number(passingPercentage);
    if (examCode) exam.examCode = examCode.toUpperCase();
    if (req.body.durationMinutes) exam.durationMinutes = Number(req.body.durationMinutes);
    if (startTime) exam.startTime = new Date(startTime);
    if (endTime) exam.endTime = new Date(endTime);

    if (getIsConnected() && typeof exam.save === 'function') {
      await exam.save();
    }
    saveStore();
    return res.json(exam);
  } catch (err) {
    console.error('Error updating exam:', err);
    res.status(500).json({ error: 'Failed to update exam.' });
  }
});

// @route   POST /api/exams/:id/publish-results
// @desc    Publish grades for all students for this exam (Teacher only)
router.post('/:id/publish-results', verifyToken, isTeacher, async (req, res) => {
  try {
    const examId = req.params.id;
    const exam = await findExam(examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found.' });

    if (!isTeacherAllowedForExam(req.user, exam)) {
      return res.status(403).json({
        error: `Access denied. You can only publish results for exams within your department ("${req.user.department || 'General'}").`
      });
    }

    exam.isResultsPublished = true;
    if (getIsConnected() && typeof exam.save === 'function') {
      await exam.save();
    }
    saveStore();
    return res.json({ message: 'Exam results published successfully!', exam });
  } catch (err) {
    console.error('Error publishing results:', err);
    res.status(500).json({ error: 'Failed to publish exam results.' });
  }
});

// @route   DELETE /api/exams/:id
// @desc    Delete an exam and associated submissions (Teacher only)
router.delete('/:id', verifyToken, isTeacher, async (req, res) => {
  try {
    const examId = req.params.id;
    const exam = await findExam(examId);
    if (!exam) return res.status(404).json({ error: 'Exam not found.' });

    if (!isTeacherAllowedForExam(req.user, exam)) {
      return res.status(403).json({
        error: `Access denied. You can only delete exams within your department ("${req.user.department || 'General'}").`
      });
    }

    if (getIsConnected()) {
      if (mongoose.Types.ObjectId.isValid(examId)) {
        await Exam.findByIdAndDelete(examId);
      } else {
        await Exam.deleteOne({ $or: [{ id: examId }, { examCode: String(examId).toUpperCase() }] });
      }
      try {
        await Submission.deleteMany({
          $or: [
            { examId: examId },
            ...(mongoose.Types.ObjectId.isValid(examId) ? [{ examId: new mongoose.Types.ObjectId(examId) }] : [])
          ]
        });
      } catch (e) {}
    }
    const idx = memoryDb.exams.findIndex(e => (e._id === examId || e.id === examId || String(e._id) === String(examId)));
    if (idx !== -1) {
      memoryDb.exams.splice(idx, 1);
    }
    memoryDb.submissions = memoryDb.submissions.filter(s => (s.examId !== examId && String(s.examId) !== String(examId)));
    saveStore();
    return res.json({ message: 'Exam deleted successfully.' });
  } catch (err) {
    console.error('Error deleting exam:', err);
    res.status(500).json({ error: 'Failed to delete exam.' });
  }
});

module.exports = router;
module.exports.isStudentEligibleForExam = isStudentEligibleForExam;
