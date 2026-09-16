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
  console.log('🧪 Starting Re-allow, Webcam Snapshots & Analytics Verification...\n');
  const timestamp = Date.now();

  try {
    // 1. Authenticate Admin
    console.log('1. Authenticating Admin...');
    const adminRes = await request('http://localhost:5000/api/auth/login', { method: 'POST' }, {
      email: 'admin@test.com',
      password: 'password123'
    });
    if (!adminRes.data.token) throw new Error('Admin login failed: ' + JSON.stringify(adminRes.data));
    const adminToken = adminRes.data.token;
    console.log('✓ Admin authenticated.');

    // 2. Register & Verify Student
    console.log('\n2. Registering and approving test student...');
    const studentEmail = `student_${timestamp}@test.com`;
    const regRes = await request('http://localhost:5000/api/auth/register', { method: 'POST' }, {
      name: 'Proctored Candidate',
      email: studentEmail,
      password: 'password123',
      role: 'student',
      department: 'Computer Science & Engineering',
      course: 'B.Tech',
      semester: 'Semester 4',
      rollNumber: `CS-${timestamp.toString().slice(-4)}`
    });
    if (!regRes.data.token) throw new Error('Student registration failed: ' + JSON.stringify(regRes.data));
    const studentToken = regRes.data.token;
    const studentId = regRes.data.user.id;

    // Admin verifies student
    await request(`http://localhost:5000/api/admin/students/${studentId}/verify`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('✓ Student registered and approved.');

    // 3. Teacher creates & publishes an active exam
    console.log('\n3. Teacher creating active examination...');
    const teacherLogin = await request('http://localhost:5000/api/auth/login', { method: 'POST' }, {
      email: 'teacher@test.com',
      password: 'password123'
    });
    const teacherToken = teacherLogin.data.token;

    const now = new Date();
    const startTime = new Date(now.getTime() - 60000).toISOString();
    const endTime = new Date(now.getTime() + 600000).toISOString();

    const examRes = await request('http://localhost:5000/api/exams', {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken}` }
    }, {
      title: `Webcam & Re-allow Verification Exam ${timestamp}`,
      subject: 'Computer Science',
      topic: 'Proctoring Systems',
      course: 'B.Tech',
      semester: 'Semester 4',
      durationMinutes: 15,
      startTime,
      endTime,
      passingPercentage: 40,
      questionCount: 2,
      questions: [
        {
          prompt: 'Which protocol is used for secure web browsing?',
          options: ['HTTP', 'HTTPS', 'FTP', 'SMTP'],
          correctOptionIndex: 1,
          maxMarks: 2,
          category: 'theory'
        },
        {
          prompt: 'What does API stand for?',
          options: ['Application Programming Interface', 'Automated Program Input', 'Advanced Private Interface', 'App Protocol Internet'],
          correctOptionIndex: 0,
          maxMarks: 2,
          category: 'theory'
        }
      ]
    });
    if (!examRes.data._id) throw new Error('Exam creation failed: ' + JSON.stringify(examRes.data));
    const examId = examRes.data._id;

    // Publish exam
    await request(`http://localhost:5000/api/exams/${examId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${teacherToken}` }
    }, { status: 'published' });
    console.log(`✓ Active exam created and published (ID: ${examId})`);

    // 4. Student enters exam
    console.log('\n4. Student fetching exam questions...');
    const examFetch1 = await request(`http://localhost:5000/api/exams/${examId}`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    if (examFetch1.status !== 200 || !examFetch1.data.questions) {
      throw new Error(`Expected HTTP 200 with questions, received ${examFetch1.status}: ${JSON.stringify(examFetch1.data)}`);
    }
    console.log(`✓ Student successfully loaded test room with ${examFetch1.data.questions.length} questions.`);

    // 5. Student sends periodic webcam snapshots
    console.log('\n5. Testing Webcam Proctoring Snapshot Upload...');
    const mockBase64Img = 'data:image/jpeg;base64,' + Buffer.from('mock_snapshot_frame_data_for_proctoring').toString('base64');
    const snapRes1 = await request(`http://localhost:5000/api/submissions/${examId}/snapshot`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` }
    }, {
      image: mockBase64Img,
      trigger: 'initial'
    });
    if (snapRes1.status !== 200) throw new Error('Failed to upload initial snapshot: ' + JSON.stringify(snapRes1.data));
    console.log('✓ Initial webcam snapshot uploaded successfully. Snapshot count:', snapRes1.data.snapshotCount);

    const snapRes2 = await request(`http://localhost:5000/api/submissions/${examId}/snapshot`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` }
    }, {
      image: mockBase64Img,
      trigger: 'periodic'
    });
    console.log('✓ Periodic webcam snapshot uploaded successfully. Snapshot count:', snapRes2.data.snapshotCount);

    // 6. Student accidentally minimizes window -> triggers terminate-session
    console.log('\n6. Simulating accidental window minimization...');
    const termRes = await request(`http://localhost:5000/api/submissions/${examId}/terminate-session`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` }
    }, {
      reason: 'Browser window was minimized during active examination.'
    });
    if (termRes.status !== 200) throw new Error('Termination request failed: ' + JSON.stringify(termRes.data));
    console.log('✓ Attempt terminated on server. Status:', termRes.data.submission.status, 'isTerminated:', termRes.data.submission.isTerminated);

    // 7. Verify student is now barred from re-entering
    console.log('\n7. Verifying student is blocked prior to re-authorization...');
    const blockedRes = await request(`http://localhost:5000/api/exams/${examId}`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    if (blockedRes.status === 403 && blockedRes.data.isTerminated) {
      console.log('✓ Student correctly barred with HTTP 403 and isTerminated=true.');
    } else {
      throw new Error(`Expected HTTP 403, received ${blockedRes.status}: ${JSON.stringify(blockedRes.data)}`);
    }

    // 8. Admin unlocks / re-allows the student
    console.log('\n8. Admin / Teacher executes Re-allow student attempt...');
    const reallowRes = await request(`http://localhost:5000/api/submissions/${examId}/re-allow/${studentId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` }
    }, {
      reason: 'Accidental minimization verified by examiner'
    });
    if (reallowRes.status !== 200 || !reallowRes.data.success) {
      throw new Error('Re-allow request failed: ' + JSON.stringify(reallowRes.data));
    }
    console.log('✓ Re-allow endpoint returned HTTP 200:');
    console.log('  isTerminated:', reallowRes.data.submission.isTerminated);
    console.log('  status:', reallowRes.data.submission.status);
    console.log('  reallowedBy:', reallowRes.data.submission.reallowedBy.adminName);

    // 9. Verify student CAN NOW RE-ENTER cleanly!
    console.log('\n9. Verifying student can successfully re-enter the test room after clearance...');
    const reEnterRes = await request(`http://localhost:5000/api/exams/${examId}`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    if (reEnterRes.status === 200 && reEnterRes.data.questions && reEnterRes.data.questions.length > 0) {
      console.log(`✓ Student successfully re-entered! Received ${reEnterRes.data.questions.length} questions without blank screen!`);
    } else {
      throw new Error(`Student failed to re-enter! Status: ${reEnterRes.status}, data: ${JSON.stringify(reEnterRes.data)}`);
    }

    // 10. Student submits answers successfully
    console.log('\n10. Student completing exam submission...');
    const subRes = await request(`http://localhost:5000/api/submissions/${examId}/submit-answers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` }
    }, {
      answers: [
        { questionId: reEnterRes.data.questions[0]._id, selectedOptionIndex: 1 },
        { questionId: reEnterRes.data.questions[1]._id, selectedOptionIndex: 0 }
      ],
      timeSpentSeconds: 120,
      tabSwitchCount: 1
    });
    if (subRes.status !== 200 && subRes.status !== 201) throw new Error('Submission failed: ' + JSON.stringify(subRes.data));
    console.log(`✓ Student submitted exam successfully! Marks: ${subRes.data.submission.marksObtained}/${subRes.data.submission.totalMarks}, Percentage: ${subRes.data.submission.percentage}%`);

    // 11. Admin fetches Analytics Charts Data
    console.log('\n11. Testing Admin Analytics Charts endpoint...');
    const chartsRes = await request('http://localhost:5000/api/admin/analytics/charts-data', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (chartsRes.status !== 200) throw new Error('Charts data fetch failed: ' + JSON.stringify(chartsRes.data));
    console.log('✓ Charts data returned:');
    console.log('  Score buckets:', chartsRes.data.scoreDistribution);
    console.log('  Pass/Fail ratio:', chartsRes.data.passFailRatio);
    console.log('  Department comparison count:', chartsRes.data.departmentComparison.length);

    // Clean up test exam
    await request(`http://localhost:5000/api/admin/exams/${examId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    console.log('\n========================================================================');
    console.log('🎉 ALL RE-ALLOW, WEBCAM PROCTORING & ANALYTICS TESTS PASSED SUCCESSFULLY!');
    console.log('========================================================================\n');
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
}

run();
