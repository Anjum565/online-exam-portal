const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');
const Exam = require('./models/Exam');
const Submission = require('./models/Submission');

async function syncAllData() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI not found in backend/.env');
    process.exit(1);
  }

  console.log('🔄 Connecting to MongoDB Atlas Cloud Cluster...');
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB Atlas successfully.');

  const storePath = path.join(__dirname, 'data_store.json');
  if (!fs.existsSync(storePath)) {
    console.error('❌ data_store.json not found at:', storePath);
    process.exit(1);
  }

  const localData = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  console.log(`📁 Loaded local store: ${localData.users.length} users, ${localData.exams.length} exams, ${(localData.submissions || []).length} submissions.\n`);

  // ==========================================
  // 1. SYNC USERS
  // ==========================================
  console.log('--- 1. Synchronizing Users ---');
  const userMap = new Map(); // localId / email -> cloudUser._id
  let newUsersCount = 0;
  let updatedUsersCount = 0;

  for (const u of localData.users) {
    const emailNorm = (u.email || '').toLowerCase().trim();
    if (!emailNorm) continue;

    let cloudUser = await User.findOne({ email: emailNorm });
    if (!cloudUser) {
      cloudUser = new User({
        name: u.name || 'User',
        email: emailNorm,
        passwordHash: u.passwordHash,
        role: u.role || 'student',
        department: u.department || 'Computer Science & Engineering',
        course: u.course || '',
        semester: u.semester || '',
        subjects: u.subjects || [],
        isVerified: u.isVerified !== undefined ? u.isVerified : true,
        rollNumber: u.rollNumber || '',
        verifiedAt: u.verifiedAt ? new Date(u.verifiedAt) : new Date(),
        createdAt: u.createdAt ? new Date(u.createdAt) : new Date()
      });
      await cloudUser.save();
      newUsersCount++;
    } else {
      // Update missing fields if any
      let modified = false;
      if (!cloudUser.course && u.course) { cloudUser.course = u.course; modified = true; }
      if (!cloudUser.semester && u.semester) { cloudUser.semester = u.semester; modified = true; }
      if (!cloudUser.rollNumber && u.rollNumber) { cloudUser.rollNumber = u.rollNumber; modified = true; }
      if (!cloudUser.department && u.department) { cloudUser.department = u.department; modified = true; }
      if (cloudUser.isVerified !== true && u.isVerified === true) { cloudUser.isVerified = true; modified = true; }
      if (modified) {
        await cloudUser.save();
        updatedUsersCount++;
      }
    }

    // Map all identifiers
    if (u.id) userMap.set(String(u.id), cloudUser._id);
    if (u._id) userMap.set(String(u._id), cloudUser._id);
    userMap.set(emailNorm, cloudUser._id);
  }

  const totalCloudUsers = await User.countDocuments();
  console.log(`✅ Users Synchronized: +${newUsersCount} inserted, ${updatedUsersCount} updated. Total users in Cloud Atlas: ${totalCloudUsers}.\n`);

  // ==========================================
  // 2. SYNC EXAMS
  // ==========================================
  console.log('--- 2. Synchronizing Exams ---');
  const examMap = new Map(); // localExamId / examCode -> cloudExam._id
  let newExamsCount = 0;

  // Fallback teacher / admin ID for exam createdBy
  const defaultTeacher = await User.findOne({ role: 'teacher' }) || await User.findOne({ role: 'admin' });

  for (const e of localData.exams) {
    const code = (e.examCode || '').toUpperCase().trim();
    let cloudExam = null;

    if (code) {
      cloudExam = await Exam.findOne({ examCode: code });
    }

    if (!cloudExam && e.title) {
      cloudExam = await Exam.findOne({ title: e.title });
    }

    if (!cloudExam) {
      const creatorId = (e.createdBy && userMap.get(String(e.createdBy))) || defaultTeacher._id;
      const cleanQuestions = (e.questions || []).map(q => {
        const item = { ...q };
        if (item._id && !mongoose.Types.ObjectId.isValid(item._id)) {
          delete item._id;
        }
        return item;
      });

      cloudExam = new Exam({
        title: e.title,
        department: e.department || 'Computer Science & Engineering',
        course: e.course || 'BCA',
        semester: e.semester || 'Semester 1',
        subject: e.subject || 'Computer Science',
        topic: e.topic || e.title,
        examCode: code || 'EX' + Math.floor(1000 + Math.random() * 9000),
        examType: e.examType || 'mcq',
        questionComposition: e.questionComposition || 'combined_objective',
        difficulty: e.difficulty || 'medium',
        questionCount: cleanQuestions.length || e.questionCount || 5,
        randomizeQuestions: e.randomizeQuestions !== undefined ? e.randomizeQuestions : true,
        durationMinutes: e.durationMinutes || 30,
        passingPercentage: e.passingPercentage || 40,
        startTime: e.startTime ? new Date(e.startTime) : new Date(Date.now() - 3600000),
        endTime: e.endTime ? new Date(e.endTime) : new Date(Date.now() + 30 * 24 * 3600000),
        totalMarks: e.totalMarks || 10,
        status: e.status || 'published',
        isResultsPublished: e.isResultsPublished !== undefined ? e.isResultsPublished : true,
        instantFeedback: e.instantFeedback !== undefined ? e.instantFeedback : true,
        createdBy: creatorId,
        questions: cleanQuestions,
        createdAt: e.createdAt ? new Date(e.createdAt) : new Date()
      });
      await cloudExam.save();
      newExamsCount++;
      console.log(`  + Created Exam in Cloud: "${cloudExam.title}" (Code: ${cloudExam.examCode}, ID: ${cloudExam._id})`);
    } else {
      // If questions in cloud are 0 but local has questions, update questions
      if ((!cloudExam.questions || cloudExam.questions.length === 0) && (e.questions && e.questions.length > 0)) {
        const cleanQuestions = (e.questions || []).map(q => {
          const item = { ...q };
          if (item._id && !mongoose.Types.ObjectId.isValid(item._id)) {
            delete item._id;
          }
          return item;
        });
        cloudExam.questions = cleanQuestions;
        cloudExam.questionCount = cleanQuestions.length;
        await cloudExam.save();
        console.log(`  * Updated questions for Exam "${cloudExam.title}" (${cleanQuestions.length} questions added)`);
      }
      console.log(`  ✔ Existing Cloud Exam matched: "${cloudExam.title}" (Code: ${cloudExam.examCode}, ID: ${cloudExam._id})`);
    }

    if (e.id) examMap.set(String(e.id), cloudExam._id);
    if (e._id) examMap.set(String(e._id), cloudExam._id);
    if (code) examMap.set(code, cloudExam._id);
  }

  const totalCloudExams = await Exam.countDocuments();
  console.log(`✅ Exams Synchronized: +${newExamsCount} inserted. Total exams in Cloud Atlas: ${totalCloudExams}.\n`);

  // ==========================================
  // 3. SYNC SUBMISSIONS
  // ==========================================
  console.log('--- 3. Synchronizing Student Submissions ---');
  let newSubsCount = 0;
  let skippedSubsCount = 0;

  for (const s of (localData.submissions || [])) {
    // Resolve target Exam in cloud
    const targetExamId = examMap.get(String(s.examId)) || examMap.get(String(s.examCode).toUpperCase());
    if (!targetExamId) {
      console.warn(`  ⚠️ Could not resolve target exam for submission: examId=${s.examId}`);
      skippedSubsCount++;
      continue;
    }

    // Resolve student in cloud
    const emailNorm = (s.studentEmail || '').toLowerCase().trim();
    const targetStudentId = userMap.get(String(s.studentId)) || userMap.get(emailNorm);

    // Check if submission already exists in cloud
    const query = {
      examId: targetExamId,
      $or: [
        { studentEmail: emailNorm },
        ...(targetStudentId ? [{ studentId: targetStudentId }] : [])
      ]
    };

    let existingSub = await Submission.findOne(query);
    if (!existingSub) {
      const cleanAnswers = (s.answers || []).map(a => {
        const item = { ...a };
        if (item._id && !mongoose.Types.ObjectId.isValid(item._id)) {
          delete item._id;
        }
        return item;
      });

      const newSub = new Submission({
        examId: targetExamId,
        studentId: targetStudentId || targetExamId, // fallback if student account was unmapped
        studentName: s.studentName || 'Student',
        studentEmail: emailNorm,
        submissionType: s.submissionType || 'interactive',
        answers: cleanAnswers,
        totalQuestions: s.totalQuestions || (s.answers ? s.answers.length : 0),
        attemptedCount: s.attemptedCount || 0,
        correctCount: s.correctCount || 0,
        marksObtained: s.marksObtained !== undefined ? s.marksObtained : 0,
        totalMarks: s.totalMarks || 0,
        percentage: s.percentage !== undefined ? s.percentage : 0,
        passed: s.passed !== undefined ? s.passed : false,
        timeSpentSeconds: s.timeSpentSeconds || 0,
        tabSwitchCount: s.tabSwitchCount || 0,
        submittedAt: s.submittedAt ? new Date(s.submittedAt) : new Date(),
        status: s.status || 'graded',
        isTerminated: s.isTerminated || false,
        terminationReason: s.terminationReason || '',
        feedback: s.feedback || ''
      });
      await newSub.save();
      newSubsCount++;
    } else {
      skippedSubsCount++;
    }
  }

  const totalCloudSubs = await Submission.countDocuments();
  console.log(`✅ Submissions Synchronized: +${newSubsCount} newly uploaded, ${skippedSubsCount} existing/matched.`);
  console.log(`📊 Total Submissions in Cloud Atlas: ${totalCloudSubs}.\n`);

  console.log('======================================================================');
  console.log('🎉 ALL LOCAL DATA SUCCESSFULLY SYNCHRONIZED TO MONGODB ATLAS CLOUD!');
  console.log('======================================================================');
  console.log(`- Cloud Users       : ${totalCloudUsers}`);
  console.log(`- Cloud Exams       : ${totalCloudExams}`);
  console.log(`- Cloud Submissions : ${totalCloudSubs}`);
  console.log('======================================================================');

  await mongoose.disconnect();
  process.exit(0);
}

syncAllData().catch(err => {
  console.error('❌ Error during synchronization:', err);
  process.exit(1);
});
