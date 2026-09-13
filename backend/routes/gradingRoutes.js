const express = require('express');
const router = express.Router();
const Submission = require('../models/Submission');
const { verifyToken, isTeacher } = require('../middleware/auth');
const { getIsConnected, memoryDb, saveStore } = require('../config/db');

// @route   GET /api/grading/exam/:examId
// @desc    Fetch all student submissions for an exam (Teacher only)
router.get('/exam/:examId', verifyToken, isTeacher, async (req, res) => {
  try {
    const examId = req.params.examId;

    if (getIsConnected()) {
      const submissions = await Submission.find({ examId }).sort({ submittedAt: -1 });
      return res.json(submissions);
    } else {
      const submissions = memoryDb.submissions.filter(s => (
        s.examId === examId || String(s.examId) === String(examId)
      ));
      return res.json(submissions);
    }
  } catch (err) {
    console.error('Error fetching submissions for grading:', err);
    res.status(500).json({ error: 'Failed to retrieve student submissions.' });
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
      const submission = await Submission.findById(submissionId);
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
