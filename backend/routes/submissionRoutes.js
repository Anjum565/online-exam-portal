const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const upload = require('../middleware/upload');
const { verifyToken, isStudent, isTeacher } = require('../middleware/auth');
const Submission = require('../models/Submission');
const Exam = require('../models/Exam');
const { getIsConnected, memoryDb, saveStore } = require('../config/db');
const { getSeededRandomQuestions } = require('../utils/randomSampler');
const { isStudentEligibleForExam } = require('./examRoutes');

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

// @route   POST /api/submissions/:examId/terminate-session
// @desc    Disqualify / terminate exam attempt if student presses back or closes browser
router.post('/:examId/terminate-session', verifyToken, isStudent, async (req, res) => {
  try {
    const examId = req.params.examId;
    const exam = await findExam(examId);

    if (!exam) {
      return res.status(404).json({ error: 'Exam not found.' });
    }

    // Check if student already submitted or was terminated
    let existingSub = null;
    if (getIsConnected()) {
      existingSub = await Submission.findOne({
        $or: [
          { examId: exam._id, studentId: req.user.id },
          { examId: examId, studentId: req.user.id }
        ]
      });
    } else {
      existingSub = memoryDb.submissions.find(s => (
        (s.examId === examId || String(s.examId) === String(examId) || String(s.examId) === String(exam._id)) &&
        (s.studentId === req.user.id || String(s.studentId) === String(req.user.id))
      ));
    }

    // If already officially graded and completed by candidate, do not overwrite with termination
    if (existingSub && existingSub.status === 'graded' && !existingSub.isTerminated) {
      return res.json({ message: 'Exam was already completed.', submission: existingSub });
    }

    const terminationData = {
      examId,
      studentId: req.user.id,
      studentName: req.user.name,
      studentEmail: req.user.email,
      studentRollNumber: req.user.rollNumber || '',
      studentSemester: req.user.semester || exam.semester || '',
      studentCourse: req.user.course || exam.course || '',
      studentDepartment: req.user.department || exam.department || '',
      subject: exam.subject || '',
      examTitle: exam.title || '',
      examCode: exam.examCode || '',
      submissionType: 'interactive',
      answers: existingSub?.answers || [],
      totalQuestions: exam.questionCount || (exam.questions ? exam.questions.length : 0),
      attemptedCount: existingSub?.attemptedCount || 0,
      correctCount: 0,
      marksObtained: 0,
      totalMarks: exam.totalMarks || 10,
      percentage: 0,
      passed: false,
      status: 'terminated',
      isTerminated: true,
      terminationReason: req.body?.reason || 'Candidate closed browser or pressed Back button during examination.',
      feedback: 'Exam terminated and disqualified: Browser was closed or candidate pressed Back during the examination.',
      submittedAt: new Date()
    };

    if (getIsConnected()) {
      if (existingSub) {
        Object.assign(existingSub, terminationData);
        await existingSub.save();
      } else {
        existingSub = new Submission(terminationData);
        await existingSub.save();
      }
    } else {
      if (existingSub) {
        Object.assign(existingSub, terminationData);
      } else {
        const mockId = 'sub_' + Date.now() + Math.floor(Math.random() * 1000);
        existingSub = { _id: mockId, id: mockId, ...terminationData };
        memoryDb.submissions.push(existingSub);
      }
      saveStore();
    }

    return res.status(200).json({
      message: 'Exam session terminated due to browser navigation / close violation.',
      isTerminated: true,
      submission: existingSub
    });
  } catch (err) {
    console.error('Error terminating exam session:', err);
    res.status(500).json({ error: 'Failed to record session termination.' });
  }
});

