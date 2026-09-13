const mongoose = require('mongoose');
require('dotenv').config();
const Exam = require('./models/Exam');
const User = require('./models/User');
const { memoryDb } = require('./config/db');

async function runSeed() {
  await mongoose.connect(process.env.MONGODB_URI);

  // Update all teachers to isVerified: true
  const teachersUpdate = await User.updateMany({ role: 'teacher' }, { isVerified: true });
  console.log('Teachers verified:', teachersUpdate.modifiedCount);

  // Find a teacher to be creator
  const teacher = await User.findOne({ role: 'teacher' });

  // Create sample exam if 0 exams
  const examCount = await Exam.countDocuments();
  if (examCount === 0) {
    const sample = memoryDb.exams[0];
    const cleanQuestions = sample.questions.map(q => ({
      type: q.type,
      order: q.order,
      prompt: q.prompt,
      options: q.options,
      correctOptionIndex: q.correctOptionIndex,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      maxMarks: q.maxMarks
    }));

    const examDoc = new Exam({
      title: sample.title,
      subject: sample.subject,
      topic: sample.topic,
      examCode: 'WEB101',
      examType: 'mcq',
      difficulty: 'medium',
      questionCount: 5,
      durationMinutes: 30,
      passingPercentage: 50,
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(Date.now() + 30 * 24 * 3600000),
      totalMarks: 10,
      status: 'published',
      isResultsPublished: true,
      instantFeedback: true,
      createdBy: teacher._id,
      questions: cleanQuestions
    });
    await examDoc.save();
    console.log('✅ WEB101 exam created in MongoDB Atlas successfully! ID:', examDoc._id);
  }

  const allExams = await Exam.find();
  console.log('All exams in MongoDB count:', allExams.length);
  process.exit(0);
}

runSeed().catch(err => {
  console.error(err);
  process.exit(1);
});
