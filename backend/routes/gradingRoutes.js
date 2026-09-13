const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Submission = require('../models/Submission');
const Exam = require('../models/Exam');
const User = require('../models/User');
const { verifyToken, isTeacher } = require('../middleware/auth');
const { getIsConnected, memoryDb, saveStore } = require('../config/db');

// Helper to enrich submissions with student roll number, semester, course, and exam subject
async function enrichSubmissions(subs, examHint = null) {
  if (!subs || subs.length === 0) return [];

  const studentIds = Array.from(new Set(subs.map(s => String(s.studentId)).filter(Boolean)));
  const examIds = Array.from(new Set(subs.map(s => String(s.examId)).filter(Boolean)));

  const studentMap = new Map();
  const examMap = new Map();

  if (examHint) {
    const eId = String(examHint._id || examHint.id);
    examMap.set(eId, examHint);
  }

  if (getIsConnected()) {
    try {
      const [students, exams] = await Promise.all([
        User.find({
          $or: [
            { _id: { $in: studentIds.filter(id => mongoose.Types.ObjectId.isValid(id)) } },
            { id: { $in: studentIds } }
          ]
        }).select('rollNumber semester course department name email'),
        Exam.find({
          $or: [
            { _id: { $in: examIds.filter(id => mongoose.Types.ObjectId.isValid(id)) } },
            { id: { $in: examIds } }
          ]
        }).select('title examCode subject department course semester totalMarks passingPercentage')
      ]);

      students.forEach(st => {
        studentMap.set(String(st._id), st);
        if (st.id) studentMap.set(String(st.id), st);
      });
      exams.forEach(ex => {
        examMap.set(String(ex._id), ex);
        if (ex.id) examMap.set(String(ex.id), ex);
      });
    } catch (e) {
      console.warn('Enrichment query warning:', e.message);
    }
  }

  return subs.map(s => {
    const raw = s.toObject ? s.toObject() : { ...s };
    const sId = String(raw.studentId);
    const eId = String(raw.examId);

    const st = studentMap.get(sId) || memoryDb.users.find(u => String(u._id) === sId || String(u.id) === sId);
    const ex = examMap.get(eId) || (examHint && String(examHint._id || examHint.id) === eId ? examHint : null) || memoryDb.exams.find(e => String(e._id) === eId || String(e.id) === eId || (e.examCode && e.examCode.toUpperCase() === eId.toUpperCase()));

    return {
      ...raw,
      id: raw._id || raw.id,
      studentRollNumber: raw.studentRollNumber || (st && st.rollNumber) || '',
      studentSemester: raw.studentSemester || (st && st.semester) || (ex && ex.semester) || '',
      studentCourse: raw.studentCourse || (st && st.course) || (ex && ex.course) || '',
      studentDepartment: raw.studentDepartment || (st && st.department) || (ex && ex.department) || '',
      subject: raw.subject || (ex && ex.subject) || '',
      examTitle: raw.examTitle || (ex && ex.title) || '',
      examCode: raw.examCode || (ex && ex.examCode) || '',
      examTotalMarks: (ex && ex.totalMarks) || raw.totalMarks || 10,
      examPassingPercentage: (ex && ex.passingPercentage) || 40
    };
  });
}

// @route   GET /api/grading/exam/:examId
// @desc    Fetch all student submissions for an exam with enriched student metadata (Teacher only)
router.get('/exam/:examId', verifyToken, isTeacher, async (req, res) => {
  try {
    const examId = req.params.examId;
    let examHint = null;

    if (getIsConnected()) {
      if (mongoose.Types.ObjectId.isValid(examId)) {
        examHint = await Exam.findById(examId);
      }
      if (!examHint) {
        examHint = await Exam.findOne({ $or: [{ id: examId }, { examCode: String(examId).toUpperCase() }] });
      }

      const submissions = await Submission.find({
        $or: [
          { examId },
          ...(mongoose.Types.ObjectId.isValid(examId) ? [{ examId: new mongoose.Types.ObjectId(examId) }] : [])
        ]
      }).sort({ submittedAt: -1 });

      const enriched = await enrichSubmissions(submissions, examHint);
      return res.json(enriched);
    } else {
      examHint = memoryDb.exams.find(e => (
        e._id === examId || e.id === examId || String(e._id) === String(examId) || String(e.id) === String(examId) || (e.examCode && e.examCode.toUpperCase() === String(examId).toUpperCase())
      ));

      const submissions = memoryDb.submissions.filter(s => (
        s.examId === examId || String(s.examId) === String(examId)
      ));

      const enriched = await enrichSubmissions(submissions, examHint);
      return res.json(enriched);
    }
  } catch (err) {
    console.error('Error fetching submissions for grading:', err);
    res.status(500).json({ error: 'Failed to retrieve student submissions.' });
  }
});

