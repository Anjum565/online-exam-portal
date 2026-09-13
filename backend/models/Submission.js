const mongoose = require('mongoose');

const studentAnswerSchema = new mongoose.Schema({
  questionId: String,
  questionOrder: Number,
  prompt: String,
  selectedOptionIndex: {
    type: Number,
    default: null
  },
  selectedOptionText: {
    type: String,
    default: ''
  },
  textAnswer: {
    type: String,
    default: ''
  },
  isCorrect: {
    type: Boolean,
    default: null
  },
  marksAwarded: {
    type: Number,
    default: 0
  },
  maxMarks: {
    type: Number,
    default: 0
  }
});

const submissionSchema = new mongoose.Schema({
  examId: {
    type: mongoose.Schema.Types.Mixed,
    ref: 'Exam',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.Mixed,
    ref: 'User',
    required: true
  },
  studentName: String,
  studentEmail: String,
  submissionType: {
    type: String,
    enum: ['interactive', 'upload'],
    default: 'interactive'
  },
  answers: [studentAnswerSchema],
  totalQuestions: {
    type: Number,
    default: 0
  },
  attemptedCount: {
    type: Number,
    default: 0
  },
  correctCount: {
    type: Number,
    default: 0
  },
  marksObtained: {
    type: Number,
    default: 0
  },
  totalMarks: {
    type: Number,
    default: 0
  },
  percentage: {
    type: Number,
    default: 0
  },
  passed: {
    type: Boolean,
    default: false
  },
  timeSpentSeconds: {
    type: Number,
    default: 0
  },
  tabSwitchCount: {
    type: Number,
    default: 0
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['submitted', 'graded', 'terminated'],
    default: 'graded'
  },
  isTerminated: {
    type: Boolean,
    default: false
  },
  terminationReason: {
    type: String,
    default: ''
  },
  feedback: {
    type: String,
    default: ''
  },
  // Scanned physical paper fallback fields
  scriptUrl: {
    type: String,
    default: null
  },
  fileType: {
    type: String,
    default: null
  },
  originalFileName: String,
  fileSize: Number,
  gradedAt: Date,
  gradedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

let SubmissionModel;
try {
  SubmissionModel = mongoose.model('Submission');
} catch (e) {
  SubmissionModel = mongoose.model('Submission', submissionSchema);
}

module.exports = SubmissionModel;