// @route   POST /api/submissions/:examId/submit-answers
// @desc    Submit interactive online exam answers, perform instant auto-grading, and record score
router.post('/:examId/submit-answers', verifyToken, isStudent, async (req, res) => {
  try {
    const examId = req.params.examId;
    const { answers = [], timeSpentSeconds = 0, tabSwitchCount = 0 } = req.body;

    // Fetch exam safely
    const exam = await findExam(examId);

    if (!exam) {
      return res.status(404).json({ error: 'Exam not found.' });
    }

    // Strict eligibility check (Department and Course match)
    if (req.user.role === 'student') {
      const eligibility = isStudentEligibleForExam(req.user, exam);
      if (!eligibility.eligible) {
        return res.status(403).json({ error: eligibility.reason, isCourseMismatch: true });
      }
    }

    // Check if session was already terminated
    let existingSub = null;
    if (getIsConnected()) {
      existingSub = await Submission.findOne({
        $or: [
          { examId: exam._id, studentId: req.user.id },
          { examId: examId, studentId: req.user.id }
        ]
      });
    } else {
      existingSub = memoryDb.submissions.find(s => (
        (s.examId === examId || String(s.examId) === String(examId) || String(s.examId) === String(exam._id)) &&
        (s.studentId === req.user.id || String(s.studentId) === String(req.user.id))
      ));
    }

    if (existingSub && (existingSub.isTerminated || existingSub.status === 'terminated')) {
      return res.status(403).json({
        error: 'This exam session was terminated because the browser was closed or navigated away. Your submission cannot be accepted.',
        isTerminated: true
      });
    }

    const pool = exam.questions || [];
    const targetCount = (exam.questionCount && exam.questionCount > 0)
      ? Math.min(exam.questionCount, pool.length)
      : pool.length;

    // Retrieve the exact deterministic question and option subset assigned to this student
    const attemptSeed = req.headers['x-exam-attempt-seed'] || `${req.user.id}_${req.user.email}_${examId}`;
    const examQuestions = getSeededRandomQuestions(pool, targetCount, attemptSeed, { shuffleOptions: true });

    let marksObtained = 0;
    let totalMarks = 0;
    let correctCount = 0;
    let attemptedCount = 0;

    const evaluatedAnswers = examQuestions.map((q, idx) => {
      const qMaxMarks = Number(q.maxMarks) || 2;
      totalMarks += qMaxMarks;

      const qId = q._id || q.id || String(idx + 1);
      const studentAns = answers.find(a => 
        a.questionId === qId || 
        String(a.questionId) === String(qId) || 
        a.questionOrder === (q.order || idx + 1)
      );

      const hasSelected = studentAns && (studentAns.selectedOptionIndex !== null && studentAns.selectedOptionIndex !== undefined);
      const hasText = studentAns && studentAns.textAnswer && studentAns.textAnswer.trim().length > 0;

      if (hasSelected || hasText) {
        attemptedCount++;
      }

      let isCorrect = false;
      let marksAwarded = 0;

      const studentSelectedText = (studentAns?.selectedOptionText || (hasSelected && q.options ? q.options[studentAns.selectedOptionIndex] : '')).trim().toLowerCase();
      const correctText = (q.correctAnswer || (q.options && q.options[q.correctOptionIndex]) || '').trim().toLowerCase();

      if (q.type === 'mcq' || q.type === 'true_false' || !q.type) {
        if (studentSelectedText && correctText && studentSelectedText === correctText) {
          isCorrect = true;
          marksAwarded = qMaxMarks;
          correctCount++;
        } else if (hasSelected && Number(studentAns.selectedOptionIndex) === Number(q.correctOptionIndex)) {
          isCorrect = true;
          marksAwarded = qMaxMarks;
          correctCount++;
        }
      }

      marksObtained += marksAwarded;

      return {
        questionId: String(qId),
        questionOrder: q.order || idx + 1,
        prompt: q.prompt,
        selectedOptionIndex: hasSelected ? Number(studentAns.selectedOptionIndex) : null,
        selectedOptionText: hasSelected && q.options ? q.options[studentAns.selectedOptionIndex] : '',
        textAnswer: studentAns?.textAnswer || '',
        isCorrect,
        marksAwarded,
        maxMarks: qMaxMarks,
        correctOptionIndex: q.correctOptionIndex,
        correctAnswer: q.correctAnswer || (q.options && q.options[q.correctOptionIndex]) || '',
        explanation: q.explanation || q.suggestedAnswer || ''
      };
    });

    const percentage = totalMarks > 0 ? Math.round((marksObtained / totalMarks) * 100) : 0;
    const passingPercentage = exam.passingPercentage || 40;
    const passed = percentage >= passingPercentage;
    const hasCodingQuestions = examQuestions.some(q => q.type === 'coding' || q.type === 'short' || q.type === 'long' || q.type === 'subjective');
    const submissionStatus = hasCodingQuestions ? 'pending_review' : 'graded';
    const submissionFeedback = hasCodingQuestions
      ? 'Objective answers auto-graded. Program code submitted and logged for faculty evaluation.'
      : (passed ? 'Congratulations! You passed the exam.' : 'Exam completed. Review weak areas for improvement.');

    const submissionData = {
      examId,
      studentId: req.user.id,
      studentName: req.user.name,
      studentEmail: req.user.email,
      studentRollNumber: req.user.rollNumber || '',
      studentSemester: req.user.semester || exam.semester || '',
      studentCourse: req.user.course || exam.course || '',
      studentDepartment: req.user.department || exam.department || '',
      subject: exam.subject || '',
      examTitle: exam.title || '',
      examCode: exam.examCode || '',
      submissionType: 'interactive',
      answers: evaluatedAnswers,
      totalQuestions: examQuestions.length,
      attemptedCount,
      correctCount,
      marksObtained,
      totalMarks,
      percentage,
      passed,
      timeSpentSeconds: Number(timeSpentSeconds) || 0,
      tabSwitchCount: Number(tabSwitchCount) || 0,
      submittedAt: new Date(),
      status: submissionStatus,
      feedback: submissionFeedback
    };

    if (getIsConnected()) {
      let submission = await Submission.findOne({
        $or: [
          { examId: exam._id, studentId: req.user.id },
          { examId: examId, studentId: req.user.id }
        ]
      });
      if (submission) {
        Object.assign(submission, submissionData);
        await submission.save();
      } else {
        submission = new Submission(submissionData);
        await submission.save();
      }
      return res.status(201).json({
        message: 'Exam submitted and evaluated successfully!',
        submission
      });
    } else {
      let submission = memoryDb.submissions.find(s => (
        (s.examId === examId || String(s.examId) === String(examId) || String(s.examId) === String(exam._id)) &&
        (s.studentId === req.user.id || String(s.studentId) === String(req.user.id))
      ));

      if (submission) {
        Object.assign(submission, submissionData);
      } else {
        const mockId = 'sub_' + Date.now() + Math.floor(Math.random() * 1000);
        submission = { _id: mockId, id: mockId, ...submissionData };
        memoryDb.submissions.push(submission);
      }
      saveStore();
      return res.status(201).json({
        message: 'Exam submitted and evaluated successfully!',
        submission
      });
    }
  } catch (err) {
    console.error('Error submitting exam answers:', err);
    res.status(500).json({ error: 'Failed to process and grade exam submission.' });
  }
});

