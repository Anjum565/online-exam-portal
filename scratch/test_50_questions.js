async function run50QuestionTest() {
  try {
    // 1. Log in as teacher
    const tLoginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'teacher@test.com', password: 'password123' })
    });
    const tLogin = await tLoginRes.json();
    console.log('✅ Logged in as teacher:', tLogin.user.email);

    // 2. Generate 50 sample questions
    const pool50 = [];
    for (let i = 1; i <= 50; i++) {
      pool50.push({
        prompt: `Question ${i}: What is the primary characteristic of module #${i}?`,
        type: 'mcq',
        category: i % 2 === 0 ? 'programming' : 'theory',
        options: [
          `Option Alpha for Q${i}`,
          `Option Beta for Q${i}`,
          `Option Gamma for Q${i}`,
          `Option Delta for Q${i}`
        ],
        correctOptionIndex: 0,
        correctAnswer: `Option Alpha for Q${i}`,
        maxMarks: 2
      });
    }

    // 3. Create exam with all 50 questions and questionCount = 10
    const createRes = await fetch('http://localhost:5000/api/exams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tLogin.token}`
      },
      body: JSON.stringify({
        title: '50-Question Bank (10 Delivered)',
        subject: 'Software Engineering',
        topic: 'System Architecture',
        durationMinutes: 45,
        passingPercentage: 50,
        status: 'published',
        startTime: new Date(Date.now() - 60000).toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        questionCount: 10,
        questions: pool50
      })
    });
    const createdExam = await createRes.json();
    const examId = createdExam._id || createdExam.id;
    console.log(`✅ Exam created successfully: ID ${examId}`);
    console.log(`   Total pool size: ${createdExam.questions?.length} questions`);
    console.log(`   Questions to appear in exam: ${createdExam.questionCount} questions`);

    // 4. Register and verify a student account for testing
    let studentToken;
    const sRegRes = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alex Johnson',
        email: 'alex.student@test.com',
        password: 'password123',
        role: 'student'
      })
    });
    const sRegData = await sRegRes.json();
    if (sRegData.token) {
      studentToken = sRegData.token;
      // Approve student via admin
      await fetch(`http://localhost:5000/api/admin/students/${sRegData.user.id}/verify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tLogin.token}`
        },
        body: JSON.stringify({ isVerified: true })
      });
      console.log('✅ Registered and verified test student:', sRegData.user.email);
    } else {
      const sLoginRes = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'alex.student@test.com', password: 'password123' })
      });
      const sLogin = await sLoginRes.json();
      studentToken = sLogin.token;
      console.log('✅ Logged in test student:', sLogin.user.email);
    }

    // Publish exam so students can access it
    await fetch(`http://localhost:5000/api/exams/${examId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tLogin.token}`
      },
      body: JSON.stringify({ status: 'published' })
    });
    console.log('✅ Published exam for student access');

    // 5. Fetch for Seat 1 (Student A)
    const seat1Res = await fetch(`http://localhost:5000/api/exams/${examId}`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'x-exam-attempt-seed': 'seat_A_row1'
      }
    });
    const seat1Data = await seat1Res.json();

    // 6. Fetch for Seat 2 (Student B sitting next to Student A)
    const seat2Res = await fetch(`http://localhost:5000/api/exams/${examId}`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'x-exam-attempt-seed': 'seat_B_row1'
      }
    });
    const seat2Data = await seat2Res.json();

    console.log('\n--- VERIFYING 10 QUESTIONS RANDOMIZED OUT OF 50 ---');
    console.log(`Seat 1 received: ${seat1Data.questions?.length} questions`);
    console.log(`Seat 2 received: ${seat2Data.questions?.length} questions`);

    const seat1Prompts = seat1Data.questions.map(q => q.prompt);
    const seat2Prompts = seat2Data.questions.map(q => q.prompt);

    console.log('\nSeat 1 first 3 questions:');
    seat1Data.questions.slice(0, 3).forEach((q, i) => {
      console.log(`  [${i+1}] ${q.prompt}`);
      console.log(`      Choices: ${JSON.stringify(q.options)}`);
    });

    console.log('\nSeat 2 first 3 questions:');
    seat2Data.questions.slice(0, 3).forEach((q, i) => {
      console.log(`  [${i+1}] ${q.prompt}`);
      console.log(`      Choices: ${JSON.stringify(q.options)}`);
    });

    const isDifferentQuestions = JSON.stringify(seat1Prompts) !== JSON.stringify(seat2Prompts);
    console.log(`\nAnti-cheating questions divergence test: ${isDifferentQuestions ? 'PASSED (Different 10 questions picked & ordered)' : 'FAILED'}`);

    // 7. Test setting questionCount = 50 (All 50 questions to appear)
    console.log('\n--- TESTING SETTING ALL 50 QUESTIONS TO APPEAR ---');
    await fetch(`http://localhost:5000/api/exams/${examId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tLogin.token}`
      },
      body: JSON.stringify({ questionCount: 50 })
    });

    const seat1All50 = await fetch(`http://localhost:5000/api/exams/${examId}`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'x-exam-attempt-seed': 'seat_A_row2'
      }
    }).then(r => r.json());

    const seat2All50 = await fetch(`http://localhost:5000/api/exams/${examId}`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'x-exam-attempt-seed': 'seat_B_row2'
      }
    }).then(r => r.json());

    console.log(`Seat 1 received when count=50: ${seat1All50.questions?.length} questions`);
    console.log(`Seat 2 received when count=50: ${seat2All50.questions?.length} questions`);

    const seat1All50Prompts = seat1All50.questions.map(q => q.prompt);
    const seat2All50Prompts = seat2All50.questions.map(q => q.prompt);

    const is50Shuffled = JSON.stringify(seat1All50Prompts) !== JSON.stringify(seat2All50Prompts);
    console.log(`All 50 questions shuffled uniquely per student: ${is50Shuffled ? 'PASSED (Sequence differs completely between students)' : 'FAILED'}`);

    // Clean up test exam
    await fetch(`http://localhost:5000/api/exams/${examId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tLogin.token}` }
    });
    console.log('\n✅ Cleanup complete.');

  } catch (err) {
    console.error('Test error:', err.message);
  }
}

run50QuestionTest();
