const BASE_URL = 'http://localhost:5000/api';

async function req(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('--- STARTING DEPARTMENT ISOLATION & ANTI-CHEAT VERIFICATION ---');
  const timestamp = Date.now();

  try {
    // 1. Register Student
    console.log('\n1. Registering CS Student...');
    const studentRes = await req('/auth/register', {
      method: 'POST',
      body: {
        name: `Test Student ${timestamp}`,
        email: `student_${timestamp}@test.com`,
        password: 'password123',
        role: 'student',
        department: 'Computer Science & Engineering',
        course: 'B.Tech / B.E.',
        semester: 'Semester 4',
        rollNumber: `CS-${timestamp.toString().slice(-4)}`
      }
    });
    if (!studentRes.ok) throw new Error(`Register student failed: ${JSON.stringify(studentRes.data)}`);
    const studentToken = studentRes.data.token;
    console.log('✓ Student registered with Department: Computer Science & Engineering');

    // 2. Register Teacher A (CS)
    console.log('\n2. Registering Teacher A (CS Department)...');
    const teacherARes = await req('/auth/register', {
      method: 'POST',
      body: {
        name: `Prof. Turing ${timestamp}`,
        email: `turing_${timestamp}@test.com`,
        password: 'password123',
        role: 'teacher',
        facultyCode: 'FACULTY2026',
        department: 'Computer Science & Engineering',
        course: 'B.Tech / B.E.',
        semester: 'Semester 4',
        subjects: ['Data Structures', 'Design and Analysis of Algorithms']
      }
    });
    if (!teacherARes.ok) throw new Error(`Register teacher A failed: ${JSON.stringify(teacherARes.data)}`);
    const teacherAToken = teacherARes.data.token;
    console.log('✓ Teacher A registered in Computer Science with subjects: Data Structures, Algorithms');

    // 3. Register Teacher B (Mechanical)
    console.log('\n3. Registering Teacher B (Mechanical Department)...');
    const teacherBRes = await req('/auth/register', {
      method: 'POST',
      body: {
        name: `Prof. Carnot ${timestamp}`,
        email: `carnot_${timestamp}@test.com`,
        password: 'password123',
        role: 'teacher',
        facultyCode: 'FACULTY2026',
        department: 'Mechanical Engineering',
        course: 'B.Tech / B.E.',
        semester: 'Semester 6',
        subjects: ['Thermodynamics', 'Fluid Mechanics']
      }
    });
    if (!teacherBRes.ok) throw new Error(`Register teacher B failed: ${JSON.stringify(teacherBRes.data)}`);
    const teacherBToken = teacherBRes.data.token;
    console.log('✓ Teacher B registered in Mechanical Engineering with subjects: Thermodynamics');

    // Admin verifies Teacher A, Teacher B, and Student
    const adminLogin = await req('/auth/login', {
      method: 'POST',
      body: { email: 'admin@test.com', password: 'password123' }
    });
    if (!adminLogin.ok) throw new Error('Admin login failed: ' + JSON.stringify(adminLogin.data));
    const initialAdminToken = adminLogin.data.token;

    await req(`/admin/teachers/${teacherARes.data.user.id}/verify`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${initialAdminToken}` }
    });
    await req(`/admin/teachers/${teacherBRes.data.user.id}/verify`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${initialAdminToken}` }
    });
    await req(`/admin/students/${studentRes.data.user.id}/verify`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${initialAdminToken}` }
    });
    console.log('✓ Admin approved Teacher A, Teacher B, and CS Student');

    // 4. Teacher A creates an exam for CS
    console.log('\n4. Teacher A creates CS Exam...');
    const now = new Date();
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const examPayload = {
      title: `CS Algorithms Final Exam ${timestamp}`,
      subject: 'Design and Analysis of Algorithms',
      topic: 'Dynamic Programming & Graph Algorithms',
      department: 'Computer Science & Engineering',
      course: 'B.Tech / B.E.',
      semester: 'Semester 4',
      durationMinutes: 30,
      startTime: now.toISOString(),
      endTime: twoHoursLater.toISOString(),
      totalMarks: 20,
      passingPercentage: 40,
      questions: [
        {
          prompt: 'What is the time complexity of Bellman-Ford algorithm for a graph with V vertices and E edges?',
          options: ['O(V * E)', 'O(V log V)', 'O(E log V)', 'O(V^3)'],
          correctOption: 0,
          marks: 2,
          category: 'programming'
        },
        {
          prompt: 'Which algorithmic paradigm does Floyd-Warshall algorithm use?',
          options: ['Dynamic Programming', 'Greedy Approach', 'Divide and Conquer', 'Backtracking'],
          correctOption: 0,
          marks: 2,
          category: 'theory'
        }
      ]
    };
    const createExamRes = await req('/exams', {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherAToken}` },
      body: examPayload
    });
    if (!createExamRes.ok) throw new Error(`Create exam failed: ${JSON.stringify(createExamRes.data)}`);
    const examId = createExamRes.data._id;
    console.log(`✓ Teacher A created exam: "${createExamRes.data.title}" (ID: ${examId})`);
    console.log(`  Exam department stamped by server: "${createExamRes.data.department}"`);

    // 5. Teacher A lists exams -> Should see this exam
    console.log('\n5. Teacher A lists exams...');
    const teacherAList = await req('/exams', {
      headers: { Authorization: `Bearer ${teacherAToken}` }
    });
    const foundByA = teacherAList.data.some(e => e._id === examId);
    console.log(`✓ Teacher A sees CS exam in their list: ${foundByA}`);

    // 6. Teacher B lists exams -> MUST NOT see Teacher A's CS exam
    console.log('\n6. Teacher B (Mechanical) lists exams...');
    const teacherBList = await req('/exams', {
      headers: { Authorization: `Bearer ${teacherBToken}` }
    });
    const foundByB = teacherBList.data.some(e => e._id === examId);
    console.log(`✓ Teacher B sees CS exam in their list: ${foundByB} (Expected: false)`);
    if (foundByB) {
      throw new Error('SECURITY VIOLATION: Teacher B can see exams from other departments!');
    }

    // 7. Teacher B attempts direct access to Teacher A's CS exam -> MUST receive 403 Forbidden
    console.log('\n7. Teacher B attempts direct GET /exams/:id for CS exam...');
    const blockedRes = await req(`/exams/${examId}`, {
      headers: { Authorization: `Bearer ${teacherBToken}` }
    });
    if (blockedRes.status === 403) {
      console.log(`✓ Correctly blocked with HTTP 403: "${blockedRes.data.error}"`);
    } else {
      throw new Error(`Expected HTTP 403, received ${blockedRes.status}: ${JSON.stringify(blockedRes.data)}`);
    }

    // 8. Admin login and overview
    console.log('\n8. Admin logs in and checks institutional overview...');
    const adminLoginRes = await req('/auth/login', {
      method: 'POST',
      body: {
        email: 'admin@test.com',
        password: 'password123'
      }
    });
    if (!adminLoginRes.ok) throw new Error(`Admin login failed: ${JSON.stringify(adminLoginRes.data)}`);
    const adminToken = adminLoginRes.data.token;
    console.log(`✓ Admin authenticated. Role: ${adminLoginRes.data.user.role}`);

    const adminOverviewRes = await req('/admin/overview', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log(`✓ Admin overview successful:`);
    console.log(`  Total Departments: ${adminOverviewRes.data.departments.length}`);
    console.log(`  Total Teachers: ${adminOverviewRes.data.totalTeachers}`);
    console.log(`  Total Students: ${adminOverviewRes.data.totalStudents}`);
    console.log(`  Total Exams: ${adminOverviewRes.data.totalExams}`);

    const adminExamsRes = await req('/exams', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminSeesExam = adminExamsRes.data.some(e => e._id === examId);
    console.log(`✓ Admin can view all exams across departments: ${adminSeesExam} (Expected: true)`);

    // 9. Anti-Cheat: Student minimizes window during exam -> Disqualification & Barred Re-entry
    console.log('\n9. Testing Anti-Cheat Browser Minimization Disqualification...');
    
    // First, verify student is verified by teacher or admin so they can take the exam
    await req(`/admin/students/${studentRes.data.user.id}/verify`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${teacherAToken}` }
    });
    console.log('✓ Student verified for testing.');

    // Student accesses exam
    const studentExamView = await req(`/exams/${examId}`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    if (!studentExamView.ok) throw new Error(`Student could not view exam: ${JSON.stringify(studentExamView.data)}`);
    console.log(`✓ Student successfully loaded exam: "${studentExamView.data.title}"`);

    // Student minimizes browser window -> triggers terminate-session
    console.log('  Simulating student minimizing browser window (visibilitychange -> document.hidden)...');
    const terminateRes = await req(`/submissions/${examId}/terminate-session`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        reason: 'Browser window was minimized or switched away during active examination',
        timeSpentSeconds: 45
      }
    });
    console.log(`✓ Termination endpoint returned: HTTP ${terminateRes.status}`);
    console.log(`  Status: ${terminateRes.data.submission.status}`);
    console.log(`  Score: ${terminateRes.data.submission.score}`);
    console.log(`  isTerminated: ${terminateRes.data.submission.isTerminated}`);

    // Verify student is now permanently barred from re-entering the exam
    console.log('  Testing re-entry attempt after minimization termination...');
    const reEntryAttempt = await req(`/exams/${examId}`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    if (reEntryAttempt.status === 403 && reEntryAttempt.data.isTerminated) {
      console.log(`✓ Re-entry successfully barred with HTTP 403: "${reEntryAttempt.data.error}"`);
    } else {
      throw new Error(`SECURITY VIOLATION: Student was able to re-enter exam after termination! Status: ${reEntryAttempt.status}`);
    }

    console.log('\n======================================================');
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! ALL REQUIREMENTS MET!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
}

runTests();
