async function testShuffling() {
  try {
    // 1. Log in as teacher
    const tLoginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'teacher@test.com', password: 'password123' })
    });
    const tLogin = await tLoginRes.json();
    console.log('Logged in as teacher:', tLogin.user.email);

    // 2. Create sample exam with 15 questions, questionCount = 8
    const sampleQuestions = [];
    for (let i = 1; i <= 15; i++) {
      sampleQuestions.push({
        prompt: `Question ${i}: Which concept represents fundamental principle #${i}?`,
        type: 'mcq',
        category: i % 2 === 0 ? 'programming' : 'theory',
        options: [
          `Choice Alpha for Q${i}`,
          `Choice Beta for Q${i}`,
          `Choice Gamma for Q${i}`,
          `Choice Delta for Q${i}`
        ],
        correctOptionIndex: 0,
        correctAnswer: `Choice Alpha for Q${i}`,
        maxMarks: 2
      });
    }

    const createExamRes = await fetch('http://localhost:5000/api/exams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tLogin.token}`
      },
      body: JSON.stringify({
        title: 'Anti-Cheating Shuffle Verification Exam',
        subject: 'Computer Science',
        topic: 'Data Structures & Algorithms',
        durationMinutes: 30,
        passingPercentage: 50,
        status: 'published',
        startTime: new Date(Date.now() - 60000).toISOString(),
        endTime: new Date(Date.now() + 3600000).toISOString(),
        questionCount: 8,
        questions: sampleQuestions
      })
    });
    const createdExam = await createExamRes.json();
    const examId = createdExam._id || createdExam.id;
    console.log(`Created test exam "${createdExam.title}" (ID: ${examId}, Pool: 15 questions, Target: 8)`);

    // 3. Log in as student
    const sLoginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@test.com', password: 'password123' })
    });
    const sLogin = await sLoginRes.json();
    const studentToken = sLogin.token;

    // 4. Fetch as Seat 1 (Student A)
    const seat1Res = await fetch(`http://localhost:5000/api/exams/${examId}`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'x-exam-attempt-seed': 'seat_A_student_101'
      }
    });
    const seat1Data = await seat1Res.json();

    // 5. Fetch as Seat 2 (Student B - sitting next to Student A)
    const seat2Res = await fetch(`http://localhost:5000/api/exams/${examId}`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'x-exam-attempt-seed': 'seat_B_student_102'
      }
    });
    const seat2Data = await seat2Res.json();

    console.log('\n========================================');
    console.log('--- SEAT 1 (Student A - First Seat) ---');
    console.log('Total questions delivered:', seat1Data.questions?.length);
    seat1Data.questions.slice(0, 4).forEach((q, i) => {
      console.log(`Q${i+1} [${q.prompt}]`);
      console.log('   Delivered Choices (A, B, C, D):', q.options);
    });

    console.log('\n========================================');
    console.log('--- SEAT 2 (Student B - Adjacent Seat) ---');
    console.log('Total questions delivered:', seat2Data.questions?.length);
    seat2Data.questions.slice(0, 4).forEach((q, i) => {
      console.log(`Q${i+1} [${q.prompt}]`);
      console.log('   Delivered Choices (A, B, C, D):', q.options);
    });

    // Verify consistency: reload Seat 1 again to verify consistency on page refresh
    const seat1ReloadRes = await fetch(`http://localhost:5000/api/exams/${examId}`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'x-exam-attempt-seed': 'seat_A_student_101'
      }
    });
    const seat1ReloadData = await seat1ReloadRes.json();

    const isReloadConsistent = JSON.stringify(seat1Data.questions.map(q => q.prompt)) === JSON.stringify(seat1ReloadData.questions.map(q => q.prompt)) &&
      JSON.stringify(seat1Data.questions[0]?.options) === JSON.stringify(seat1ReloadData.questions[0]?.options);
    console.log('\n----------------------------------------');
    console.log('Seat 1 page refresh consistency check:', isReloadConsistent ? 'PASSED (Student never loses questions/options on reload)' : 'FAILED');

    const areQuestionsShuffled = JSON.stringify(seat1Data.questions.map(q => q.prompt)) !== JSON.stringify(seat2Data.questions.map(q => q.prompt));
    console.log('Adjacent seats received DIFFERENT questions/order:', areQuestionsShuffled ? 'PASSED (Anti-cheating active!)' : 'FAILED');

    // 6. Test submitting answers for Seat 1 to test auto-grading with scrambled options
    // Let's answer Q1 with whichever option is the correct answer
    const q1Seat1 = seat1Data.questions[0];
    // Find the original prompt number
    const match = q1Seat1.prompt.match(/#(\d+)/);
    const originalNum = match ? match[1] : '1';
    const correctChoiceText = `Choice Alpha for Q${originalNum}`;
    const selectedIdx = q1Seat1.options.indexOf(correctChoiceText);

    console.log(`\nGrading verification: Q1 Seat 1 options:`, q1Seat1.options);
    console.log(`Target correct choice is "${correctChoiceText}", which is at index [${selectedIdx}] on Seat 1.`);

    const submitRes = await fetch(`http://localhost:5000/api/submissions/${examId}/submit-answers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
        'x-exam-attempt-seed': 'seat_A_student_101'
      },
      body: JSON.stringify({
        answers: [{
          questionId: q1Seat1.id,
          questionOrder: 1,
          selectedOptionIndex: selectedIdx,
          selectedOptionText: correctChoiceText
        }],
        timeSpentSeconds: 45,
        tabSwitchCount: 0
      })
    });
    const submitData = await submitRes.json();
    console.log('Submission result:', {
      message: submitData.message,
      marksObtained: submitData.submission?.marksObtained,
      totalMarks: submitData.submission?.totalMarks,
      percentage: submitData.submission?.percentage,
      passed: submitData.submission?.passed,
      q1IsCorrect: submitData.submission?.answers?.[0]?.isCorrect
    });
    console.log('Auto-grading with shuffled choices:', submitData.submission?.answers?.[0]?.isCorrect ? 'PASSED (Accurately awarded marks!)' : 'FAILED');

  } catch (err) {
    console.error('Test error:', err.message);
  }
}

testShuffling();
