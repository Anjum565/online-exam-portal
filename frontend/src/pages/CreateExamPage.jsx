import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import {
  Sparkles, Calendar, Clock, BookOpen, AlertCircle,
  CheckCircle, ShieldCheck, Key, Settings, ExternalLink, X, RefreshCw,
  Clipboard, FileText, Check, ListChecks, ArrowRight, Code,
  Building, GraduationCap
} from 'lucide-react';
import { parsePastedQuestions } from '../utils/questionParser';

const AVAILABLE_COURSES = [
  'B.Tech',
  'BCA',
  'MCA',
  'B.Sc',
  'M.Sc',
  'B.Com',
  'M.Com',
  'BBA',
  'MBA',
  'BA',
  'MA',
  'Diploma',
  'All Courses',
  'Other'
];

const AVAILABLE_SEMESTERS = [
  'Semester 1',
  'Semester 2',
  'Semester 3',
  'Semester 4',
  'Semester 5',
  'Semester 6',
  'Semester 7',
  'Semester 8',
  'All Semesters',
  'Year 1 (Annual)',
  'Year 2 (Annual)',
  'Year 3 (Annual)'
];

export default function CreateExamPage() {
  const { user, API_BASE_URL } = useContext(AuthContext);

  // Mode selection: 'ai' = Auto-generate with AI/engine, 'paste' = Paste own questions
  const [creationMode, setCreationMode] = useState('ai');

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [examCode, setExamCode] = useState('');
  const [examType, setExamType] = useState('combined_objective');
  const [difficulty, setDifficulty] = useState('medium');
  const [questionCount, setQuestionCount] = useState(5);
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [passingPercentage, setPassingPercentage] = useState(50);

  // Target Course & Semester Scope State
  const [targetCourse, setTargetCourse] = useState(user?.course || 'B.Tech');
  const [targetSemester, setTargetSemester] = useState(user?.semester || 'Semester 4');
  const [customCourse, setCustomCourse] = useState('');

  // Synchronize targetCourse with user affiliation once loaded
  useEffect(() => {
    if (user?.course && !targetCourse) setTargetCourse(user.course);
    if (user?.semester && !targetSemester) setTargetSemester(user.semester);
  }, [user]);

  // Paste Mode State
  const [pastedText, setPastedText] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState([]);
  const [pasteParseError, setPasteParseError] = useState('');

  // Helper to format Date into YYYY-MM-DDTHH:mm for datetime-local input using local wall-clock
  const toLocalISO = (d) => {
    if (!d) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Helper to parse local datetime-local string to Date object in exact local browser timezone
  const parseLocalInputToDate = (str) => {
    if (!str) return new Date();
    const [datePart, timePart] = str.split('T');
    if (!datePart || !timePart) return new Date(str);
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes, 0);
  };

  // Helper to convert local datetime-local string to UTC ISO string with zero timezone distortion
  const localInputToISO = (str) => {
    if (!str) return null;
    const d = parseLocalInputToDate(str);
    return d.toISOString();
  };

  // Default start time now, end time = start time + duration (e.g. +10 mins)
  const now = new Date();
  const defaultStart = toLocalISO(now);
  const defaultEnd = toLocalISO(new Date(now.getTime() + 10 * 60000));

  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(defaultEnd);

  // Automatically adjust Schedule End Window when Duration changes
  const handleDurationChange = (val) => {
    setDurationMinutes(val);
    const mins = parseInt(val, 10);
    if (!isNaN(mins) && mins > 0) {
      const baseStart = startTime ? parseLocalInputToDate(startTime) : new Date();
      if (!isNaN(baseStart.getTime())) {
        const newEnd = new Date(baseStart.getTime() + mins * 60000);
        setEndTime(toLocalISO(newEnd));
        if (!startTime) {
          setStartTime(toLocalISO(baseStart));
        }
      }
    }
  };

  // Automatically adjust End Window when Start Window changes
  const handleStartTimeChange = (val) => {
    setStartTime(val);
    const mins = parseInt(durationMinutes, 10) || 10;
    if (val) {
      const baseStart = parseLocalInputToDate(val);
      if (!isNaN(baseStart.getTime())) {
        const newEnd = new Date(baseStart.getTime() + mins * 60000);
        setEndTime(toLocalISO(newEnd));
      }
    }
  };

  // Quick preset adjusters
  const handleSetExactWindow = (minsToAdd) => {
    const baseStart = startTime ? parseLocalInputToDate(startTime) : new Date();
    const newEnd = new Date(baseStart.getTime() + minsToAdd * 60000);
    setEndTime(toLocalISO(newEnd));
  };

  const handleSetStartNow = () => {
    const currentNow = new Date();
    setStartTime(toLocalISO(currentNow));
    const mins = parseInt(durationMinutes, 10) || 10;
    const newEnd = new Date(currentNow.getTime() + mins * 60000);
    setEndTime(toLocalISO(newEnd));
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // AI Configuration State
  const [aiConfig, setAiConfig] = useState({ isConfigured: false, preview: null });
  const [showAiModal, setShowAiModal] = useState(false);
  const [inputApiKey, setInputApiKey] = useState('');
  const [savingAiKey, setSavingAiKey] = useState(false);
  const [aiKeyMsg, setAiKeyMsg] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    fetchAiConfig();
  }, []);

  const fetchAiConfig = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/admin/ai-config`);
      setAiConfig(res.data);
    } catch (e) {
      console.warn('Could not fetch AI config:', e.message);
    }
  };

  const handleSaveAiKey = async (e) => {
    e.preventDefault();
    if (!inputApiKey.trim()) return;
    setSavingAiKey(true);
    setAiKeyMsg('');

    try {
      const res = await axios.post(`${API_BASE_URL}/admin/ai-config`, {
        apiKey: inputApiKey.trim()
      });
      setAiConfig({ isConfigured: true, preview: res.data.preview });
      setAiKeyMsg('✅ Gemini API Key saved! Intelligent AI generation is now fully active.');
      setTimeout(() => {
        setShowAiModal(false);
        setAiKeyMsg('');
      }, 1200);
    } catch (err) {
      setAiKeyMsg(err.response?.data?.error || 'Failed to connect API Key. Please check the key.');
    } finally {
      setSavingAiKey(false);
    }
  };

  // Helper to parse pasted text into questions
  const handleParsePastedText = () => {
    setPasteParseError('');
    if (!pastedText.trim()) {
      setPasteParseError('Please paste your questions into the box first.');
      return;
    }

    const questions = parsePastedQuestions(pastedText);
    if (questions.length === 0) {
      setPasteParseError('Could not detect questions. Make sure questions have numbers (e.g. 1., Q1:) and options (A, B, C, D).');
      return;
    }

    setParsedQuestions(questions);
    setQuestionCount(questions.length);
  };

  const handleLoadSampleText = () => {
    const sample = `1. What is the output of print(2 ** 3) in Python?
