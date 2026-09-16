import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import {
  Clock, CheckCircle, AlertTriangle, HelpCircle, ArrowRight, ArrowLeft,
  Bookmark, Flag, Award, RefreshCw, Eye, ShieldAlert, Check, X, LogOut, Terminal, Code,
  Layers, UserCheck
} from 'lucide-react';
import CodeBlock from '../components/CodeBlock';
import CodeEditor from '../components/CodeEditor';

export default function ExamSessionPage() {
  const { examId } = useParams();
  const [exam, setExam] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Exam phase: 'instructions' | 'in_progress' | 'submitted' | 'terminated'
  const [examPhase, setExamPhase] = useState('instructions');

  // Test state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answersMap, setAnswersMap] = useState({}); // { [questionIndex]: selectedOptionIndex | 'code_submitted' }
  const [textAnswersMap, setTextAnswersMap] = useState({}); // { [questionIndex]: codeString }
  const [codeLanguages, setCodeLanguages] = useState({}); // { [questionIndex]: languageString }
  const [markedMap, setMarkedMap] = useState({}); // { [questionIndex]: boolean }
  const [visitedMap, setVisitedMap] = useState({ 0: true });

  // Mobile drawer palette & responsiveness
  const [showMobilePalette, setShowMobilePalette] = useState(false);

  // Timer & proctoring
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [startTimeMs, setStartTimeMs] = useState(null);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showProctorWarning, setShowProctorWarning] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showBackWarningModal, setShowBackWarningModal] = useState(false);
  const [terminationReason, setTerminationReason] = useState('');
  const isSubmittingRef = useRef(false);

  const { API_BASE_URL } = useContext(AuthContext);
  const navigate = useNavigate();

  // Retrieve or generate unique device/attempt seed to ensure seats get unique question and option shuffle
  const getAttemptSeed = () => {
    let seed = localStorage.getItem(`exam_attempt_seed_${examId}`);
    if (!seed) {
      seed = 'seat_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      localStorage.setItem(`exam_attempt_seed_${examId}`, seed);
    }
    return seed;
  };

  // Load exam details and synchronize server termination status
  useEffect(() => {
    const fetchExam = async () => {
      try {
        const examRes = await axios.get(`${API_BASE_URL}/exams/${examId}`, {
          headers: {
            'x-exam-attempt-seed': getAttemptSeed()
          }
        });
        setExam(examRes.data);

        // Server allowed entry! Clear any stale local termination flag (e.g. after admin re-allow)
        localStorage.removeItem(`exam_terminated_${examId}`);

        // Check if student already submitted or was terminated on backend
        try {
          const subRes = await axios.get(`${API_BASE_URL}/submissions/${examId}/my`);
          if (subRes.data) {
            setSubmission(subRes.data);
            if (subRes.data.isTerminated || subRes.data.status === 'terminated') {
              setExamPhase('terminated');
              setTerminationReason(subRes.data.terminationReason || 'Exam attempt was terminated because the browser was closed or navigated back.');
            } else if (subRes.data.status === 'submitted' || subRes.data.status === 'graded') {
              setExamPhase('submitted');
            }
          }
        } catch (e) {
          // Not submitted yet
        }
      } catch (err) {
        if (err.response?.data?.isTerminated) {
          setExamPhase('terminated');
          setTerminationReason(err.response.data.terminationReason || err.response.data.error || 'Exam attempt was terminated.');
        } else {
          setError(err.response?.data?.error || 'Failed to load exam session.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchExam();
  }, [examId, API_BASE_URL]);

  // Trap and prevent browser Back button during active examination
  useEffect(() => {
    if (examPhase !== 'in_progress') return;

    // Push state into browser history to trap back button
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      // Keep student on current test room URL
      window.history.pushState(null, '', window.location.href);
      setShowBackWarningModal(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [examPhase]);

  // Trap browser close / navigation away during active examination
  useEffect(() => {
    if (examPhase !== 'in_progress') return;

    const handleBeforeUnload = (e) => {
      if (isSubmittingRef.current) return;
      e.preventDefault();
      e.returnValue = 'Warning: Closing the browser or navigating back will automatically terminate your exam and you will be barred from retaking it!';
      return e.returnValue;
    };

    const handlePageHide = () => {
      if (isSubmittingRef.current) return;
      // Mark as terminated in local storage
      localStorage.setItem(`exam_terminated_${examId}`, 'true');

      // Send beacon or keepalive fetch to backend to terminate and disqualify attempt
      const token = localStorage.getItem('token');
      const terminateUrl = `${API_BASE_URL}/submissions/${examId}/terminate-session?token=${encodeURIComponent(token || '')}`;
      const payload = JSON.stringify({
        reason: 'Candidate closed the browser or navigated away during the exam session.'
      });

      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(terminateUrl, blob);
      } else {
        fetch(terminateUrl, {
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: payload
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [examPhase, examId, API_BASE_URL]);

  // Anti-cheat tab switch and minimization listener (Strict Disqualification)
  useEffect(() => {
    if (examPhase !== 'in_progress') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (isSubmittingRef.current) return;
        const reasonText = 'Exam terminated and disqualified: Browser was minimized or candidate switched away from the active examination window.';
        setTerminationReason(reasonText);
        setExamPhase('terminated');
        localStorage.setItem(`exam_terminated_${examId}`, 'true');

        const token = localStorage.getItem('token');
        const terminateUrl = `${API_BASE_URL}/submissions/${examId}/terminate-session?token=${encodeURIComponent(token || '')}`;
        const payload = JSON.stringify({ reason: reasonText });

        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon(terminateUrl, blob);
        } else {
          fetch(terminateUrl, {
            method: 'POST',
            keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            body: payload
          });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [examPhase, examId, API_BASE_URL]);

  // Countdown timer effect
  useEffect(() => {
    if (examPhase !== 'in_progress' || secondsRemaining <= 0) return;

    const timer = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam(true); // Auto submit on expiry
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [examPhase, secondsRemaining]);

  const handleStartExam = () => {
    if (!exam || !exam.questions || exam.questions.length === 0) {
      alert('This exam currently has no questions configured.');
      return;
    }

    const durationSec = (exam.durationMinutes || 30) * 60;
    setSecondsRemaining(durationSec);
    setStartTimeMs(Date.now());
    setExamPhase('in_progress');
    setVisitedMap({ 0: true });

    // Try requesting fullscreen safely for distraction-free exam mode
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (e) {}
  };

  const handleSelectOption = (optionIndex) => {
    setAnswersMap(prev => ({
      ...prev,
      [currentIndex]: optionIndex
    }));
  };

  const handleCodeAnswerChange = (index, codeText) => {
    setTextAnswersMap(prev => ({
      ...prev,
      [index]: codeText
    }));
    // Also track in answersMap so question palette marks question as answered!
    if (codeText && codeText.trim().length > 0) {
      setAnswersMap(prev => ({
        ...prev,
        [index]: 'code_submitted'
      }));
    } else {
      setAnswersMap(prev => {
        const updated = { ...prev };
        delete updated[index];
        return updated;
      });
    }
  };

  const handleClearOption = () => {
    setAnswersMap(prev => {
      const updated = { ...prev };
      delete updated[currentIndex];
      return updated;
    });
    setTextAnswersMap(prev => {
      const updated = { ...prev };
      delete updated[currentIndex];
      return updated;
    });
  };

  const handleToggleMark = () => {
    setMarkedMap(prev => ({
      ...prev,
      [currentIndex]: !prev[currentIndex]
    }));
  };

  const handleJumpToQuestion = (index) => {
    setCurrentIndex(index);
    setVisitedMap(prev => ({ ...prev, [index]: true }));
  };

  const handleNext = () => {
    if (currentIndex < exam.questions.length - 1) {
      handleJumpToQuestion(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      handleJumpToQuestion(currentIndex - 1);
    }
  };

  const handleSubmitExam = async (isAutoSubmit = false) => {
    isSubmittingRef.current = true;
    setShowConfirmModal(false);
    setSubmitting(true);
    setError('');

    const timeSpentSeconds = startTimeMs ? Math.round((Date.now() - startTimeMs) / 1000) : 0;

    // Structure answers payload (supports both MCQs and typed programs)
    const formattedAnswers = exam.questions.map((q, idx) => {
      const isMcqAns = typeof answersMap[idx] === 'number';
      const selectedOptionIndex = isMcqAns ? answersMap[idx] : null;
      const typedCode = textAnswersMap[idx] || (typeof answersMap[idx] === 'string' && answersMap[idx] !== 'code_submitted' ? answersMap[idx] : '');
      return {
        questionId: q._id || q.id || String(idx + 1),
        questionOrder: q.order || idx + 1,
        selectedOptionIndex,
        selectedOptionText: selectedOptionIndex !== null && q.options ? q.options[selectedOptionIndex] : '',
        textAnswer: typedCode || ''
      };
    });

    try {
      const res = await axios.post(`${API_BASE_URL}/submissions/${examId}/submit-answers`, {
        answers: formattedAnswers,
        timeSpentSeconds,
        tabSwitchCount
      }, {
        headers: {
          'x-exam-attempt-seed': getAttemptSeed()
        }
      });

      // Clear attempt seed on successful completion
      localStorage.removeItem(`exam_attempt_seed_${examId}`);

      // Exit fullscreen if active
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } catch (e) {}

      setSubmission(res.data.submission);
      setExamPhase('submitted');
    } catch (err) {
      isSubmittingRef.current = false;
      setError(err.response?.data?.error || 'Failed to submit exam.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForceExitAndTerminate = async () => {
    setShowBackWarningModal(false);
    isSubmittingRef.current = true;
    localStorage.setItem(`exam_terminated_${examId}`, 'true');

    try {
      await axios.post(`${API_BASE_URL}/submissions/${examId}/terminate-session`, {
        reason: 'Candidate confirmed exit / navigated back during active examination.'
      });
    } catch (e) {}

    // Exit fullscreen if active
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch (e) {}

    setExamPhase('terminated');
    setTerminationReason('Candidate navigated away or confirmed Back exit during an active examination session.');
  };

  // Format timer MM:SS
  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '5rem 1rem', textAlign: 'center' }}>
        <RefreshCw size={36} className="pulse" color="var(--primary)" style={{ marginBottom: '1rem' }} />
        <h3 style={{ color: 'var(--text-muted)' }}>Loading exam portal session...</h3>
      </div>
    );
  }

  if (error && !exam) {
    return (
      <div className="container" style={{ padding: '5rem 1rem', textAlign: 'center' }}>
        <div className="glass-card" style={{ maxWidth: '500px', margin: '0 auto' }}>
          <AlertTriangle size={48} color="var(--rose)" style={{ marginBottom: '1rem' }} />
          <h3>Exam Unavailable</h3>
          <p style={{ color: 'var(--text-muted)', margin: '1rem 0' }}>{error}</p>
          <Link to="/student/dashboard" className="btn btn-primary">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  // ==========================================
  // PHASE: TERMINATED & DISQUALIFIED
  // ==========================================
  if (examPhase === 'terminated') {
    return (
      <div className="container" style={{ padding: '4.5rem 1.5rem', maxWidth: '640px' }}>
        <div className="glass-card fade-in" style={{ textAlign: 'center', border: '1.5px solid var(--rose)', padding: '2.5rem 2rem' }}>
          <div style={{
            display: 'inline-flex',
            background: 'rgba(244, 63, 94, 0.15)',
            padding: '1.1rem',
            borderRadius: '50%',
            marginBottom: '1.25rem',
            boxShadow: '0 0 30px rgba(244, 63, 94, 0.35)'
          }}>
            <ShieldAlert size={52} color="var(--rose)" />
          </div>

          <h2 style={{ fontSize: '1.85rem', fontWeight: '800', color: 'var(--rose)', marginBottom: '0.5rem' }}>
            Exam Session Locked / Terminated
          </h2>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: '1.5rem' }}>
            Re-entry was barred due to anti-cheat window minimization or navigation safeguards.
          </p>

          <div style={{
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.35)',
            borderRadius: '12px',
            padding: '1.1rem 1.25rem',
            marginBottom: '1.5rem',
            textAlign: 'left'
          }}>
            <div style={{ fontWeight: '800', color: 'var(--rose)', fontSize: '0.9rem', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertTriangle size={16} /> Violation Detected:
            </div>
            <div style={{ fontSize: '0.85rem', color: '#ffffff', lineHeight: '1.5' }}>
              {terminationReason || 'Candidate pressed the browser Back button or closed/navigated away from the exam window.'}
            </div>
          </div>

          <div style={{
            background: 'rgba(56, 189, 248, 0.08)',
            padding: '1.1rem 1.25rem',
            borderRadius: '10px',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            fontSize: '0.85rem',
            color: '#e2e8f0',
            lineHeight: '1.6',
            marginBottom: '2rem',
            textAlign: 'left'
          }}>
            <div style={{ fontWeight: '700', color: '#38bdf8', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <UserCheck size={16} /> Mistaken Minimization or Disconnection?
            </div>
            If you accidentally minimized the browser, switched apps, or lost connection, <strong>your examiner or administrator can re-allow your attempt</strong> from their dashboard. Once authorized, click <strong>"Check Clearance & Resume"</strong> below to enter back in without losing progress.
          </div>

          <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem 1.5rem' }}>
              <RefreshCw size={16} /> Check Clearance & Resume
            </button>
            <Link
              to="/student/dashboard"
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem 1.5rem' }}>
              <ArrowLeft size={16} /> Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="container" style={{ padding: '5rem 1rem', textAlign: 'center' }}>
        <div className="glass-card" style={{ maxWidth: '500px', margin: '0 auto' }}>
          <AlertTriangle size={48} color="var(--rose)" style={{ marginBottom: '1rem' }} />
          <h3>Exam Unavailable</h3>
          <p style={{ color: 'var(--text-muted)', margin: '1rem 0' }}>{error || 'Unable to retrieve exam details.'}</p>
          <Link to="/student/dashboard" className="btn btn-primary">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const questions = exam.questions || [];
  const currentQ = questions[currentIndex] || null;
  const answeredCount = Object.keys(answersMap).length;
  const markedCount = Object.keys(markedMap).filter(k => markedMap[k]).length;
  const unattemptedCount = Math.max(questions.length - answeredCount, 0);

  // ==========================================
  // PHASE 1: PRE-EXAM INSTRUCTIONS
  // ==========================================
  if (examPhase === 'instructions') {
    return (
      <div className="container" style={{ padding: '2.5rem 1.5rem', maxWidth: '820px' }}>
        <div className="glass-card fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <span className="badge badge-published" style={{ marginBottom: '0.5rem' }}>{exam.subject}</span>
              <h1 style={{ fontSize: '2rem', fontWeight: '800' }}>{exam.title}</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Topic: {exam.topic}</p>
            </div>
            {exam.examCode && (
              <div style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '0.5rem 1rem', borderRadius: '10px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block' }}>Exam Code</span>
                <span style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--primary)', letterSpacing: '0.08em' }}>{exam.examCode}</span>
              </div>
            )}
          </div>

          <div className="grid-3" style={{ marginBottom: '2rem' }}>
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
              <Clock size={24} color="var(--primary)" style={{ marginBottom: '0.3rem' }} />
              <div style={{ fontSize: '1.2rem', fontWeight: '700' }}>{exam.durationMinutes} Mins</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Duration</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
              <Award size={24} color="var(--emerald)" style={{ marginBottom: '0.3rem' }} />
              <div style={{ fontSize: '1.2rem', fontWeight: '700' }}>{questions.length} Questions</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Marks: {exam.totalMarks || (questions.length * 2)}</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
              <ShieldAlert size={24} color="var(--accent)" style={{ marginBottom: '0.3rem' }} />
              <div style={{ fontSize: '1.2rem', fontWeight: '700' }}>{exam.passingPercentage || 40}%</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Passing Score</div>
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '1.25rem', marginBottom: '2rem' }}>
            <h4 style={{ fontSize: '1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={18} color="var(--primary)" /> Important Examination Rules:
            </h4>
            <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.7' }}>
              <li>This test contains <strong>{questions.length} Multiple Choice Questions</strong>.</li>
              <li>Once you start, the countdown timer will begin and <strong>cannot be paused</strong>.</li>
              <li>You can navigate freely between questions using the Question Palette on the right.</li>
              <li>You can <strong>Mark for Review</strong> any question to return to it later before submission.</li>
              <li style={{ color: '#fda4af' }}>
                <strong>Strict Anti-Cheat Rule:</strong> Pressing the browser <strong>Back</strong> button, <strong>minimizing the browser window</strong>, switching apps/tabs, or <strong>closing/leaving</strong> the browser will immediately <strong>terminate and disqualify your exam with 0 marks</strong>. You will be permanently barred from re-entering or retaking this exam.
              </li>
              <li>When the timer reaches 00:00, your exam will automatically be submitted and graded.</li>
            </ul>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <Link to="/student/dashboard" className="btn btn-secondary">
              <ArrowLeft size={16} /> Return to Dashboard
            </Link>
            <button onClick={handleStartExam} className="btn btn-success" style={{ padding: '0.85rem 2rem', fontSize: '1.05rem' }}>
              Start Examination Now <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // PHASE 2: IN-PROGRESS TEST ROOM
  // ==========================================
  if (examPhase === 'in_progress') {
    const isTimeUrgent = secondsRemaining < 300; // Under 5 mins
    const isTimeCritical = secondsRemaining < 60; // Under 1 min

    return (
      <div className="container" style={{ padding: '1.5rem 1rem', maxWidth: '1200px' }}>
        {/* Anti-Cheat Violation Warning Modal */}
        {showProctorWarning && (
          <div className="modal-backdrop">
            <div className="modal-dialog" style={{ textAlign: 'center', border: '1.5px solid var(--rose)' }}>
              <ShieldAlert size={56} color="var(--rose)" style={{ marginBottom: '1rem' }} />
              <h2 style={{ fontSize: '1.5rem', color: 'var(--rose)' }}>Anti-Cheat Warning</h2>
              <p style={{ margin: '1rem 0', color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                You navigated away or switched browser tabs! This activity has been recorded.
              </p>
              <div style={{ background: 'rgba(244, 63, 94, 0.15)', padding: '0.75rem', borderRadius: '10px', marginBottom: '1.5rem', fontWeight: '700', color: '#f43f5e' }}>
                Violations Logged: {tabSwitchCount}
              </div>
              <button onClick={() => setShowProctorWarning(false)} className="btn btn-danger" style={{ width: '100%' }}>
                I Understand & Return to Exam
              </button>
            </div>
          </div>
        )}

        {/* Back Button Navigation Warning Modal */}
        {showBackWarningModal && (
          <div className="modal-backdrop">
            <div className="modal-dialog" style={{ textAlign: 'center', border: '1.5px solid var(--rose)', maxWidth: '480px' }}>
              <div style={{
                display: 'inline-flex',
                background: 'rgba(244, 63, 94, 0.15)',
                padding: '0.8rem',
                borderRadius: '50%',
                marginBottom: '1rem'
              }}>
                <ShieldAlert size={44} color="var(--rose)" />
              </div>
              <h2 style={{ fontSize: '1.45rem', color: 'var(--rose)', fontWeight: '800' }}>
                Back Navigation Prohibited!
              </h2>
              <p style={{ margin: '0.75rem 0 1rem 0', color: 'var(--text-main)', fontSize: '0.92rem', lineHeight: '1.6' }}>
                You attempted to press the browser <strong>Back</strong> button. Navigating back during an active examination is strictly disabled.
              </p>
              <div style={{
                background: 'rgba(244, 63, 94, 0.12)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                marginBottom: '1.5rem',
                fontSize: '0.82rem',
                color: '#ffb3ba',
                lineHeight: '1.45',
                textAlign: 'left'
              }}>
                ⚠️ <strong>Strict Rule:</strong> Leaving or closing this window will <strong>permanently terminate your exam</strong>. You will be disqualified and barred from re-entering or retaking it.
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button
                  onClick={() => setShowBackWarningModal(false)}
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '0.75rem' }}>
                  Stay & Continue Exam
                </button>
                <button
                  onClick={handleForceExitAndTerminate}
                  className="btn btn-secondary"
                  style={{ borderColor: 'var(--rose)', color: 'var(--rose)', padding: '0.75rem' }}>
                  Forfeit & Exit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Submit Confirmation Modal */}
        {showConfirmModal && (
          <div className="modal-backdrop">
            <div className="modal-dialog">
              <h2 style={{ fontSize: '1.4rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle size={24} color="var(--emerald)" /> Confirm Final Submission
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Are you ready to submit your exam? You cannot modify your answers after submitting.
              </p>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span>Total Questions:</span>
                  <strong>{questions.length}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--emerald)' }}>
                  <span>Answered:</span>
                  <strong>{answeredCount}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--amber)' }}>
                  <span>Unanswered:</span>
                  <strong>{unattemptedCount}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent)' }}>
                  <span>Marked for Review:</span>
                  <strong>{markedCount}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={() => setShowConfirmModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Continue Test
                </button>
                <button onClick={() => handleSubmitExam(false)} className="btn btn-success" style={{ flex: 1 }} disabled={submitting}>
                  {submitting ? 'Evaluating...' : 'Yes, Submit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top Floating Action Bar with Timer & Status */}
        <div className="glass-card fade-in" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {exam.subject} • {exam.topic}
            </div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: '800', marginTop: '0.1rem' }}>{exam.title}</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {/* Real-time Countdown Timer */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.25rem',
              borderRadius: '12px',
              fontWeight: '800',
              fontSize: '1.2rem',
              letterSpacing: '0.05em',
              background: isTimeCritical ? 'rgba(244, 63, 94, 0.2)' : (isTimeUrgent ? 'rgba(245, 158, 11, 0.2)' : 'rgba(99, 102, 241, 0.2)'),
              border: `1.5px solid ${isTimeCritical ? 'var(--rose)' : (isTimeUrgent ? 'var(--amber)' : 'var(--primary)')}`,
              color: isTimeCritical ? '#f43f5e' : (isTimeUrgent ? '#fbbf24' : '#818cf8')
            }} className={isTimeCritical ? 'pulse' : ''}>
              <Clock size={20} />
              <span>{formatTime(secondsRemaining)}</span>
            </div>

            <button
              type="button"
              onClick={() => setShowMobilePalette(!showMobilePalette)}
              className="btn btn-secondary palette-mobile-trigger">
              <Layers size={16} /> Palette ({currentIndex + 1}/{questions.length})
            </button>

            <button onClick={() => setShowConfirmModal(true)} className="btn btn-success" disabled={submitting}>
              <CheckCircle size={18} /> Submit Exam
            </button>
          </div>
        </div>

        {/* Main Test Body: Question Card + Palette */}
        <div className="exam-room-grid">
          {/* Left: Active Question Box */}
          <div className="glass-card fade-in" style={{ padding: '2rem' }}>
            {currentQ ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{
                      background: 'var(--primary)',
                      color: '#fff',
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800',
                      fontSize: '0.9rem'
                    }}>
                      Q{currentIndex + 1}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Question {currentIndex + 1} of {questions.length}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge badge-published">+{currentQ.maxMarks || 2} Marks</span>
                    <button
                      onClick={handleToggleMark}
                      style={{
                        background: markedMap[currentIndex] ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${markedMap[currentIndex] ? 'var(--accent)' : 'var(--border-light)'}`,
                        color: markedMap[currentIndex] ? '#c084fc' : 'var(--text-muted)',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}>
                      <Bookmark size={14} fill={markedMap[currentIndex] ? '#c084fc' : 'none'} />
                      {markedMap[currentIndex] ? 'Marked' : 'Mark for Review'}
                    </button>
                  </div>
                </div>

                {/* Question Category Tag */}
                <div style={{ marginBottom: '0.6rem' }}>
                  {currentQ.category === 'programming' ? (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      background: 'rgba(56, 189, 248, 0.12)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      color: '#38bdf8',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '700'
                    }}>
                      💻 Programming & Code Analysis (Objective)
                    </span>
                  ) : (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      background: 'rgba(99, 102, 241, 0.12)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      color: 'var(--primary)',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '700'
                    }}>
                      📘 Theory Concept (Objective)
                    </span>
                  )}
                </div>

                {/* Question Prompt */}
                <h3 style={{
                  fontSize: '1.15rem',
                  fontWeight: '600',
                  lineHeight: '1.6',
                  marginBottom: currentQ.codeSnippet ? '1rem' : '1.75rem',
                  color: '#f8fafc',
                  whiteSpace: 'pre-wrap'
                }}>
                  {currentQ.prompt}
                </h3>

                {/* Code Snippet Display (if present in question) */}
                {currentQ.codeSnippet && (
                  <div style={{ marginBottom: '1.75rem' }}>
                    <CodeBlock
                      code={currentQ.codeSnippet}
                      language={currentQ.language || 'code'}
                      title={`Reference Program (${(currentQ.language || 'code').toUpperCase()})`}
                      fontSize="0.86rem"
                    />
                  </div>
                )}

                {/* Question Response Section: Options (MCQ) OR Code Editor (Coding/Program) */}
                <div style={{ marginBottom: '2.5rem' }}>
                  {(currentQ.options && currentQ.options.length >= 2) ? (
                    currentQ.options.map((opt, optIdx) => {
                      const isSelected = answersMap[currentIndex] === optIdx;
                      const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
                      return (
                        <div
                          key={optIdx}
                          className={`option-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleSelectOption(optIdx)}>
                          <div className="option-letter">{letters[optIdx]}</div>
                          <div style={{ flex: 1, fontSize: '1rem', color: isSelected ? '#ffffff' : 'var(--text-main)' }}>
                            {opt}
                          </div>
                          {isSelected && (
                            <div style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              background: 'var(--primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <Check size={14} color="#ffffff" strokeWidth={3} />
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    /* Interactive Student Code Editor */
                    <div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.65rem',
                        flexWrap: 'wrap',
                        gap: '0.5rem'
                      }}>
                        <label style={{
                          fontWeight: '700',
                          fontSize: '0.92rem',
                          color: '#38bdf8',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          margin: 0
                        }}>
                          <Terminal size={16} /> Type Your Program Solution
                        </label>
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          ⌨️ <strong>Tab</strong> indents 4 spaces &bull; Line numbers & formatting preserved
                        </span>
                      </div>

                      <CodeEditor
                        value={textAnswersMap[currentIndex] || ''}
                        onChange={(val) => handleCodeAnswerChange(currentIndex, val)}
                        language={codeLanguages[currentIndex] || currentQ.language || 'python'}
                        onLanguageChange={(lang) => setCodeLanguages(prev => ({ ...prev, [currentIndex]: lang }))}
                        placeholder={`// Type your program code here...\n// Press Tab to indent code (4 spaces)\n\n`}
                        minHeight="320px"
                        title={`Solution Editor (${(codeLanguages[currentIndex] || currentQ.language || 'python').toUpperCase()})`}
                      />
                    </div>
                  )}
                </div>

                {/* Bottom Navigation Toolbar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={handlePrev} className="btn btn-secondary" disabled={currentIndex === 0}>
                      <ArrowLeft size={16} /> Previous
                    </button>
                    {answersMap[currentIndex] !== undefined && (
                      <button onClick={handleClearOption} className="btn btn-secondary" style={{ color: 'var(--rose)' }}>
                        Clear Choice
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {currentIndex < questions.length - 1 ? (
                      <button onClick={handleNext} className="btn btn-primary">
                        Save & Next <ArrowRight size={16} />
                      </button>
                    ) : (
                      <button onClick={() => setShowConfirmModal(true)} className="btn btn-success">
                        Review & Submit <CheckCircle size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {/* Right Sidebar: Status & Question Palette */}
          <div className={`exam-sidebar ${showMobilePalette ? 'mobile-drawer-open' : ''}`}>
            {/* Status Legend */}
            <div className="glass-card fade-in" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '0.95rem', margin: 0, fontWeight: '700' }}>Question Palette</h4>
                {showMobilePalette && (
                  <button
                    type="button"
                    onClick={() => setShowMobilePalette(false)}
                    className="btn btn-secondary mobile-only"
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>
                    <X size={14} /> Close
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--emerald)' }}></div>
                  <span>Answered ({answeredCount})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--accent)' }}></div>
                  <span>Marked ({markedCount})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--amber)' }}></div>
                  <span>Visited</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(255,255,255,0.1)' }}></div>
                  <span>Not Visited</span>
                </div>
              </div>

              {/* Number Chips Grid */}
              <div className="palette-grid">
                {questions.map((_, idx) => {
                  const isCurrent = currentIndex === idx;
                  const isAnswered = answersMap[idx] !== undefined;
                  const isMarked = markedMap[idx];
                  const isVisited = visitedMap[idx];

                  let chipClass = 'unvisited';
                  if (isAnswered) chipClass = 'answered';
                  else if (isMarked) chipClass = 'marked';
                  else if (isVisited) chipClass = 'visited';

                  return (
                    <div
                      key={idx}
                      className={`palette-chip ${chipClass} ${isCurrent ? 'current' : ''}`}
                      onClick={() => {
                        handleJumpToQuestion(idx);
                        setShowMobilePalette(false);
                      }}>
                      {idx + 1}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Anti-Cheat & Security Card */}
            <div className="glass-card fade-in" style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', color: 'var(--emerald)', fontWeight: '600' }}>
                <ShieldAlert size={14} /> Proctoring Session Active
              </div>
              <div style={{ color: 'var(--text-muted)' }}>
                Focus tracking enabled. Tab switches: <strong style={{ color: tabSwitchCount > 0 ? 'var(--rose)' : 'inherit' }}>{tabSwitchCount}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // PHASE 3: SUBMITTED & INSTANT SCORECARD
  // ==========================================
  if (examPhase === 'submitted' && submission) {
    const isPassed = submission.passed;
    const marks = submission.marksObtained ?? 0;
    const total = submission.totalMarks || (questions.length * 2);
    const percentage = submission.percentage ?? Math.round((marks / total) * 100);

    return (
      <div className="container" style={{ padding: '2.5rem 1.5rem', maxWidth: '900px' }}>
        {/* Scorecard Hero Banner */}
        <div className="glass-card fade-in" style={{
          textAlign: 'center',
          padding: '3rem 2rem',
          marginBottom: '2rem',
          background: isPassed
            ? 'radial-gradient(ellipse at center, rgba(16, 185, 129, 0.15) 0%, rgba(18, 25, 41, 0.85) 70%)'
            : 'radial-gradient(ellipse at center, rgba(244, 63, 94, 0.15) 0%, rgba(18, 25, 41, 0.85) 70%)'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: isPassed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
            border: `2px solid ${isPassed ? 'var(--emerald)' : 'var(--rose)'}`,
            marginBottom: '1rem'
          }}>
            {isPassed ? <Award size={42} color="var(--emerald)" /> : <AlertTriangle size={42} color="var(--rose)" />}
          </div>

          <h1 style={{ fontSize: '2.4rem', fontWeight: '800', marginBottom: '0.4rem' }}>
            {isPassed ? 'Exam Completed Successfully!' : 'Exam Completed'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '500px', margin: '0 auto 2rem auto' }}>
            {submission.feedback || (isPassed ? 'Outstanding job! You met the passing score criteria.' : 'Keep practicing to improve your score.')}
          </p>

          <div className="grid-4" style={{ maxWidth: '750px', margin: '0 auto 2rem auto' }}>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.25rem', borderRadius: '12px' }}>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: isPassed ? 'var(--emerald)' : 'var(--rose)' }}>
                {marks}/{total}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Score Obtained</div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.25rem', borderRadius: '12px' }}>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: '#ffffff' }}>
                {percentage}%
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Percentage</div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.25rem', borderRadius: '12px' }}>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--primary)' }}>
                {submission.correctCount ?? 0}/{submission.totalQuestions || questions.length}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Correct Answers</div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.25rem', borderRadius: '12px' }}>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--accent)' }}>
                {submission.timeSpentSeconds ? Math.round(submission.timeSpentSeconds / 60) : 0}m
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Time Taken</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <Link to="/student/dashboard" className="btn btn-primary">
              Return to Student Dashboard
            </Link>
          </div>
        </div>

        {/* Detailed Question-by-Question Solution Review */}
        {submission.answers && submission.answers.length > 0 && (
          <div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Eye size={20} color="var(--primary)" /> Detailed Solution & Answer Review
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {submission.answers.map((ans, idx) => {
                const isCorrect = ans.isCorrect;
                return (
                  <div
                    key={idx}
                    className="glass-card fade-in"
                    style={{
                      borderLeft: `4px solid ${isCorrect ? 'var(--emerald)' : 'var(--rose)'}`,
                      padding: '1.5rem'
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                        Question {ans.questionOrder || idx + 1}
                      </span>
                      <span className={`badge ${isCorrect ? 'badge-published' : 'badge-draft'}`} style={{ color: isCorrect ? '#34d399' : '#f43f5e' }}>
                        {isCorrect ? `+${ans.marksAwarded} Marks (Correct)` : `0 Marks (Incorrect)`}
                      </span>
                    </div>

                    <h4 style={{ fontSize: '1.05rem', fontWeight: '600', marginBottom: '1rem', color: '#ffffff' }}>
                      {ans.prompt}
                    </h4>

                    <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1rem', borderRadius: '10px', fontSize: '0.9rem', marginBottom: '1rem' }}>
                      <div style={{ marginBottom: '0.4rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Your Selected Answer: </span>
                        <strong style={{ color: isCorrect ? 'var(--emerald)' : 'var(--rose)' }}>
                          {ans.selectedOptionText || '(Unanswered)'}
                        </strong>
                      </div>
                      {!isCorrect && ans.correctAnswer && (
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Correct Answer: </span>
                          <strong style={{ color: 'var(--emerald)' }}>{ans.correctAnswer}</strong>
                        </div>
                      )}
                    </div>

                    {ans.explanation && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
                        <strong>Explanation:</strong> {ans.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
