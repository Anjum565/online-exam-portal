const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const defaultHash = bcrypt.hashSync('password123', 10);
const storeFilePath = path.join(__dirname, '..', 'data_store.json');

const sampleExamStartDate = new Date(Date.now() - 3600000); // 1 hour ago
const sampleExamEndDate = new Date(Date.now() + 30 * 24 * 3600000); // 30 days in future

// Default initial seed data
const initialSeedData = {
  users: [
    {
      id: 'usr_admin_demo',
      _id: 'usr_admin_demo',
      name: 'System Administrator (Admin)',
      email: 'admin@test.com',
      passwordHash: defaultHash,
      role: 'admin',
      department: 'Examination Control Division',
      course: 'All Courses',
      semester: 'All Semesters',
      isVerified: true,
      createdAt: new Date()
    },
    {
      id: 'usr_teacher_demo',
      _id: 'usr_teacher_demo',
      name: 'Dr. Alan Turing (Teacher)',
      email: 'teacher@test.com',
      passwordHash: defaultHash,
      role: 'teacher',
      department: 'Computer Science & Engineering',
      course: 'B.Tech',
      semester: 'Semester 4',
      subjects: ['Data Structures & Algorithms', 'Database Management Systems', 'Web Development'],
      isVerified: true,
      createdAt: new Date()
    },
    {
      id: 'usr_student_demo',
      _id: 'usr_student_demo',
      name: 'Ada Lovelace (Student)',
      email: 'student@test.com',
      passwordHash: defaultHash,
      role: 'student',
      department: 'Computer Science & Engineering',
      course: 'B.Tech',
      semester: 'Semester 4',
      rollNumber: 'CS-2026-042',
      isVerified: true,
      createdAt: new Date()
    }
  ],
  exams: [
    {
      _id: 'ex_sample_web101',
      id: 'ex_sample_web101',
      title: 'Full-Stack Web & Database Systems Certification',
      department: 'Computer Science & Engineering',
      course: 'B.Tech',
      semester: 'Semester 4',
      subject: 'Computer Science',
      topic: 'React, Node.js, SQL & RESTful APIs',
      examCode: 'WEB101',
      examType: 'mcq',
      difficulty: 'medium',
      questionCount: 5,
      durationMinutes: 25,
      passingPercentage: 50,
      startTime: sampleExamStartDate,
      endTime: sampleExamEndDate,
      totalMarks: 10,
      status: 'published',
      isResultsPublished: true,
      instantFeedback: true,
      createdBy: 'usr_teacher_demo',
      createdAt: new Date(),
      questions: [
        {
          _id: 'q1',
          id: 'q1',
          type: 'mcq',
          order: 1,
          prompt: 'What is the primary role of the Virtual DOM in modern frontend frameworks like React?',
          options: [
            'Directly writes binary bytecode into browser memory caches',
            'Minimizes expensive real DOM manipulations through in-memory diffing and reconciliation',
            'Converts CSS styles into SQL database tables',
            'Enables running server-side PHP scripts directly in client browsers'
          ],
          correctOptionIndex: 1,
          correctAnswer: 'Minimizes expensive real DOM manipulations through in-memory diffing and reconciliation',
          explanation: 'The Virtual DOM creates a lightweight virtual representation of the UI tree and calculates minimum diffs to efficiently update the real DOM.',
          maxMarks: 2
        },
        {
          _id: 'q2',
          id: 'q2',
          type: 'mcq',
          order: 2,
          prompt: 'Which HTTP response status code indicates that a new resource was successfully created on the server?',
          options: ['200 OK', '201 Created', '204 No Content', '304 Not Modified'],
          correctOptionIndex: 1,
          correctAnswer: '201 Created',
          explanation: 'HTTP 201 Created is the standard RESTful response code when a POST request successfully creates a new entity.',
          maxMarks: 2
        },
        {
          _id: 'q3',
          id: 'q3',
          type: 'mcq',
          order: 3,
          prompt: 'In relational databases, which normal form eliminates transitive dependencies between non-key attributes?',
          options: [
            'First Normal Form (1NF)',
            'Second Normal Form (2NF)',
            'Third Normal Form (3NF)',
            'Boyce-Codd Normal Form (BCNF)'
          ],
          correctOptionIndex: 2,
          correctAnswer: 'Third Normal Form (3NF)',
          explanation: '3NF ensures that a relation is in 2NF and that no non-prime attribute is transitively dependent on the candidate key.',
          maxMarks: 2
        },
        {
          _id: 'q4',
          id: 'q4',
          type: 'mcq',
          order: 4,
          prompt: 'What does the ACID acronym stand for in transactional database management systems?',
          options: [
            'Atomicity, Consistency, Isolation, Durability',
            'Access, Concurrency, Integrity, Distribution',
            'Authentication, Connection, Indexing, Delivery',
            'Array, Condition, Iteration, Declaration'
          ],
          correctOptionIndex: 0,
          correctAnswer: 'Atomicity, Consistency, Isolation, Durability',
          explanation: 'ACID properties guarantee that database transactions are processed reliably and concurrently without data corruption.',
          maxMarks: 2
        },
        {
          _id: 'q5',
          id: 'q5',
          type: 'mcq',
          order: 5,
          prompt: 'Which standard HTTP header is used by API clients to transmit Bearer JWT authentication tokens?',
          options: ['Authentication', 'Authorization', 'X-Auth-Token', 'Security-Key'],
          correctOptionIndex: 1,
          correctAnswer: 'Authorization',
          explanation: 'Standard HTTP authorization uses the "Authorization: Bearer <token>" request header format.',
          maxMarks: 2
        }
      ]
    }
  ],
  submissions: []
};

