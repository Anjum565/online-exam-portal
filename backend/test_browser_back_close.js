const http = require('http');

function request(url, options = {}, data = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    if (data) {
      if (typeof data === 'object') {
        data = JSON.stringify(data);
        reqOptions.headers['Content-Type'] = 'application/json';
      }
      reqOptions.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  console.log('🧪 Starting Browser Back & Close Prevention Verification...\n');

  // 1. Login as teacher to create a fresh test exam
  const teacherRes = await request('http://localhost:5000/api/auth/login', {
    method: 'POST'
  }, {
    email: 'teacher@test.com',
    password: 'password123'
  });

  if (!teacherRes.data.token) {
    console.error('❌ Teacher login failed:', teacherRes.data);
    process.exit(1);
  }
  const teacherToken = teacherRes.data.token;
  console.log('✅ Teacher authenticated.');

  // Create an active exam
  const now = new Date();
  const startTime = new Date(now.getTime() - 60000).toISOString();
  const endTime = new Date(now.getTime() + 600000).toISOString();

  const examRes = await request('http://localhost:5000/api/exams', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${teacherToken}` }
  }, {
    title: 'Strict Proctored Security Exam',
    description: 'Testing back/close termination',
    subject: 'Computer Science',
    topic: 'Web Development',
    durationMinutes: 10,
    startTime,
    endTime,
    passingPercentage: 50,
    questionCount: 2,
    randomizeQuestions: true,
    questions: [
      {
        prompt: 'What is HTML?',
        type: 'mcq',
        options: ['Markup Language', 'Programming Language', 'Database', 'Browser'],
        correctOptionIndex: 0,
        maxMarks: 2
      },
      {
        prompt: 'What is CSS?',
        type: 'mcq',
        options: ['Style Sheet', 'Programming Language', 'Database', 'Browser'],
        correctOptionIndex: 0,
        maxMarks: 2
      }
    ]
  });

  const examId = examRes.data._id || examRes.data.id;
  console.log(`Test Exam creation status: ${examRes.status}`, examRes.data);
  console.log(`✅ Test Exam created with ID: ${examId}`);

  // Publish exam
  await request(`http://localhost:5000/api/exams/${examId}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${teacherToken}` }
  }, { status: 'published' });
  console.log('✅ Test Exam published.');

  // 2. Register/login a fresh student
  const studentEmail = `student_${Date.now()}@test.com`;
  const regRes = await request('http://localhost:5000/api/auth/register', {
    method: 'POST'
  }, {
    name: 'AntiCheat Candidate',
    email: studentEmail,
    password: 'password123',
    role: 'student'
  });

  const studentToken = regRes.data.token;
  const studentId = regRes.data.user.id;
  console.log(`✅ Student registered: ${studentEmail} (ID: ${studentId})`);

  // Verify student via teacher verification API
  const verifyRes = await request(`http://localhost:5000/api/admin/students/${studentId}/verify`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${teacherToken}` }
  }, { isVerified: true });
  console.log('✅ Student verified by admin:', verifyRes.data.message || 'Success');

  // 3. Student fetches exam questions
  const preExamRes = await request(`http://localhost:5000/api/exams/${examId}`, {
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  console.log(`Pre-exam response:`, preExamRes.status, preExamRes.data);
  console.log(`✅ Student fetched exam before starting. Status: ${preExamRes.status}, Questions delivered: ${preExamRes.data.questions?.length}`);
  if (preExamRes.status !== 200 || !preExamRes.data.questions || preExamRes.data.questions.length !== 2) {
    console.error('❌ Failed to fetch exam before start.');
    process.exit(1);
  }

  // 4. Simulate student pressing Back or closing browser
  // Frontend sends beacon / keepalive POST to /api/submissions/:examId/terminate-session?token=...
  console.log('\n🚪 Simulating browser Back/Close event trigger via beacon/keepalive API...');
  const terminateRes = await request(`http://localhost:5000/api/submissions/${examId}/terminate-session?token=${studentToken}`, {
    method: 'POST'
  }, {
    reason: 'Browser window was closed or Back button was pressed during active examination.'
  });

  console.log('✅ Terminate API response:', terminateRes.status, terminateRes.data);
  if (terminateRes.status !== 200 || !terminateRes.data.isTerminated) {
    console.error('❌ Failed to terminate session:', terminateRes.data);
    process.exit(1);
  }

  // 5. Try to re-access exam as the disqualified student: GET /api/exams/:examId
  console.log('\n🔒 Verifying student is permanently BARRED from re-entering exam...');
  const reAccessRes = await request(`http://localhost:5000/api/exams/${examId}`, {
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });

  console.log(`Re-access response status: ${reAccessRes.status}`);
  console.log(`Re-access response data:`, reAccessRes.data);

  if (reAccessRes.status === 403 && reAccessRes.data.isTerminated) {
    console.log('✅ PASS: Server blocked re-entry with HTTP 403 and isTerminated=true. No questions provided!');
  } else {
    console.error('❌ FAIL: Student was able to access exam questions after termination!');
    process.exit(1);
  }

  // 6. Try to submit answers anyway: POST /api/submissions/:examId/submit-answers
  console.log('\n🔒 Verifying student CANNOT submit answers after termination...');
  const rogueSubmitRes = await request(`http://localhost:5000/api/submissions/${examId}/submit-answers`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${studentToken}` }
  }, {
    answers: [{ questionId: '1', selectedOptionIndex: 0 }]
  });

  console.log(`Rogue submission status: ${rogueSubmitRes.status}`, rogueSubmitRes.data);
  if (rogueSubmitRes.status === 403 && rogueSubmitRes.data.isTerminated) {
    console.log('✅ PASS: Submission rejected because exam session was terminated!');
  } else {
    console.error('❌ FAIL: Rogue submission was not blocked with 403!');
    process.exit(1);
  }

  // 7. Check student submission view
  const mySubRes = await request(`http://localhost:5000/api/submissions/${examId}/my`, {
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  const sub = mySubRes.data;
  console.log('\n📋 Student submission record status:', sub?.status, 'isTerminated:', sub?.isTerminated);
  if (sub && (sub.status === 'terminated' || sub.isTerminated)) {
    console.log('✅ PASS: Submission is permanently marked as terminated on student dashboard!');
  } else {
    console.error('❌ FAIL: Submission record is not marked terminated.');
    process.exit(1);
  }

  // Clean up test exam
  await request(`http://localhost:5000/api/exams/${examId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${teacherToken}` }
  });
  console.log('\n🧹 Test exam cleaned up.');
  console.log('\n🎉 ALL SECURITY & TERMINATION TESTS PASSED SUCCESSFULLY!');
}

run().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