// @route   GET /api/submissions/:examId/my
// @desc    Get current student's submission & scorecard for this exam
router.get('/:examId/my', verifyToken, isStudent, async (req, res) => {
  try {
    const examId = req.params.examId;
    let submission = null;

    if (getIsConnected()) {
      submission = await Submission.findOne({
        $or: [
          { examId: examId, studentId: req.user.id },
          ...(mongoose.Types.ObjectId.isValid(examId) ? [{ examId: new mongoose.Types.ObjectId(examId), studentId: req.user.id }] : [])
        ]
      });
    }
    if (!submission) {
      submission = memoryDb.submissions.find(s => (
        (s.examId === examId || String(s.examId) === String(examId)) &&
        (s.studentId === req.user.id || String(s.studentId) === String(req.user.id))
      ));
    }
    if (!submission) return res.status(404).json({ error: 'No submission found for this exam.' });
    return res.json(submission);
  } catch (err) {
    console.error('Error fetching student submission:', err);
    res.status(500).json({ error: 'Failed to retrieve submission.' });
  }
});

// @route   GET /api/submissions/:examId/all
// @desc    Get all candidate submissions & class analytics for an exam (Teacher only)
router.get('/:examId/all', verifyToken, isTeacher, async (req, res) => {
  try {
    const examId = req.params.examId;

    // Check teacher department permission
    if (req.user.role === 'teacher') {
      const Exam = require('../models/Exam');
      let exam = null;
      if (getIsConnected()) {
        try { exam = await Exam.findById(examId); } catch (e) {}
      }
      if (!exam) {
        exam = memoryDb.exams.find(e => e._id === examId || e.id === examId);
      }
      if (exam && exam.department && req.user.department && exam.department !== req.user.department) {
        return res.status(403).json({
          error: `Access denied. You can only view submissions for exams within your department ("${req.user.department}").`
        });
      }
    }

    let submissions = [];

    if (getIsConnected()) {
      submissions = await Submission.find({
        $or: [
          { examId: examId },
          ...(mongoose.Types.ObjectId.isValid(examId) ? [{ examId: new mongoose.Types.ObjectId(examId) }] : [])
        ]
      }).sort({ submittedAt: -1 });
    }
    if (!submissions || submissions.length === 0) {
      submissions = memoryDb.submissions.filter(s => (s.examId === examId || String(s.examId) === String(examId)));
    }

    // Calculate aggregated analytics
    const totalCandidates = submissions.length;
    let averageScore = 0;
    let highestScore = 0;
    let lowestScore = 0;
    let passCount = 0;

    if (totalCandidates > 0) {
      const scores = submissions.map(s => Number(s.marksObtained) || 0);
      highestScore = Math.max(...scores);
      lowestScore = Math.min(...scores);
      const totalScoreSum = scores.reduce((a, b) => a + b, 0);
      averageScore = Math.round((totalScoreSum / totalCandidates) * 10) / 10;
      passCount = submissions.filter(s => s.passed || (s.percentage >= 40)).length;
    }

    const passRate = totalCandidates > 0 ? Math.round((passCount / totalCandidates) * 100) : 0;

    res.json({
      submissions,
      analytics: {
        totalCandidates,
        averageScore,
        highestScore,
        lowestScore,
        passRate,
        passCount
      }
    });
  } catch (err) {
    console.error('Error fetching exam submissions:', err);
    res.status(500).json({ error: 'Failed to retrieve submissions.' });
  }
});

