const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');
const { memoryDb, saveStore } = require('./config/db');

// Parse command line arguments
// Usage: node create_account.js --role admin --email admin2@test.com --password mypassword --name "Institutional Admin"
// Usage: node create_account.js --role teacher --email prof@test.com --password mypassword --name "Prof John" --dept "Computer Science & Engineering" --course "B.Tech" --semester "Semester 4" --subjects "Algorithms, Data Structures"

const args = process.argv.slice(2);
const params = {};
for (let i = 0; i < args.length; i += 2) {
  const key = args[i].replace(/^--/, '');
  const val = args[i + 1];
  params[key] = val;
}

const role = (params.role || 'admin').toLowerCase();
const email = (params.email || '').toLowerCase().trim();
const password = params.password || 'password123';
const name = params.name || (role === 'admin' ? 'System Administrator' : 'Department Faculty');
const department = params.dept || params.department || (role === 'admin' ? 'Institution Wide' : 'Computer Science & Engineering');
const course = params.course || 'B.Tech';
const semester = params.semester || 'Semester 1';
const subjects = params.subjects ? params.subjects.split(',').map(s => s.trim()) : (role === 'teacher' ? ['General Paper'] : []);

if (!email) {
  console.log(`
Usage:
  node create_account.js --role <admin|teacher> --email <email> --password <password> --name <name>

Examples:
  node create_account.js --role admin --email principal@test.com --password pass123 --name "Principal Sharma"
  node create_account.js --role teacher --email turing@test.com --password pass123 --name "Prof. Turing" --dept "Computer Science & Engineering" --subjects "Algorithms, Networks"
`);
  process.exit(1);
}

async function createAccount() {
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const MONGO_URI = process.env.MONGO_URI;
  if (MONGO_URI) {
    try {
      await mongoose.connect(MONGO_URI);
      const existing = await User.findOne({ email });
      if (existing) {
        existing.passwordHash = passwordHash;
        existing.role = role;
        existing.name = name;
        existing.department = department;
        existing.course = course;
        existing.semester = semester;
        existing.subjects = subjects;
        existing.isVerified = true;
        await existing.save();
        console.log(`✓ Existing account [${email}] updated with role: ${role}`);
      } else {
        const newUser = new User({
          name,
          email,
          passwordHash,
          role,
          department,
          course,
          semester,
          subjects,
          isVerified: true
        });
        await newUser.save();
        console.log(`✓ Successfully created ${role.toUpperCase()} account:`);
        console.log(`  Name: ${name}`);
        console.log(`  Email: ${email}`);
        console.log(`  Password: ${password}`);
        console.log(`  Department: ${department}`);
      }
      process.exit(0);
    } catch (err) {
      console.warn('MongoDB connection error, writing to memory/disk store...', err.message);
    }
  }

  // Fallback to local memory store
  const existingIndex = memoryDb.users.findIndex(u => u.email === email);
  const userRecord = {
    id: `usr_${Date.now()}`,
    name,
    email,
    passwordHash,
    role,
    department,
    course,
    semester,
    subjects,
    isVerified: true,
    createdAt: new Date().toISOString()
  };

  if (existingIndex !== -1) {
    memoryDb.users[existingIndex] = { ...memoryDb.users[existingIndex], ...userRecord };
    console.log(`✓ Updated local account [${email}] with role: ${role}`);
  } else {
    memoryDb.users.push(userRecord);
    console.log(`✓ Created local ${role.toUpperCase()} account [${email}]`);
  }
  saveStore();
  process.exit(0);
}

createAccount();