A) 6
B) 8
C) 9
D) 5
Answer: B
Explanation: 2 raised to the power 3 is 8.

2. Consider the following code snippet. What will be the printed output?
\`\`\`python
items = ["apple", "banana", "cherry"]
print(items[-1])
\`\`\`
A) apple
B) banana
C) cherry
D) IndexError
Answer: C
Explanation: Index -1 accesses the last item in the list.

3. Which normal form in relational database design eliminates transitive dependencies?
A) First Normal Form (1NF)
B) Second Normal Form (2NF)
C) Third Normal Form (3NF)
D) Boyce-Codd Normal Form (BCNF)
Answer: C
Explanation: 3NF requires tables to be in 2NF and have no transitive functional dependencies.`;

    setPastedText(sample);
    const parsed = parsePastedQuestions(sample);
    setParsedQuestions(parsed);
    setQuestionCount(Math.min(10, parsed.length));
    setPasteParseError('');
  };

  const [randomizeQuestions, setRandomizeQuestions] = useState(true);

  // Set the number of questions that should appear on each candidate's exam from the pool
  const handleSetQuestionsToAppear = (count) => {
    if (!parsedQuestions || parsedQuestions.length === 0) return;
    const num = Math.min(Math.max(1, parseInt(count, 10) || 1), parsedQuestions.length);
    setQuestionCount(num);
  };

  const handleCreateAndGenerate = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let finalQuestions = [];

      if (creationMode === 'paste') {
        finalQuestions = parsedQuestions;
        // If user typed/pasted but did not click the Parse button, parse on the fly
        if (finalQuestions.length === 0 && pastedText.trim()) {
          finalQuestions = parsePastedQuestions(pastedText);
        }

        if (finalQuestions.length === 0) {
          setError('Please paste your questions or parse them before creating the exam.');
          setLoading(false);
          return;
        }
      }

      const targetQuestionCount = questionCount && parseInt(questionCount, 10) > 0
        ? Math.min(parseInt(questionCount, 10), finalQuestions.length > 0 ? finalQuestions.length : 100)
        : (finalQuestions.length > 0 ? Math.min(10, finalQuestions.length) : 5);

      const finalCourse = targetCourse === 'Other' ? (customCourse.trim() || 'Custom Course') : targetCourse;
      // Step 1: Create exam (passing parsed questions directly if in paste mode)
      const createRes = await axios.post(`${API_BASE_URL}/exams`, {
        title,
        department: user?.department || 'General',
        course: finalCourse || user?.course || '',
        semester: targetSemester || user?.semester || '',
        subject,
        topic,
        examCode: examCode.trim().toUpperCase(),
        examType,
        questionComposition: examType,
        difficulty,
        questionCount: targetQuestionCount,
        randomizeQuestions,
        durationMinutes,
        passingPercentage,
        startTime: localInputToISO(startTime),
        endTime: localInputToISO(endTime),
        questions: finalQuestions
      });

      const examId = createRes.data._id || createRes.data.id;

      // Step 2: Trigger AI generation ONLY if we are in AI mode
      if (creationMode === 'ai') {
        await axios.post(`${API_BASE_URL}/exams/${examId}/generate-questions`);
      }

      navigate(`/teacher/review-questions/${examId}`);
    } catch (err) {
      console.error('Exam creation error:', err);
      setError(err.response?.data?.error || 'Failed to create exam.');
    } finally {
      setLoading(false);
    }
  };

  if (user && user.isVerified === false) {
    return (
      <div className="container" style={{ padding: '3.5rem 1.5rem', maxWidth: '620px' }}>
        <div className="glass-card fade-in" style={{ textAlign: 'center', padding: '3rem 2rem', border: '1.5px solid rgba(245, 158, 11, 0.4)' }}>
          <div style={{
            display: 'inline-flex',
            background: 'rgba(245, 158, 11, 0.15)',
            padding: '1rem',
            borderRadius: '50%',
            marginBottom: '1.25rem'
          }}>
            <AlertCircle size={48} color="#fbbf24" />
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#fbbf24', marginBottom: '0.75rem' }}>
            Account Pending Administrator Approval
          </h2>
          <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
            Your faculty teacher account for <strong>{user.department || 'your department'}</strong> has been registered but is awaiting administrator verification. Examination creation is disabled until approved.
          </p>
          <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '1rem', borderRadius: '10px', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>
            Please contact your institution's examination administrator to approve your account on the Admin Portal.
          </div>
          <button onClick={() => navigate('/teacher/dashboard')} className="btn btn-secondary">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 1.5rem', maxWidth: '840px' }}>
      <div className="glass-card fade-in">
        {/* Header Title */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            display: 'inline-flex',
            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
            padding: '0.8rem',
            borderRadius: '16px',
            marginBottom: '1rem',
            boxShadow: '0 8px 25px rgba(99, 102, 241, 0.4)'
          }}>
            <Sparkles size={32} color="#ffffff" />
          </div>
          <h2 style={{ fontSize: '1.9rem', fontWeight: '800' }}>Create New Examination</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.3rem' }}>
            Choose how you want to create your exam: auto-generate questions or paste your own.
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.75rem',
          background: 'rgba(0,0,0,0.3)',
          padding: '0.4rem',
          borderRadius: '14px',
          marginBottom: '1.75rem',
          border: '1px solid var(--border-light)'
        }}>
          <button
            type="button"
            onClick={() => setCreationMode('ai')}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              background: creationMode === 'ai' ? 'var(--primary)' : 'transparent',
              color: creationMode === 'ai' ? '#ffffff' : 'var(--text-muted)',
              transition: 'all 0.2s ease',
              boxShadow: creationMode === 'ai' ? '0 4px 15px rgba(99, 102, 241, 0.4)' : 'none'
            }}>
            <Sparkles size={16} /> Auto-Generate with AI / Topics
          </button>

          <button
            type="button"
            onClick={() => setCreationMode('paste')}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              background: creationMode === 'paste' ? 'var(--primary)' : 'transparent',
              color: creationMode === 'paste' ? '#ffffff' : 'var(--text-muted)',
              transition: 'all 0.2s ease',
              boxShadow: creationMode === 'paste' ? '0 4px 15px rgba(99, 102, 241, 0.4)' : 'none'
            }}>
            <Clipboard size={16} /> Paste My Own Questions
          </button>
        </div>

        {/* AI Engine Status Banner (Shown in AI Mode) */}
        {creationMode === 'ai' && (
          <div style={{
            background: aiConfig.isConfigured ? 'rgba(16, 185, 129, 0.1)' : 'rgba(99, 102, 241, 0.1)',
            border: `1px solid ${aiConfig.isConfigured ? 'rgba(16, 185, 129, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`,
            padding: '0.85rem 1.15rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Sparkles size={18} color={aiConfig.isConfigured ? 'var(--emerald)' : 'var(--primary)'} />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#ffffff' }}>
                  {aiConfig.isConfigured ? (
                    <>Google Gemini AI Connected ({aiConfig.preview})</>
                  ) : (
                    <>Topic-Tailored Generator Active</>
                  )}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {aiConfig.isConfigured ? (
                    'Deep AI models will generate bespoke questions matching your exact topics.'
                  ) : (
                    'Connect free Gemini key for limitless custom question generation on any subject.'
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              className="btn btn-secondary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem' }}>
              <Settings size={14} /> {aiConfig.isConfigured ? 'Change AI Key' : 'Connect Free Gemini AI'}
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: '#f43f5e',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            marginBottom: '1.25rem',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle size={18} /> {error}
          </div>
        )}

        <form onSubmit={handleCreateAndGenerate}>
          {/* Department Locked Banner */}
          <div style={{
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                background: 'rgba(99, 102, 241, 0.2)',
                padding: '0.6rem',
                borderRadius: '10px'
              }}>
                <Building size={20} color="var(--primary)" />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Target Department (Enforced Scoping)
                </span>
                <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#ffffff' }}>
                  {user?.department || 'General Department'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {user?.course && (
                <span className="badge badge-published" style={{ fontSize: '0.78rem' }}>
                  {user.course} {user.semester ? `• ${user.semester}` : ''}
                </span>
              )}
              <span style={{
                fontSize: '0.75rem',
                fontWeight: '700',
                color: 'var(--emerald)',
                background: 'rgba(16, 185, 129, 0.15)',
                padding: '0.35rem 0.65rem',
                borderRadius: '6px'
              }}>
                🔒 Locked to Your Dept
              </span>
            </div>
          </div>

          {/* Academic Course & Semester Scoping Selector */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-light)',
            borderRadius: '12px',
            padding: '1.1rem 1.25rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700', fontSize: '0.92rem', color: '#ffffff' }}>
                <GraduationCap size={18} color="var(--primary)" /> Target Course & Semester Scope
              </div>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: '700',
                color: 'var(--amber)',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                padding: '0.2rem 0.6rem',
                borderRadius: '6px'
              }}>
                🔒 Course Scoping Enforced
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: '1.5' }}>
              Only students enrolled in this exact Course and Semester will be permitted to access or sit for this examination. Students of other courses in the same department are strictly prevented from appearing.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Target Academic Course</label>
                <select
                  className="form-select"
                  value={targetCourse}
                  onChange={(e) => setTargetCourse(e.target.value)}
                  required
                >
                  {AVAILABLE_COURSES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {targetCourse === 'Other' && (
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Specify target course name"
                    style={{ marginTop: '0.5rem' }}
                    value={customCourse}
                    onChange={(e) => setCustomCourse(e.target.value)}
                    required
                  />
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Target Semester</label>
                <select
                  className="form-select"
                  value={targetSemester}
                  onChange={(e) => setTargetSemester(e.target.value)}
                  required
                >
                  {AVAILABLE_SEMESTERS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Exam Title */}
          <div className="form-group">
            <label className="form-label">Exam Title</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Midterm Evaluation: Database Management & SQL"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Subject / Paper</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Data Structures, Web Development"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
              {user?.subjects && user.subjects.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Quick Select Paper:</span>
                  {user.subjects.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSubject(s)}
                      style={{
                        background: subject === s ? 'var(--primary)' : 'rgba(255, 255, 255, 0.06)',
                        color: subject === s ? '#ffffff' : 'var(--text-main)',
                        border: `1px solid ${subject === s ? 'var(--primary)' : 'var(--border-light)'}`,
                        borderRadius: '6px',
                        padding: '0.2rem 0.6rem',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Exam Code (Optional)</label>
              <input
                type="text"
                className="form-input"
                style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
                placeholder="e.g. CS301 (Auto-assigned if empty)"
                value={examCode}
                onChange={(e) => setExamCode(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label">Specific Topics Covered (Comma-separated)</label>
              <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '600' }}>
                Used to classify & structure questions
              </span>
            </div>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Thermodynamics, Heat Transfer, Entropy, Carnot Cycle"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
            />
          </div>

          {/* ======================================================== */}
          {/* TAB 1: AUTO-GENERATE OPTIONS                             */}
          {/* ======================================================== */}
          {creationMode === 'ai' && (
            <div className="fade-in">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label className="form-label" style={{ margin: 0 }}>Question Composition & Objective Mode</label>
                    <span className="badge badge-published" style={{ background: 'rgba(99, 102, 241, 0.18)', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: '700' }}>
                      {examType !== 'subjective' ? '🎯 100% Objective Mode (MCQs)' : '📝 Subjective Mode'}
                    </span>
                  </div>
                  <select className="form-select" value={examType} onChange={(e) => setExamType(e.target.value)}>
                    <option value="combined_objective">
                      ✨ Combined: Theory Concepts + Programming / Code Analysis (Objective MCQs)
                    </option>
                    <option value="programming_objective">
                      💻 Programming & Code Snippets Only (Objective MCQs - Output Prediction & Bugs)
                    </option>
                    <option value="theory_objective">
                      📘 Theoretical Concepts & Principles Only (Objective MCQs)
                    </option>
                    <option value="subjective">
                      📝 Subjective / Descriptive (Essay Questions)
                    </option>
                  </select>
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.35rem', display: 'block' }}>
                    {examType === 'combined_objective' && '⚡ Combines theoretical principles and practical programming code snippets into auto-graded objective MCQs (4 options).'}
                    {examType === 'programming_objective' && '⚡ Focuses 100% on code output prediction, syntax bug detection, and algorithm logic in objective MCQ format.'}
                    {examType === 'theory_objective' && '⚡ Focuses 100% on theoretical definitions, foundational architecture, and core concepts in objective MCQ format.'}
                    {examType === 'subjective' && '⚡ Generates open-ended, descriptive questions for written responses.'}
                  </small>
                </div>

                <div className="form-group">
                  <label className="form-label">Difficulty Level</label>
                  <select className="form-select" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Number of Questions</label>
                  <input
                    type="number"
                    min="1"
                    max="25"
                    className="form-input"
                    value={questionCount}
                    onChange={(e) => setQuestionCount(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: PASTE MY OWN QUESTIONS OPTION                     */}
          {/* ======================================================== */}
          {creationMode === 'paste' && (
            <div className="fade-in" style={{
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '14px',
              padding: '1.25rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ffffff', fontWeight: '700' }}>
                  <Clipboard size={16} color="var(--primary)" /> Paste Questions (Text, Markdown, or JSON)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={handleLoadSampleText}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border-light)',
                      color: 'var(--primary)',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}>
                    Load Sample Example
                  </button>
                  <button
                    type="button"
                    onClick={handleParsePastedText}
                    style={{
                      background: 'rgba(99, 102, 241, 0.2)',
                      border: '1px solid rgba(99, 102, 241, 0.4)',
                      color: '#ffffff',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}>
                    ⚡ Parse Questions ({parsedQuestions.length})
                  </button>
                </div>
              </div>

              <textarea
                className="form-textarea"
                rows={9}
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '0.85rem',
                  lineHeight: '1.5',
                  background: '#090d16',
                  color: '#e2e8f0',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
                placeholder={`Paste your questions from ChatGPT, Claude, Word, or text file here, for example:

1. What is the output of print(2 ** 3)?
A) 6
B) 8
C) 9
D) 5
Answer: B
Explanation: 2 raised to power 3 is 8.

2. Consider this Python snippet:
\`\`\`python
x = [1, 2, 3]
print(len(x))
\`\`\`
A) 1
B) 2
C) 3
D) 4
Answer: C`}
                value={pastedText}
                onChange={(e) => {
                  const val = e.target.value;
                  setPastedText(val);
                  const qs = parsePastedQuestions(val);
                  setParsedQuestions(qs);
                  if (qs.length > 0) {
                    setQuestionCount(prev => {
                      const cur = parseInt(prev, 10);
                      if (!cur || cur <= 5) {
                        return qs.length >= 10 ? 10 : qs.length;
                      }
                      return Math.min(cur, qs.length);
                    });
                  }
                }}
              />

              {pasteParseError && (
                <div style={{ color: 'var(--rose)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  ⚠️ {pasteParseError}
                </div>
              )}

              {/* Question Pool & Shuffling Settings */}
              {parsedQuestions.length > 0 && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.08))',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  marginTop: '1.25rem',
                  marginBottom: '1.25rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ffffff', fontWeight: '800', fontSize: '0.95rem' }}>
                      <Sparkles size={18} color="var(--primary)" />
                      <span>Total Question Bank: {parsedQuestions.length} Questions Detected</span>
                    </div>
                    <span style={{
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: 'var(--emerald)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      padding: '0.2rem 0.65rem',
                      borderRadius: '20px',
                      fontSize: '0.78rem',
                      fontWeight: '700'
                    }}>
                      ✓ Full Bank Preserved ({parsedQuestions.length} questions)
                    </span>
                  </div>

                  {/* Setting: Number of Questions to Appear in Exam */}
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '10px',
                    padding: '1rem 1.15rem',
                    marginBottom: '0.85rem'
                  }}>
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '700', fontSize: '0.88rem', color: '#f8fafc', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                      <span>🎯 Number of Questions to Appear in Exam</span>
                      <span style={{ color: 'var(--primary)', fontWeight: '800', fontSize: '0.95rem' }}>
                        {questionCount} of {parsedQuestions.length} Questions per Student
                      </span>
                    </label>

                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        type="number"
                        min="1"
                        max={parsedQuestions.length}
                        className="form-input"
                        style={{
                          width: '120px',
                          fontWeight: '800',
                          fontSize: '1.1rem',
                          textAlign: 'center',
                          borderColor: 'var(--primary)',
                          background: 'rgba(0,0,0,0.5)'
                        }}
                        value={questionCount}
                        onChange={(e) => setQuestionCount(e.target.value)}
                        required
                      />

                      {/* Quick preset buttons */}
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Presets:</span>
                        {parsedQuestions.length >= 10 && (
                          <button
                            type="button"
                            onClick={() => handleSetQuestionsToAppear(10)}
                            style={{
                              background: Number(questionCount) === 10 ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                              color: '#ffffff',
                              border: `1px solid ${Number(questionCount) === 10 ? 'var(--primary)' : 'var(--border-light)'}`,
                              padding: '0.3rem 0.65rem',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              fontWeight: Number(questionCount) === 10 ? '700' : '500'
                            }}>
                            10 Questions
                          </button>
                        )}
                        {parsedQuestions.length >= 20 && (
                          <button
                            type="button"
                            onClick={() => handleSetQuestionsToAppear(20)}
                            style={{
                              background: Number(questionCount) === 20 ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                              color: '#ffffff',
                              border: `1px solid ${Number(questionCount) === 20 ? 'var(--primary)' : 'var(--border-light)'}`,
                              padding: '0.3rem 0.65rem',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              fontWeight: Number(questionCount) === 20 ? '700' : '500'
                            }}>
                            20 Questions
                          </button>
                        )}
                        {parsedQuestions.length >= 25 && (
                          <button
                            type="button"
                            onClick={() => handleSetQuestionsToAppear(25)}
                            style={{
                              background: Number(questionCount) === 25 ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                              color: '#ffffff',
                              border: `1px solid ${Number(questionCount) === 25 ? 'var(--primary)' : 'var(--border-light)'}`,
                              padding: '0.3rem 0.65rem',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              fontWeight: Number(questionCount) === 25 ? '700' : '500'
                            }}>
                            25 Questions
                          </button>
                        )}
                        {parsedQuestions.length >= 30 && (
                          <button
                            type="button"
                            onClick={() => handleSetQuestionsToAppear(30)}
                            style={{
                              background: Number(questionCount) === 30 ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                              color: '#ffffff',
                              border: `1px solid ${Number(questionCount) === 30 ? 'var(--primary)' : 'var(--border-light)'}`,
                              padding: '0.3rem 0.65rem',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              fontWeight: Number(questionCount) === 30 ? '700' : '500'
                            }}>
                            30 Questions
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleSetQuestionsToAppear(parsedQuestions.length)}
                          style={{
                            background: Number(questionCount) === parsedQuestions.length ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                            color: '#ffffff',
                            border: `1px solid ${Number(questionCount) === parsedQuestions.length ? 'var(--primary)' : 'var(--border-light)'}`,
                            padding: '0.3rem 0.65rem',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            fontWeight: Number(questionCount) === parsedQuestions.length ? '700' : '500'
                          }}>
                          All {parsedQuestions.length} Questions
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Anti-Cheating Dynamic Randomization Banner */}
                  <div style={{
                    background: 'rgba(99, 102, 241, 0.1)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.65rem'
                  }}>
                    <span style={{ fontSize: '1.2rem', lineHeight: '1' }}>🔀</span>
                    <div style={{ fontSize: '0.8rem', color: '#e2e8f0', lineHeight: '1.45' }}>
                      <strong style={{ color: '#ffffff' }}>Anti-Cheating Randomization Active:</strong>{' '}
                      {Number(questionCount) < parsedQuestions.length ? (
                        <>
                          Each student will receive a <strong>different, randomly chosen subset of {questionCount} questions</strong> from your {parsedQuestions.length}-question bank. Furthermore, both question sequence and option choices (A, B, C, D) are shuffled uniquely per student so adjacent candidates cannot copy.
                        </>
                      ) : (
                        <>
                          Each student will receive <strong>all {parsedQuestions.length} questions in a unique, randomly shuffled sequence</strong> with scrambled MCQ option choices (A, B, C, D) per student seat.
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Parsed Questions Live Preview */}
              {parsedQuestions.length > 0 && (
                <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--emerald)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <CheckCircle size={16} /> {parsedQuestions.length} Questions in Pool
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Delivering {questionCount} questions per candidate
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '280px', overflowY: 'auto', paddingRight: '0.4rem' }}>
                    {parsedQuestions.map((q, qIdx) => (
                      <div key={qIdx} style={{
                        background: 'rgba(0,0,0,0.35)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        fontSize: '0.82rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                          <span style={{ fontWeight: '700', color: 'var(--primary)' }}>Q{qIdx + 1}: {q.prompt}</span>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: '700',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            background: q.category === 'programming' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                            color: q.category === 'programming' ? '#38bdf8' : 'var(--primary)'
                          }}>
                            {q.category === 'programming' ? '💻 Code' : '📘 Theory'}
                          </span>
                        </div>

                        {q.codeSnippet && (
                          <div style={{
                            background: '#090d16',
                            padding: '0.4rem 0.6rem',
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            color: '#38bdf8',
                            marginBottom: '0.4rem'
                          }}>
                            <pre style={{ margin: 0 }}>{q.codeSnippet}</pre>
                          </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', fontSize: '0.75rem' }}>
                          {q.options.map((opt, oIdx) => {
                            const isCorrect = (q.correctOptionIndex === oIdx);
                            return (
                              <div key={oIdx} style={{
                                padding: '0.2rem 0.4rem',
                                borderRadius: '4px',
                                background: isCorrect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.02)',
                                color: isCorrect ? 'var(--emerald)' : 'var(--text-muted)',
                                fontWeight: isCorrect ? '700' : 'normal',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                              }}>
                                <span>{['A', 'B', 'C', 'D'][oIdx]})</span> {opt} {isCorrect && '✓'}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Duration & Passing Score */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Duration (Minutes)</span>
                {durationMinutes && Number(durationMinutes) > 0 && (
                  <span style={{ color: 'var(--emerald)', fontSize: '0.75rem', fontWeight: '700' }}>
                    ● Schedule Window Activated
                  </span>
                )}
              </label>
              <input
                type="number"
                min="1"
                max="300"
                className="form-input"
                placeholder="e.g. 10"
                value={durationMinutes}
                onChange={(e) => handleDurationChange(e.target.value)}
                required
              />
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                e.g., 10 minutes: Schedule Start & End Windows will automatically align.
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">Passing Score (%)</label>
              <input
                type="number"
                min="10"
                max="100"
                className="form-input"
                value={passingPercentage}
                onChange={(e) => setPassingPercentage(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Schedule Window: Dynamically appears when Duration is given */}
          {durationMinutes && Number(durationMinutes) > 0 ? (
            <div className="fade-in" style={{
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              borderRadius: '12px',
              padding: '1.25rem',
              marginTop: '0.75rem',
              marginBottom: '1rem',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    background: 'rgba(99, 102, 241, 0.2)',
                    color: 'var(--primary)',
                    padding: '0.35rem',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Calendar size={18} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: '#ffffff' }}>
                      Schedule Start & End Window
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Automatically synced with your <strong>{durationMinutes} min</strong> exam duration
                    </span>
                  </div>
                </div>

                {/* Quick presets */}
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleSetStartNow}
                    style={{
                      background: 'rgba(99, 102, 241, 0.2)',
                      border: '1px solid rgba(99, 102, 241, 0.4)',
                      color: '#ffffff',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}>
                    ⚡ Start Right Now
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetExactWindow(parseInt(durationMinutes, 10) || 10)}
                    style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      color: 'var(--emerald)',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}>
                    Exact Window (+{durationMinutes}m)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetExactWindow(60)}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-muted)',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}>
                    +1 Hour Window
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetExactWindow(24 * 60)}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border-light)',
                      color: 'var(--text-muted)',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}>
                    +24 Hours Window
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                    Schedule Start Window (Students can begin from)
                  </label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={startTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                    Schedule End Window (Access closes at)
                  </label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Status summary banner */}
              <div style={{
                marginTop: '0.85rem',
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.78rem',
                color: '#e2e8f0'
              }}>
                <Clock size={14} color="var(--primary)" />
                <span>
                  Exam Timer: <strong>{durationMinutes} minutes</strong> once student clicks Start.
                  {startTime && endTime && (
                    <span style={{ marginLeft: '0.35rem', color: 'var(--text-muted)' }}>
                      (Active portal window span: {Math.max(1, Math.round((parseLocalInputToDate(endTime) - parseLocalInputToDate(startTime)) / 60000))} minutes)
                    </span>
                  )}
                </span>
              </div>
            </div>
          ) : (
            <div style={{
              padding: '1rem',
              borderRadius: '10px',
              border: '1px dashed var(--border-light)',
              background: 'rgba(255,255,255,0.02)',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
              marginTop: '0.75rem',
              marginBottom: '1rem'
            }}>
              ⏱️ Enter exam duration in minutes above to activate and view Schedule Start & End Windows.
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1.5rem', padding: '0.9rem' }}
            disabled={loading}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <RefreshCw size={18} className="spin" />
                {creationMode === 'paste' ? 'Saving Your Questions...' : 'Generating Questions with AI...'}
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                {creationMode === 'paste' ? (
                  <>
                    <CheckCircle size={18} /> Create Exam with My Questions & Proceed
                  </>
                ) : (
                  <>
                    <Sparkles size={18} /> Generate Questions & Proceed to Review
                  </>
                )}
              </span>
            )}
          </button>
        </form>
      </div>

      {/* AI Key Configuration Modal */}
      {showAiModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="glass-card fade-in" style={{
            maxWidth: '520px',
            width: '100%',
            padding: '2rem',
            borderRadius: '16px',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.7)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', fontWeight: '700', fontSize: '0.85rem' }}>
                  <Sparkles size={16} /> Google AI Studio Integration
                </div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: '800', marginTop: '0.2rem' }}>
                  Connect Free Gemini AI Key
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-muted)'
                }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.5', marginBottom: '1.25rem' }}>
              Google provides a <strong>100% Free Tier</strong> with 15 requests/min and 1,500 questions/day.
              Get your free key in 30 seconds from Google AI Studio and paste it below:
            </p>

            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{
                width: '100%',
                marginBottom: '1.25rem',
                justifyContent: 'center',
                color: 'var(--primary)',
                borderColor: 'rgba(99, 102, 241, 0.4)',
                background: 'rgba(99, 102, 241, 0.1)'
              }}>
              <ExternalLink size={15} /> Get Free Key at aistudio.google.com &rarr;
            </a>

            {aiKeyMsg && (
              <div style={{
                padding: '0.75rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                background: aiKeyMsg.includes('✅') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                border: `1px solid ${aiKeyMsg.includes('✅') ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                color: aiKeyMsg.includes('✅') ? '#10b981' : '#f43f5e'
              }}>
                {aiKeyMsg}
              </div>
            )}

            <form onSubmit={handleSaveAiKey}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontSize: '0.85rem' }}>Gemini API Key</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="AIzaSy..."
                  value={inputApiKey}
                  onChange={(e) => setInputApiKey(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingAiKey}>
                  {savingAiKey ? 'Validating...' : 'Save & Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