// @route   POST /api/submissions/:examId/upload
// @desc    Upload scanned handwritten answer sheet (PDF or Image)
router.post('/:examId/upload', verifyToken, isStudent, upload.single('script'), async (req, res) => {
  try {
    const examId = req.params.examId;
    if (!req.file) {
      return res.status(400).json({ error: 'Please select a scanned answer script (PDF/JPG/PNG) to upload.' });
    }

    const exam = await findExam(examId);

    if (!exam) {
      return res.status(404).json({ error: 'Associated exam not found.' });
    }

    const scriptUrl = `/uploads/${req.file.filename}`;
    const fileType = req.file.mimetype;
    const originalFileName = req.file.originalname;
    const fileSize = req.file.size;

    const data = {
      examId,
      studentId: req.user.id,
      studentName: req.user.name,
      studentEmail: req.user.email,
      studentRollNumber: req.user.rollNumber || '',
      studentSemester: req.user.semester || exam.semester || '',
      studentCourse: req.user.course || exam.course || '',
      studentDepartment: req.user.department || exam.department || '',
      subject: exam.subject || '',
      examTitle: exam.title || '',
      examCode: exam.examCode || '',
      submissionType: 'upload',
      scriptUrl,
      fileType,
      originalFileName,
      fileSize,
      submittedAt: new Date(),
      status: 'submitted',
      marksObtained: null,
      feedback: ''
    };

    if (getIsConnected()) {
      let submission = await Submission.findOne({ examId, studentId: req.user.id });
      if (submission) {
        Object.assign(submission, data);
        await submission.save();
      } else {
        submission = new Submission(data);
        await submission.save();
      }
      return res.status(201).json({ message: 'Answer script uploaded successfully!', submission });
    } else {
      let submission = memoryDb.submissions.find(s => (
        (s.examId === examId || String(s.examId) === String(examId)) &&
        (s.studentId === req.user.id || String(s.studentId) === String(req.user.id))
      ));

      if (submission) {
        Object.assign(submission, data);
      } else {
        const mockId = 'sub_' + Date.now() + Math.floor(Math.random() * 1000);
        submission = { _id: mockId, id: mockId, ...data };
        memoryDb.submissions.push(submission);
      }
      saveStore();
      return res.status(201).json({ message: 'Answer script uploaded successfully!', submission });
    }
  } catch (err) {
    console.error('Error uploading answer script:', err);
    res.status(500).json({ error: 'Failed to upload answer script.' });
  }
});

module.exports = router;