let memoryDb = JSON.parse(JSON.stringify(initialSeedData));

// Load saved data from disk if exists
const loadStore = () => {
  try {
    if (fs.existsSync(storeFilePath)) {
      const data = fs.readFileSync(storeFilePath, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed && Array.isArray(parsed.users)) {
        memoryDb.users = parsed.users;
        memoryDb.exams = (parsed.exams && parsed.exams.length > 0) ? parsed.exams : initialSeedData.exams;
        memoryDb.submissions = parsed.submissions || [];
        console.log(`📁 Loaded persistent disk store: ${memoryDb.users.length} users, ${memoryDb.exams.length} exams, ${memoryDb.submissions.length} submissions.`);
      }
    } else {
      // Create initial store
      saveStore();
    }
  } catch (err) {
    console.error('Error loading persistent store:', err.message);
  }
};

// Save store to disk
const saveStore = () => {
  try {
    fs.writeFileSync(storeFilePath, JSON.stringify(memoryDb, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving persistent store:', err.message);
  }
};

// Initialize disk storage
loadStore();

let isConnectedToMongo = false;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.includes('<db_username>')) {
    console.log('⚠️ MONGODB_URI not set or using placeholder. Running backend with persistent JSON store.');
    return;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000
    });
    isConnectedToMongo = true;
    console.log('✅ MongoDB Atlas connected successfully (Free M0 Cluster).');

    // Auto-seed initial demo accounts into MongoDB if database is brand new
    try {
      const User = require('../models/User');
      const Exam = require('../models/Exam');

      // 1. Seed or ensure admin user exists
      const adminUser = await User.findOne({ email: 'admin@test.com' });
      if (!adminUser) {
        console.log('🌱 Creating default admin account (admin@test.com)...');
        await new User({
          name: 'System Administrator (Admin)',
          email: 'admin@test.com',
          passwordHash: defaultHash,
          role: 'admin',
          department: 'Examination Control Division',
          course: 'All Courses',
          semester: 'All Semesters',
          isVerified: true
        }).save();
      }

      // 2. Ensure teacher demo user exists with department and subjects
      let teacher = await User.findOne({ email: 'teacher@test.com' });
      if (!teacher) {
        teacher = new User({
          name: 'Dr. Alan Turing (Teacher)',
          email: 'teacher@test.com',
          passwordHash: defaultHash,
          role: 'teacher',
          department: 'Computer Science & Engineering',
          course: 'B.Tech',
          semester: 'Semester 4',
          subjects: ['Data Structures & Algorithms', 'Database Management Systems', 'Web Development'],
          isVerified: true
        });
        await teacher.save();
      } else if (!teacher.department || !teacher.subjects || teacher.subjects.length === 0) {
        teacher.department = 'Computer Science & Engineering';
        teacher.course = 'B.Tech';
        teacher.semester = 'Semester 4';
        teacher.subjects = ['Data Structures & Algorithms', 'Database Management Systems', 'Web Development'];
        await teacher.save();
      }

      // 3. Ensure student demo user exists with department
      let student = await User.findOne({ email: 'student@test.com' });
      if (!student) {
        student = new User({
          name: 'Ada Lovelace (Student)',
          email: 'student@test.com',
          passwordHash: defaultHash,
          role: 'student',
          department: 'Computer Science & Engineering',
          course: 'B.Tech',
          semester: 'Semester 4',
          rollNumber: 'CS-2026-042',
          isVerified: true
        });
        await student.save();
      } else if (!student.department) {
        student.department = 'Computer Science & Engineering';
        student.course = 'B.Tech';
        student.semester = 'Semester 4';
        await student.save();
      }

      // 4. Ensure all exams have a department
      await Exam.updateMany({ department: { $in: [null, '', undefined] } }, {
        $set: {
          department: 'Computer Science & Engineering',
          course: 'B.Tech',
          semester: 'Semester 4'
        }
      });
    } catch (seedErr) {
      console.error('Seed error:', seedErr.message);
    }
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.log('⚠️ Falling back to persistent JSON runtime store for seamless local execution.');
  }
};

module.exports = {
  connectDB,
  memoryDb,
  saveStore,
  getIsConnected: () => isConnectedToMongo
};
