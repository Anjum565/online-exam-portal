import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import {
  CheckCircle, Save, Plus, Trash2, Send, HelpCircle,
  Edit3, ArrowLeft, Award, Calendar, Clock, Key, ChevronDown, ChevronUp, AlertCircle, Code
} from 'lucide-react';
import CodeEditor from '../components/CodeEditor';

export default function ReviewQuestionsPage() {
  const { examId } = useParams();
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Schedule Window & Parameter State
  const [showScheduleSettings, setShowScheduleSettings] = useState(true);
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [passingPercentage, setPassingPercentage] = useState(40);
  const [examCode, setExamCode] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [randomizeQuestions, setRandomizeQuestions] = useState(true);

  const { API_BASE_URL } = useContext(AuthContext);
  const navigate = useNavigate();

  const toDatetimeLocal = (dateInput) => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const parseLocalInputToDate = (str) => {
    if (!str) return new Date();
    const [datePart, timePart] = str.split('T');
    if (!datePart || !timePart) return new Date(str);
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes, 0);
  };

  const localInputToISO = (str) => {
    if (!str) return undefined;
    const d = parseLocalInputToDate(str);
    return d.toISOString();
  };

  useEffect(() => {
    const fetchExam = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/exams/${examId}`);
        const ex = res.data;
        setExam(ex);
        setQuestions(ex.questions || []);
        setTitle(ex.title || '');
        setStartTime(toDatetimeLocal(ex.startTime));
        setEndTime(toDatetimeLocal(ex.endTime));
        setDurationMinutes(ex.durationMinutes || 30);
        setPassingPercentage(ex.passingPercentage || 40);
        setExamCode(ex.examCode || '');
        setQuestionCount(ex.questionCount || (ex.questions ? Math.min(10, ex.questions.length) : 5));
        setRandomizeQuestions(ex.randomizeQuestions !== undefined ? ex.randomizeQuestions : true);
      } catch (err) {
        setError('Failed to fetch exam details.');
      } finally {
        setLoading(false);
      }
    };
    fetchExam();
  }, [examId]);

  // Shuffle all questions order in the pool
  const handleShuffleAllQuestions = () => {
    const pool = [...questions];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const updated = pool.map((q, idx) => ({ ...q, order: idx + 1 }));
    setQuestions(updated);
  };

  // Set the number of questions that should appear in the exam per candidate
  const handleSetDeliverCount = (num) => {
    const target = Math.min(Math.max(1, parseInt(num, 10) || 1), questions.length);
    setQuestionCount(target);
  };

  const handleQuestionChange = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
  };

  const handleOptionChange = (qIndex, oIndex, value) => {
    const updated = [...questions];
    if (!updated[qIndex].options) updated[qIndex].options = [];
    updated[qIndex].options[oIndex] = value;
    if (updated[qIndex].correctOptionIndex === oIndex) {
      updated[qIndex].correctAnswer = value;
    }
    setQuestions(updated);
  };

  const handleSetCorrectOption = (qIndex, oIndex) => {
    const updated = [...questions];
    updated[qIndex].correctOptionIndex = oIndex;
    updated[qIndex].correctAnswer = updated[qIndex].options[oIndex] || '';
    setQuestions(updated);
  };

  const handleAddQuestion = (category = 'theory') => {
    setQuestions([
      ...questions,
      {
        type: 'mcq',
        category,
        prompt: category === 'programming'
          ? 'Consider the following code snippet. What will be the output or behavior?'
          : 'New Multiple Choice Question statement...',
        codeSnippet: category === 'programming' ? '// Code snippet\nlet a = 10;\nlet b = 20;\nconsole.log(a + b);' : '',
        options: ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
        correctOptionIndex: 0,
        correctAnswer: 'Choice A',
        explanation: 'Explanation for correct choice.',
        maxMarks: 2,
        order: questions.length + 1
      }
    ]);
  };

  const handleRemoveQuestion = (index) => {
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated);
  };

  const handleExtendHours = (hours) => {
    const currentEnd = endTime ? parseLocalInputToDate(endTime) : new Date();
    const baseTime = currentEnd.getTime() < Date.now() ? Date.now() : currentEnd.getTime();
    const newEnd = new Date(baseTime + hours * 3600 * 1000);
    setEndTime(toDatetimeLocal(newEnd));
  };

  const handleSetStartNow = () => {
    const now = new Date();
    setStartTime(toDatetimeLocal(now));
    const mins = parseInt(durationMinutes, 10) || 10;
    setEndTime(toDatetimeLocal(new Date(now.getTime() + mins * 60 * 1000)));
  };

  const handleSyncExactDuration = () => {
    const baseStart = startTime ? parseLocalInputToDate(startTime) : new Date();
    const mins = parseInt(durationMinutes, 10) || 10;
    setEndTime(toDatetimeLocal(new Date(baseStart.getTime() + mins * 60 * 1000)));
  };

  const handleSaveAndPublish = async (newStatus = 'published') => {
    const startObj = startTime ? parseLocalInputToDate(startTime) : null;
    const endObj = endTime ? parseLocalInputToDate(endTime) : null;
    if (startObj && endObj && endObj <= startObj) {
      alert('Error: Schedule End time must be later than the Schedule Start time.');
      return;
    }

    setSaving(true);
    try {
      const activeCount = Math.min(parseInt(questionCount, 10) || questions.length, questions.length);
      await axios.put(`${API_BASE_URL}/exams/${examId}`, {
        title: title.trim(),
        questions,
        questionCount: activeCount,
        randomizeQuestions,
        status: newStatus,
        startTime: localInputToISO(startTime),
        endTime: localInputToISO(endTime),
        durationMinutes: parseInt(durationMinutes) || 30,
        passingPercentage: parseInt(passingPercentage) || 40,
        examCode: examCode.trim().toUpperCase()
      });
      alert(`Exam ${newStatus === 'published' ? 'Published' : 'Saved as Draft'} successfully!`);
      navigate('/teacher/dashboard');
    } catch (err) {
      console.error('Failed to save:', err);
      alert('Failed to save exam changes.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="container" style={{ padding: '4rem', textAlign: 'center' }}>Loading question review...</div>;
  if (error || !exam) return <div className="container" style={{ padding: '4rem', textAlign: 'center', color: 'var(--rose)' }}>{error}</div>;

  const activeDeliverCount = Math.min(parseInt(questionCount, 10) || questions.length, questions.length);
  const avgQMark = questions.length > 0 ? (Number(questions[0]?.maxMarks) || 2) : 2;
  const totalCalculatedMarks = activeDeliverCount * avgQMark;

  return (
    <div className="container" style={{ padding: '2rem 1.5rem', maxWidth: '950px' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Link to="/teacher/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', fontSize: '0.85rem', marginBottom: '0.5rem', textDecoration: 'none' }}>
            <ArrowLeft size={16} /> Back to Teacher Dashboard
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className={`badge badge-${exam.status}`}>{exam.status}</span>
            {examCode && (
              <span className="badge badge-published" style={{ background: 'rgba(99, 102, 241, 0.2)', color: 'var(--primary)' }}>
                Code: {examCode}
              </span>
            )}
          </div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: '800' }}>{title || exam.title}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Configure exam schedule window, designate correct answers, set marks, and publish to students.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button onClick={() => handleSaveAndPublish('draft')} className="btn btn-secondary" disabled={saving}>
            <Save size={16} /> Save Draft
          </button>
          <button onClick={() => handleSaveAndPublish('published')} className="btn btn-primary" disabled={saving}>
            <Send size={16} /> Publish Exam Now
          </button>
        </div>
      </div>

      {/* Summary Chips */}
      <div style={{ display: 'flex', gap: '0.85rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.6rem 1rem', borderRadius: '10px', fontSize: '0.85rem' }}>
          Total in Pool: <strong style={{ color: '#ffffff' }}>{questions.length}</strong>
        </div>
        <div style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '0.6rem 1rem', borderRadius: '10px', fontSize: '0.85rem' }}>
          Delivering to Student: <strong style={{ color: 'var(--primary)' }}>{activeDeliverCount} {randomizeQuestions ? '(Randomized 🎲)' : ''}</strong>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.6rem 1rem', borderRadius: '10px', fontSize: '0.85rem' }}>
          Exam Total Score: <strong style={{ color: 'var(--emerald)' }}>{totalCalculatedMarks} Marks</strong>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.6rem 1rem', borderRadius: '10px', fontSize: '0.85rem' }}>
          Duration: <strong style={{ color: 'var(--primary)' }}>{durationMinutes} Mins</strong>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.6rem 1rem', borderRadius: '10px', fontSize: '0.85rem' }}>
          Passing: <strong style={{ color: 'var(--amber)' }}>{passingPercentage}%</strong>
        </div>
      </div>

      {/* Schedule Window & Parameters Settings Section */}
      <div className="glass-card fade-in" style={{
        padding: '1.5rem',
        marginBottom: '2rem',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        background: 'rgba(15, 23, 42, 0.75)'
      }}>
        <div
          onClick={() => setShowScheduleSettings(!showScheduleSettings)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none'
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              background: 'rgba(99, 102, 241, 0.2)',
              color: 'var(--primary)',
              padding: '0.4rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Calendar size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0 }}>
                Exam Schedule Window & Parameters
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
                Adjust the active test access window, duration, and access code.
              </p>
            </div>
          </div>
          <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            {showScheduleSettings ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>

        {showScheduleSettings && (
          <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-light)' }}>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label" style={{ fontSize: '0.85rem' }}>Exam Title</label>
              <input
                type="text"
                className="form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.85rem' }}>Schedule Start Window</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.85rem' }}>Schedule End Window</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Quick adjust buttons */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              <button
                type="button"
                onClick={handleSetStartNow}
                style={{
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  color: 'var(--primary)',
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}>
                ⚡ Start Right Now
              </button>
              <button
                type="button"
                onClick={handleSyncExactDuration}
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: 'var(--emerald)',
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}>
                Exact Window (+{durationMinutes}m)
              </button>
              <button
                type="button"
                onClick={() => handleExtendHours(1)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-light)',
                  color: '#ffffff',
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}>
                +1 Hour End
              </button>
              <button
                type="button"
                onClick={() => handleExtendHours(24)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-light)',
                  color: '#ffffff',
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}>
                +24 Hours End
              </button>
              <button
                type="button"
                onClick={() => handleExtendHours(168)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-light)',
                  color: '#ffffff',
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}>
                +7 Days End
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.85rem' }}>Duration (Minutes)</label>
                <input
                  type="number"
                  min="5"
                  max="300"
                  className="form-input"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.85rem' }}>Passing Score (%)</label>
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

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.85rem' }}>Exam Code</label>
                <input
                  type="text"
                  className="form-input"
                  style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
                  value={examCode}
                  onChange={(e) => setExamCode(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🎯 Number of Questions to Appear in Exam</span>
                  <span style={{ color: 'var(--primary)', fontWeight: '700' }}>{questionCount} of {questions.length}</span>
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="number"
                    min="1"
                    max={questions.length}
                    className="form-input"
                    style={{ width: '100px', fontWeight: '800', textAlign: 'center' }}
                    value={questionCount}
                    onChange={(e) => setQuestionCount(e.target.value)}
                    required
                  />
                  {questions.length >= 10 && (
                    <button
                      type="button"
                      onClick={() => handleSetDeliverCount(10)}
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', borderColor: Number(questionCount) === 10 ? 'var(--primary)' : undefined }}>
                      10 Qs
                    </button>
                  )}
                  {questions.length >= 20 && (
                    <button
                      type="button"
                      onClick={() => handleSetDeliverCount(20)}
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', borderColor: Number(questionCount) === 20 ? 'var(--primary)' : undefined }}>
                      20 Qs
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSetDeliverCount(questions.length)}
                    className="btn btn-secondary"
                    style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', borderColor: Number(questionCount) === questions.length ? 'var(--primary)' : undefined }}>
                    All {questions.length}
                  </button>
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'rgba(0,0,0,0.2)',
                padding: '0.6rem 0.8rem',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                alignSelf: 'end'
              }}>
                <input
                  type="checkbox"
                  id="revRandomize"
                  checked={randomizeQuestions}
                  onChange={(e) => setRandomizeQuestions(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                />
                <label htmlFor="revRandomize" style={{ fontSize: '0.82rem', color: '#e2e8f0', cursor: 'pointer', fontWeight: '700' }}>
                  🎲 Dynamic Per-Student Randomization
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Questions Section Heading & Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: '800', margin: 0 }}>
            Question Bank Pool ({questions.length} Questions)
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0.25rem 0 0 0' }}>
            Delivering <strong>{activeDeliverCount} questions</strong> {randomizeQuestions ? `randomly sampled from this ${questions.length}-question bank and shuffled per student` : 'in fixed sequence'}.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleShuffleAllQuestions}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
            title="Randomize the display order of all questions in this bank">
            🔀 Shuffle Pool Order
          </button>

          <button
            onClick={() => handleAddQuestion('theory')}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
            <Plus size={15} /> Add Question
          </button>
        </div>
      </div>

      {/* Questions List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {questions.map((q, qIndex) => {
          const isMcq = q.type === 'mcq' || (q.options && q.options.length > 0);
          return (
            <div key={qIndex} className="glass-card fade-in" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <span style={{
                    background: 'rgba(99, 102, 241, 0.2)',
                    color: 'var(--primary)',
                    fontWeight: '700',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '6px',
                    fontSize: '0.85rem'
                  }}>
                    Question {qIndex + 1}
                  </span>

                  <select
                    className="form-select"
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem', width: 'auto', background: 'rgba(15, 23, 42, 0.7)' }}
                    value={q.category || 'theory'}
                    onChange={(e) => handleQuestionChange(qIndex, 'category', e.target.value)}>
                    <option value="theory">📘 Theory Concept MCQ</option>
                    <option value="programming">💻 Programming & Code MCQ</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Marks:</span>
                    <input
                      type="number"
                      min="1"
                      className="form-input"
                      style={{ width: '65px', padding: '0.25rem 0.5rem', textAlign: 'center' }}
                      value={q.maxMarks || 2}
                      onChange={(e) => handleQuestionChange(qIndex, 'maxMarks', e.target.value)}
                    />
                  </div>

                  <button
                    onClick={() => handleRemoveQuestion(qIndex)}
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.6rem', color: 'var(--rose)' }}
                    title="Delete Question">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Question statement */}
              <div className="form-group">
                <label className="form-label">Question Statement</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={q.prompt}
                  onChange={(e) => handleQuestionChange(qIndex, 'prompt', e.target.value)}
                />
              </div>

              {/* Code Snippet Box (if programming question or has snippet) */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#38bdf8' }}>
                    <Code size={15} /> Code Snippet / Program Specification
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const willHaveCode = !q.codeSnippet && q.category !== 'programming';
                      const updated = [...questions];
                      if (willHaveCode) {
                        updated[qIndex].codeSnippet = '// Type or paste code snippet here';
                        updated[qIndex].category = 'programming';
                      } else {
                        updated[qIndex].codeSnippet = '';
                        updated[qIndex].category = 'theory';
                      }
                      setQuestions(updated);
                    }}
                    style={{
                      background: (q.category === 'programming' || q.codeSnippet) ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${(q.category === 'programming' || q.codeSnippet) ? 'rgba(56, 189, 248, 0.3)' : 'var(--border-light)'}`,
                      color: (q.category === 'programming' || q.codeSnippet) ? '#38bdf8' : 'var(--text-muted)',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      cursor: 'pointer'
                    }}
                  >
                    {(q.category === 'programming' || q.codeSnippet) ? '✓ Code Snippet Attached' : '+ Add Code Snippet'}
                  </button>
                </div>

                {(q.category === 'programming' || q.codeSnippet) && (
                  <CodeEditor
                    value={q.codeSnippet || ''}
                    onChange={(val) => handleQuestionChange(qIndex, 'codeSnippet', val)}
                    language={q.language || 'python'}
                    onLanguageChange={(lang) => handleQuestionChange(qIndex, 'language', lang)}
                    title={`Code Snippet (${(q.language || 'python').toUpperCase()})`}
                    minHeight="180px"
                    placeholder="// Type or paste your code snippet here. Tab key indents 4 spaces."
                  />
                )}
              </div>

              {/* Options Editor (for MCQs) */}
              {isMcq && q.options && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Options (Click radio to set correct answer)</span>
                    <span style={{ color: 'var(--emerald)', fontSize: '0.8rem' }}>● Green = Correct Option</span>
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {q.options.map((opt, oIndex) => {
                      const isCorrect = (q.correctOptionIndex === oIndex);
                      return (
                        <div key={oIndex} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <input
                            type="radio"
                            name={`correct-${qIndex}`}
                            checked={isCorrect}
                            onChange={() => handleSetCorrectOption(qIndex, oIndex)}
                            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--emerald)' }}
                          />
                          <input
                            type="text"
                            className="form-input"
                            style={{
                              borderColor: isCorrect ? 'var(--emerald)' : 'var(--border-light)',
                              background: isCorrect ? 'rgba(16, 185, 129, 0.08)' : 'rgba(10, 15, 26, 0.8)'
                            }}
                            value={opt}
                            onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Explanation / Marking Criteria */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Solution Explanation / Marking Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Why this answer is correct or key points expected..."
                  value={q.explanation || q.suggestedAnswer || ''}
                  onChange={(e) => handleQuestionChange(qIndex, 'explanation', e.target.value)}
                />
              </div>
            </div>
          );
        })}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleAddQuestion('theory')}
            className="btn btn-secondary"
            style={{ flex: 1, borderStyle: 'dashed', padding: '0.9rem', justifyContent: 'center' }}>
            <Plus size={16} /> Add Theory MCQ
          </button>
          <button
            onClick={() => handleAddQuestion('programming')}
            className="btn btn-secondary"
            style={{ flex: 1, borderStyle: 'dashed', padding: '0.9rem', justifyContent: 'center', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}>
            <Plus size={16} /> Add Programming Code MCQ
          </button>
        </div>
      </div>

      <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
        <button onClick={() => handleSaveAndPublish('draft')} className="btn btn-secondary" disabled={saving}>
          <Save size={16} /> Save Changes
        </button>
        <button onClick={() => handleSaveAndPublish('published')} className="btn btn-primary" disabled={saving}>
          <Send size={16} /> Publish Exam Now
        </button>
      </div>
    </div>
  );
}
