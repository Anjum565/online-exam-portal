import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import { Award, Clock, FileText, CheckCircle, ArrowRight, AlertCircle, Sparkles, Key, Check, ShieldAlert, Lock, Calendar } from 'lucide-react';

const formatDisplayDate = (dateInput) => {
  if (!dateInput) return 'Not scheduled';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'Not scheduled';
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

export default function StudentDashboard() {
  const [exams, setExams] = useState([]);
  const [submissions, setSubmissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [examCodeInput, setExamCodeInput] = useState('');
  const [codeSearching, setCodeSearching] = useState(false);
  const [codeError, setCodeError] = useState('');

  const { API_BASE_URL, user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStudentData();
  }, []);

  const fetchStudentData = async () => {
    try {
      const examsRes = await axios.get(`${API_BASE_URL}/exams`);
      const availableExams = examsRes.data;
      setExams(availableExams);

      // Fetch submission status for each exam
      const subMap = {};
      for (const exam of availableExams) {
        const examId = exam._id || exam.id;
        try {
          const subRes = await axios.get(`${API_BASE_URL}/submissions/${examId}/my`);
          if (subRes.data) {
            subMap[examId] = subRes.data;
          }
        } catch (e) {
          // No submission yet
        }
      }
      setSubmissions(subMap);
    } catch (err) {
      console.error('Error fetching student dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByCode = async (e) => {
    e.preventDefault();
    const code = examCodeInput.trim().toUpperCase();
    if (!code) return;

    setCodeSearching(true);
    setCodeError('');

    try {
      const res = await axios.get(`${API_BASE_URL}/exams/code/${code}`);
      const foundExam = res.data;
      const targetId = foundExam._id || foundExam.id;
      navigate(`/student/exam/${targetId}`);
    } catch (err) {
      setCodeError(err.response?.data?.error || `No active exam found matching code "${code}".`);
    } finally {
      setCodeSearching(false);
    }
  };

  return (
    <div className="container" style={{ padding: '2rem 1.5rem', maxWidth: '1100px' }}>
      {/* Welcome Header */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
            <Sparkles size={16} /> Online Examination Portal
          </div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: '800' }}>
            Welcome, {user?.name || 'Examinee'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Access scheduled exams, join tests using exam codes, and view instant graded scorecards.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Enrolled Scope:</span>
            <span className="badge badge-published" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', fontSize: '0.78rem' }}>
              🏛️ {user?.department || 'General Department'}
            </span>
            <span className="badge badge-published" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--emerald)', fontSize: '0.78rem' }}>
              🎓 {user?.course || 'General Course'} {user?.semester ? `• ${user.semester}` : ''}
            </span>
            {user?.rollNumber && (
              <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.08)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Roll No: {user.rollNumber}
              </span>
            )}
          </div>
        </div>

        {/* Quick Join By Code Box */}
        <form onSubmit={handleJoinByCode} className="glass-card" style={{ padding: '1rem 1.25rem', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Key size={14} color="var(--primary)" /> Join Exam by Code
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              className="form-input"
              style={{ padding: '0.55rem 0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '700' }}
              placeholder="e.g. WEB101"
              value={examCodeInput}
              onChange={(e) => setExamCodeInput(e.target.value.toUpperCase())}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0.55rem 1.2rem', flexShrink: 0 }} disabled={codeSearching}>
              {codeSearching ? 'Checking...' : 'Join'}
            </button>
          </div>
          {codeError && (
            <span style={{ fontSize: '0.75rem', color: 'var(--rose)' }}>{codeError}</span>
          )}
        </form>
      </div>

      {/* Account Verification Warning Banner */}
      {user && user.isVerified === false && (
        <div className="fade-in" style={{
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          padding: '1.25rem 1.5rem',
          borderRadius: '14px',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.2)', padding: '0.6rem', borderRadius: '10px' }}>
            <ShieldAlert size={26} color="#fbbf24" />
          </div>
          <div>
            <div style={{ fontWeight: '800', color: '#fbbf24', fontSize: '1rem' }}>
              Account Pending Verification by Administrator
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
              Your student profile has been submitted. The examination administrator must approve your account before you can start online exams. Please inform your teacher or examiner.
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          Loading active examination sessions...
        </div>
      ) : exams.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <Award size={48} color="var(--primary)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
          <h3>No Scheduled Exams Available</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Check back later once your teacher schedules a new exam.
          </p>
        </div>
      ) : (
        <div className="grid-2">
          {exams.map((exam) => {
            const examId = exam._id || exam.id;
            const sub = submissions[examId];
            const now = new Date();
            const start = new Date(exam.startTime);
            const end = new Date(exam.endTime);
            const isWindowActive = now >= start && now <= end;
            const isFuture = now < start;
            const isExpired = now > end;

            return (
              <div key={examId} className="glass-card fade-in" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                      <span className="badge badge-published">{exam.subject}</span>
                      {exam.course && (
                        <span className="badge badge-published" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', fontSize: '0.72rem' }}>
                          🎓 {exam.course} {exam.semester ? `• ${exam.semester}` : ''}
                        </span>
                      )}
                    </div>
                    <h3 style={{ fontSize: '1.3rem', marginTop: '0.4rem', fontWeight: '700' }}>{exam.title}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Topic: {exam.topic}</p>
                  </div>
                  {exam.examCode && (
                    <span style={{
                      background: 'rgba(99, 102, 241, 0.15)',
                      color: 'var(--primary)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: '800',
                      letterSpacing: '0.05em'
                    }}>
                      {exam.examCode}
                    </span>
                  )}
                </div>

                {/* Exam Schedule Window Display */}
                <div style={{
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  borderRadius: '8px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.78rem',
                  marginBottom: '0.75rem',
                  color: 'var(--text-muted)'
                }}>
                  <div style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Calendar size={13} /> Schedule Window:
                  </div>
                  <div style={{ color: '#ffffff', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.2rem' }}>
                    <span>{formatDisplayDate(exam.startTime)}</span>
                    <span>&rarr;</span>
                    <span>{formatDisplayDate(exam.endTime)}</span>
                  </div>
                </div>

                <div style={{
                  background: 'rgba(0,0,0,0.25)',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  marginBottom: '1.25rem',
                  color: 'var(--text-muted)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span><Clock size={13} style={{ display: 'inline', marginRight: '4px' }} /> Duration:</span>
                    <strong style={{ color: '#ffffff' }}>{exam.durationMinutes} minutes</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span>Questions to Answer:</span>
                    <strong style={{ color: '#ffffff' }}>{exam.questionCount || exam.questions?.length || 5} questions</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Passing Score:</span>
                    <strong style={{ color: 'var(--emerald)' }}>{exam.passingPercentage || 40}%</strong>
                  </div>
                </div>

                {/* Submission Status Box */}
                {sub ? (
                  <div style={{
                    padding: '0.85rem 1rem',
                    borderRadius: '10px',
                    marginBottom: '1.25rem',
                    background: (sub.isTerminated || sub.status === 'terminated')
                      ? 'rgba(244, 63, 94, 0.15)'
                      : (sub.passed ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)'),
                    border: `1px solid ${(sub.isTerminated || sub.status === 'terminated')
                      ? 'rgba(244, 63, 94, 0.4)'
                      : (sub.passed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)')}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {(sub.isTerminated || sub.status === 'terminated') ? (
                          <ShieldAlert size={16} color="var(--rose)" />
                        ) : (
                          <CheckCircle size={16} color={sub.passed ? 'var(--emerald)' : 'var(--rose)'} />
                        )}
                        <span style={{ fontSize: '0.85rem', fontWeight: '700', color: (sub.isTerminated || sub.status === 'terminated') ? 'var(--rose)' : (sub.passed ? 'var(--emerald)' : 'var(--rose)') }}>
                          {(sub.isTerminated || sub.status === 'terminated') ? 'Terminated & Barred' : (sub.passed ? 'Passed' : 'Completed')}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.95rem', fontWeight: '850', color: (sub.isTerminated || sub.status === 'terminated') ? 'var(--rose)' : '#ffffff' }}>
                        {(sub.isTerminated || sub.status === 'terminated') ? 'Disqualified' : `${sub.marksObtained}/${sub.totalMarks} (${sub.percentage}%)`}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    marginBottom: '1.25rem',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-light)',
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)'
                  }}>
                    Status: <strong style={{ color: isWindowActive ? 'var(--emerald)' : (isFuture ? 'var(--amber)' : 'var(--text-subtle)') }}>
                      {isWindowActive ? '● Test Room Open' : (isFuture ? 'Upcoming' : 'Expired')}
                    </strong>
                  </div>
                )}

                {/* Action CTA Button */}
                <div style={{ marginTop: 'auto' }}>
                  {sub ? (
                    (sub.isTerminated || sub.status === 'terminated') ? (
                      <button className="btn btn-secondary" style={{ width: '100%', color: 'var(--rose)', opacity: 0.85, cursor: 'not-allowed', background: 'rgba(244, 63, 94, 0.1)' }} disabled>
                        <ShieldAlert size={15} /> Barred (Closed Browser / Back)
                      </button>
                    ) : (
                      <Link to={`/student/exam/${examId}`} className="btn btn-secondary" style={{ width: '100%' }}>
                        View Scorecard & Review <ArrowRight size={16} />
                      </Link>
                    )
                  ) : isWindowActive ? (
                    user && user.isVerified === false ? (
                      <button className="btn btn-secondary" style={{ width: '100%', opacity: 0.75, cursor: 'not-allowed', color: 'var(--amber)' }} disabled>
                        <Lock size={15} /> Locked (Pending Approval)
                      </button>
                    ) : (
                      <Link to={`/student/exam/${examId}`} className="btn btn-primary" style={{ width: '100%' }}>
                        Enter Exam Room <ArrowRight size={16} />
                      </Link>
                    )
                  ) : isFuture ? (
                    <button className="btn btn-secondary" style={{ width: '100%' }} disabled>
                      Available at {start.toLocaleDateString()}
                    </button>
                  ) : (
                    <button className="btn btn-secondary" style={{ width: '100%' }} disabled>
                      Exam Session Closed
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
