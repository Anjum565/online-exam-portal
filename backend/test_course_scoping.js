const BASE_URL = 'http://localhost:5000/api';

async function req(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function testCourseScoping() {
  console.log('--- TESTING COURSE-SPECIFIC EXAM SCOPING ---');

  // 1. Login as teacher
  const teacherLogin = await req('/auth/login', {
    method: 'POST',
    body: { email: 'teacher@test.com', password: 'password123' }
  });
  if (!teacherLogin.ok) throw new Error('Teacher login failed: ' + JSON.stringify(teacherLogin.data));
  const teacherToken = teacherLogin.data.token;
  console.log('1. Logged in as Teacher (CS & Engineering)');

  // 2. Create an exam specifically targeted at 'BCA' course in CS & Engineering
  const examCode = 'BCA' + Math.floor(1000 + Math.random() * 9000);
  const bcaExamRes = await req('/exams', {
    method: 'POST',
    headers: { Authorization: `Bearer ${teacherToken}` },
    body: {
      title: 'BCA Advanced Computer Networks & Shell Scripting',
      department: 'Computer Science & Engineering',
      course: 'BCA',
      semester: 'Semester 4',
      subject: 'Computer Networks',
      topic: 'TCP/IP, Routing, Subnetting',
      examCode,
      durationMinutes: 20,
      startTime: new Date(Date.now() - 60000),
      endTime: new Date(Date.now() + 3600000),
      questions: [
        {
          type: 'mcq',
          order: 1,
          prompt: 'Which layer of the OSI model does TCP operate in?',
          options: ['Network Layer', 'Transport Layer', 'Data Link Layer', 'Application Layer'],
          correctOptionIndex: 1,
          correctAnswer: 'Transport Layer',
          maxMarks: 2
        }
      ]
    }
  });
  if (!bcaExamRes.ok) throw new Error('Create BCA exam failed: ' + JSON.stringify(bcaExamRes.data));
  const bcaExam = bcaExamRes.data;
  console.log(`2. Created BCA Exam: "${bcaExam.title}" (Code: ${bcaExam.examCode}, Target Course: ${bcaExam.course})`);

  // Publish the BCA exam so it becomes live
  const pubRes = await req(`/exams/${bcaExam._id || bcaExam.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${teacherToken}` },
    body: { status: 'published' }
  });
  if (!pubRes.ok) throw new Error('Publish BCA exam failed: ' + JSON.stringify(pubRes.data));
  console.log('✓ BCA Exam published');

  // 3. Login as B.Tech student (Ada Lovelace)
  const btechLogin = await req('/auth/login', {
    method: 'POST',
    body: { email: 'student@test.com', password: 'password123' }
  });
  if (!btechLogin.ok) throw new Error('B.Tech student login failed');
  const btechToken = btechLogin.data.token;
  const btechUser = btechLogin.data.user;
  console.log(`3. Logged in as Student: ${btechUser.name} (Dept: ${btechUser.department}, Course: ${btechUser.course})`);

  // 4. Check available exams for B.Tech student
  const availableForBtech = await req('/exams', {
    headers: { Authorization: `Bearer ${btechToken}` }
  });
  const btechSeesBcaExam = availableForBtech.data.some(e => (e._id === bcaExam._id || e.examCode === bcaExam.examCode));
  console.log(`4. B.Tech student sees BCA exam in listing: ${btechSeesBcaExam} (Expected: false)`);
  if (btechSeesBcaExam) {
    throw new Error('FAIL: B.Tech student should NOT see BCA exam in available exams listing!');
  }

  // 5. Attempt to join BCA exam via exam code as B.Tech student
  console.log('5. B.Tech student attempts to join BCA exam via exam code...');
  const btechCodeAttempt = await req(`/exams/code/${bcaExam.examCode}`, {
    headers: { Authorization: `Bearer ${btechToken}` }
  });
  console.log(`   Response status: ${btechCodeAttempt.status}`);
  if (btechCodeAttempt.status === 403) {
    console.log(`✓ B.Tech student was correctly blocked (HTTP 403): "${btechCodeAttempt.data.error}"`);
  } else {
    throw new Error(`FAIL: Expected 403 but got ${btechCodeAttempt.status}: ${JSON.stringify(btechCodeAttempt.data)}`);
  }

  // 6. Attempt direct exam session access
  console.log('6. B.Tech student attempts direct access to /api/exams/:id for BCA exam...');
  const btechDirectAttempt = await req(`/exams/${bcaExam._id || bcaExam.id}`, {
    headers: { Authorization: `Bearer ${btechToken}` }
  });
  console.log(`   Response status: ${btechDirectAttempt.status}`);
  if (btechDirectAttempt.status === 403) {
    console.log(`✓ Direct access correctly blocked (HTTP 403): "${btechDirectAttempt.data.error}"`);
  } else {
    throw new Error(`FAIL: Expected 403 but got ${btechDirectAttempt.status}: ${JSON.stringify(btechDirectAttempt.data)}`);
  }

  // 7. Register a genuine BCA student in the same department
  const bcaStudentEmail = `bca_student_${Date.now()}@test.com`;
  const bcaRegisterRes = await req('/auth/register', {
    method: 'POST',
    body: {
      name: 'BCA Candidate Bob',
      email: bcaStudentEmail,
      password: 'password123',
      role: 'student',
      department: 'Computer Science & Engineering',
      course: 'BCA',
      semester: 'Semester 4',
      rollNumber: 'BCA-2026-007'
    }
  });
  if (!bcaRegisterRes.ok) throw new Error('Register BCA student failed: ' + JSON.stringify(bcaRegisterRes.data));
  const bcaStudentId = bcaRegisterRes.data.user.id || bcaRegisterRes.data.user._id;

  // Auto-verify student via admin
  const adminLogin = await req('/auth/login', {
    method: 'POST',
    body: { email: 'admin@test.com', password: 'password123' }
  });
  await req(`/admin/students/${bcaStudentId}/verify`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminLogin.data.token}` }
  });

  const bcaLogin = await req('/auth/login', {
    method: 'POST',
    body: { email: bcaStudentEmail, password: 'password123' }
  });
  const bcaToken = bcaLogin.data.token;
  console.log('7. Registered & verified BCA student in CS & Engineering department');

  // 8. BCA student checks available exams
  const availableForBca = await req('/exams', {
    headers: { Authorization: `Bearer ${bcaToken}` }
  });
  const bcaSeesBcaExam = availableForBca.data.some(e => (e._id === bcaExam._id || e.examCode === bcaExam.examCode));
  const bcaSeesBtechExam = availableForBca.data.some(e => e.course === 'B.Tech');
  console.log(`8. BCA student sees BCA exam: ${bcaSeesBcaExam} (Expected: true)`);
  console.log(`   BCA student sees B.Tech exam: ${bcaSeesBtechExam} (Expected: false)`);

  if (!bcaSeesBcaExam) throw new Error('FAIL: BCA student should see BCA exam!');
  if (bcaSeesBtechExam) throw new Error('FAIL: BCA student should NOT see B.Tech exam!');

  // 9. BCA student joins via code
  const bcaJoinRes = await req(`/exams/code/${bcaExam.examCode}`, {
    headers: { Authorization: `Bearer ${bcaToken}` }
  });
  if (!bcaJoinRes.ok) throw new Error('BCA student join failed: ' + JSON.stringify(bcaJoinRes.data));
  console.log(`9. BCA student joined BCA exam via code: "${bcaJoinRes.data.title}"`);

  console.log('\n🎉 ALL COURSE-SPECIFIC EXAM SCOPING TESTS PASSED PERFECTLY!');
}

testCourseScoping().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
