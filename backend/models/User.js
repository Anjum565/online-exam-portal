const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: [true, 'Password is required']
  },
  role: {
    type: String,
    enum: ['teacher', 'student', 'admin'],
    default: 'student'
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
  subjects: {
    type: [String],
    default: []
  },
  isVerified: {
    type: Boolean,
    default: false // Students require admin verification before taking exams
  },
  rollNumber: {
    type: String,
    default: ''
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

let UserModel;
try {
  UserModel = mongoose.model('User');
} catch (e) {
  UserModel = mongoose.model('User', userSchema);
}

module.exports = UserModel;