// @route   GET /api/grading/teacher-results
// @desc    Get all student results across department's exams with semester and subject filtering
router.get('/teacher-results', verifyToken, isTeacher, async (req, res) => {
  try {
    const department = req.user.role === 'admin' ? (req.query.department || null) : (req.user.department || 'General');
    const { semester, subject, search } = req.query;

    let exams = [];
    if (getIsConnected()) {
      const examQuery = {};
      if (department) examQuery.department = department;
      if (subject && subject !== 'ALL') examQuery.subject = subject;
      if (semester && semester !== 'ALL') examQuery.semester = semester;
      exams = await Exam.find(examQuery).select('_id id title examCode subject department course semester totalMarks passingPercentage');
    } else {
      exams = memoryDb.exams.filter(e => {
        if (department && e.department !== department) return false;
        if (subject && subject !== 'ALL' && e.subject !== subject) return false;
        if (semester && semester !== 'ALL' && e.semester !== semester) return false;
        return true;
      });
    }

    const examIds = exams.map(e => e._id || e.id);
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

    // Filter by semester if specified
    if (semester && semester !== 'ALL') {
      enriched = enriched.filter(s => s.studentSemester && s.studentSemester.toLowerCase() === semester.toLowerCase());
    }

    // Filter by subject if specified
    if (subject && subject !== 'ALL') {
      enriched = enriched.filter(s => s.subject && s.subject.toLowerCase() === subject.toLowerCase());
    }

    // Filter by search query (name, roll, email)
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      enriched = enriched.filter(s =>
        (s.studentName && s.studentName.toLowerCase().includes(q)) ||
        (s.studentRollNumber && s.studentRollNumber.toLowerCase().includes(q)) ||
        (s.studentEmail && s.studentEmail.toLowerCase().includes(q)) ||
        (s.examTitle && s.examTitle.toLowerCase().includes(q))
      );
    }

    return res.json({
      results: enriched,
      totalCount: enriched.length,
      availableSemesters: Array.from(new Set(exams.map(e => e.semester).filter(Boolean))),
      availableSubjects: Array.from(new Set(exams.map(e => e.subject).filter(Boolean)))
    });
  } catch (err) {
    console.error('Error fetching teacher results:', err);
    res.status(500).json({ error: 'Failed to retrieve department results.' });
  }
});

// @route   PUT /api/grading/submission/:submissionId
// @desc    Teacher enters marks and feedback for a student submission
router.put('/submission/:submissionId', verifyToken, isTeacher, async (req, res) => {
  try {
    const submissionId = req.params.submissionId;
    const { marksObtained, feedback } = req.body;

    if (marksObtained === undefined || marksObtained === null) {
      return res.status(400).json({ error: 'Please specify the marks obtained.' });
    }

    if (getIsConnected()) {
      let submission = null;
      if (mongoose.Types.ObjectId.isValid(submissionId)) {
        submission = await Submission.findById(submissionId);
      }
      if (!submission) {
        submission = await Submission.findOne({ $or: [{ id: submissionId }, { _id: submissionId }] });
      }
      if (!submission) {
        return res.status(404).json({ error: 'Submission record not found.' });
      }

      submission.marksObtained = Number(marksObtained);
      submission.feedback = feedback || '';
      submission.status = 'graded';
      submission.gradedAt = new Date();
      submission.gradedBy = req.user.id;

      await submission.save();
      return res.json({ message: 'Grade and feedback saved successfully!', submission });
    } else {
      const submission = memoryDb.submissions.find(s => (
        s._id === submissionId || s.id === submissionId || String(s._id) === String(submissionId)
      ));
      if (!submission) {
        return res.status(404).json({ error: 'Submission record not found.' });
      }

      submission.marksObtained = Number(marksObtained);
      submission.feedback = feedback || '';
      submission.status = 'graded';
      submission.gradedAt = new Date();
      submission.gradedBy = req.user.id;

      saveStore();
      return res.json({ message: 'Grade and feedback saved successfully!', submission });
    }
  } catch (err) {
    console.error('Error updating grade:', err);
    res.status(500).json({ error: 'Failed to save grade and feedback.' });
  }
});

module.exports = router;
module.exports.enrichSubmissions = enrichSubmissions;
