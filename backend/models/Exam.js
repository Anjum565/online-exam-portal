const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['mcq', 'true_false', 'short', 'long', 'coding', 'subjective'],
    default: 'mcq',
    required: true
  },
  prompt: {
    type: String,
    required: true
  },
  options: [String], // Array of choices for MCQs
  correctOptionIndex: {
    type: Number,
    default: 0 // 0-based index of correct option
  },
  correctAnswer: String, // String representation of correct answer
  explanation: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    default: 'theory' // 'theory' or 'programming'
  },
  codeSnippet: {
    type: String,
    default: ''
  },
  language: {
    type: String,
    default: ''
  },
  suggestedAnswer: String, // Model answer or marking criteria
  maxMarks: {
    type: Number,
    default: 2
  },
  order: Number
});

const examSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Exam title is required'],
    trim: true
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    trim: true,
    index: true,
    default: 'General'
  },
  course: {
    type: String,
    trim: true,
    default: ''
  },
  semester: {
    type: String,
    trim: true,
    default: ''
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true
  },
  topic: {
    type: String,
    required: [true, 'Topic is required'],
    trim: true
  },
  examCode: {
    type: String,
    uppercase: true,
    trim: true,
    index: true
  },
  examType: {
    type: String,
    enum: ['mcq', 'subjective', 'mixed', 'combined_objective', 'theory_objective', 'programming_objective'],
    default: 'combined_objective'
  },
  questionComposition: {
    type: String,
    default: 'combined_objective'
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  questionCount: {
    type: Number,
    default: 5
  },
  randomizeQuestions: {
    type: Boolean,
    default: true
  },
  durationMinutes: {
    type: Number,
    required: [true, 'Duration in minutes is required'],
    default: 30
  },
  passingPercentage: {
    type: Number,
    default: 40
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  totalMarks: {
    type: Number,
    default: 10
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'completed'],
    default: 'draft'
  },
  isResultsPublished: {
    type: Boolean,
    default: true // Instant results for MCQs by default
  },
  instantFeedback: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  questions: [questionSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

let ExamModel;
try {
  ExamModel = mongoose.model('Exam');
} catch (e) {
  ExamModel = mongoose.model('Exam', examSchema);
}

module.exports = ExamModel;
