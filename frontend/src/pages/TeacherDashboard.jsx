import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import {
  PlusCircle, BookOpen, Clock, Users, Edit3, CheckCircle,
  FileText, Send, Sparkles, Trash2, Key, Copy, Check,
  Calendar, Settings, X, AlertCircle, RefreshCw, Award, Building, Shield
} from 'lucide-react';

export default function TeacherDashboard() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);
  const [pendingStudentsCount, setPendingStudentsCount] = useState(0);

  // Edit Schedule Modal State
  const [scheduleModalExam, setScheduleModalExam] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    title: '',
    startTime: '',
    endTime: '',
    durationMinutes: 30,
    passingPercentage: 40,
    examCode: '',
    status: 'published'
  });
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleSuccess, setScheduleSuccess] = useState('');

  const { user, API_BASE_URL } = useContext(AuthContext);

  const fetchExams = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/exams`);
      setExams(res.data);

      try {
        const studRes = await axios.get(`${API_BASE_URL}/admin/students`);
        setPendingStudentsCount(studRes.data.stats?.pending || 0);
      } catch (e) {}
    } catch (err) {
      setError('Failed to load exams.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleDeleteExam = async (examId) => {
    if (!window.confirm('Are you sure you want to delete this exam and all student submissions?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/exams/${examId}`);
      fetchExams();
    } catch (err) {
      alert('Failed to delete exam.');
    }
  };

  // Date format helper for datetime-local input
  const toDatetimeLocal = (dateInput) => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().slice(0, 16);
  };

  // Formatted date string for humans
  const formatDisplayDate = (dateInput) => {
    if (!dateInput) return 'Not scheduled';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return 'Invalid date';
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate schedule window status
  const getWindowStatus = (startInput, endInput) => {
    if (!startInput || !endInput) {
      return { label: 'Unscheduled', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)', border: 'var(--border-light)' };
    }
    const now = new Date();
    const start = new Date(startInput);
    const end = new Date(endInput);
    if (now < start) {
      return { label: 'Upcoming Window', color: 'var(--amber)', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.35)' };
    } else if (now > end) {
      return { label: 'Window Closed', color: 'var(--rose)', bg: 'rgba(244, 63, 94, 0.15)', border: 'rgba(244, 63, 94, 0.35)' };
    } else {
      return { label: 'Window Active (Live Now)', color: 'var(--emerald)', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.35)' };
    }
  };

  // Open Schedule Editing Modal
  const openScheduleModal = (exam) => {
    setScheduleModalExam(exam);
    setScheduleError('');
    setScheduleSuccess('');
    setScheduleForm({
      title: exam.title || '',
      startTime: toDatetimeLocal(exam.startTime),
      endTime: toDatetimeLocal(exam.endTime),
      durationMinutes: exam.durationMinutes || 30,
      passingPercentage: exam.passingPercentage || 40,
      examCode: exam.examCode || '',
      status: exam.status || 'published'
    });
  };

  // Close modal
  const closeScheduleModal = () => {
    setScheduleModalExam(null);
    setScheduleError('');
    setScheduleSuccess('');
  };

  // Quick preset helper functions
  const handleSetStartNow = () => {
    const now = new Date();
    const startIso = toDatetimeLocal(now);
    // Keep 2 hours default after now if end is in past
    let endIso = scheduleForm.endTime;
    if (!endIso || new Date(endIso) <= now) {
      endIso = toDatetimeLocal(new Date(now.getTime() + 2 * 3600 * 1000));
    }
    setScheduleForm(prev => ({ ...prev, startTime: startIso, endTime: endIso }));
  };

  const handleExtendHours = (hours) => {
    const currentEnd = scheduleForm.endTime ? new Date(scheduleForm.endTime) : new Date();
    const baseTime = currentEnd.getTime() < Date.now() ? Date.now() : currentEnd.getTime();
    const newEnd = new Date(baseTime + hours * 3600 * 1000);
    setScheduleForm(prev => ({ ...prev, endTime: toDatetimeLocal(newEnd) }));
  };

  // Save updated schedule window
  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    setScheduleSaving(true);
    setScheduleError('');
    setScheduleSuccess('');

    const examId = scheduleModalExam._id || scheduleModalExam.id;

    if (!scheduleForm.startTime || !scheduleForm.endTime) {
      setScheduleError('Please specify both Schedule Start and Schedule End times.');
      setScheduleSaving(false);
      return;
    }

    if (new Date(scheduleForm.endTime) <= new Date(scheduleForm.startTime)) {
      setScheduleError('Schedule End time must be later than the Schedule Start time.');
      setScheduleSaving(false);
      return;
    }

    try {
      const payload = {
        title: scheduleForm.title.trim(),
        startTime: new Date(scheduleForm.startTime).toISOString(),
        endTime: new Date(scheduleForm.endTime).toISOString(),
        durationMinutes: parseInt(scheduleForm.durationMinutes) || 30,
        passingPercentage: parseInt(scheduleForm.passingPercentage) || 40,
        examCode: scheduleForm.examCode.trim().toUpperCase(),
        status: scheduleForm.status
      };

      const res = await axios.put(`${API_BASE_URL}/exams/${examId}`, payload);
      setScheduleSuccess('Exam schedule window updated successfully!');

      // Update local exam state immediately
      setExams(prev => prev.map(ex => {
        const id = ex._id || ex.id;
        if (id === examId) {
          return { ...ex, ...res.data };
        }
        return ex;
      }));

      setTimeout(() => {
        closeScheduleModal();
      }, 900);
    } catch (err) {
      console.error('Failed to update schedule:', err);
      setScheduleError(err.response?.data?.error || 'Failed to save schedule window changes.');
    } finally {
      setScheduleSaving(false);
    }
  };

  return (
    <div className="container" style={{ padding: '2rem 1.5rem', maxWidth: '1150px' }}>
      {/* Header Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '2rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
            <Sparkles size={16} /> Department Faculty Hub
          </div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: '800' }}>Faculty Teacher Portal</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Create AI-generated online examinations, adjust schedule windows, and evaluate candidate submissions.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link to="/teacher/students" className="btn btn-secondary">
            <Users size={18} /> Manage & Verify Students
            {pendingStudentsCount > 0 && (
              <span style={{
                background: 'var(--amber)',
                color: '#000',
                padding: '0.15rem 0.5rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: '800',
                marginLeft: '0.3rem'
              }}>
                {pendingStudentsCount} PENDING
              </span>
            )}
          </Link>
          {user?.role === 'admin' ? (
            <Link to="/admin/dashboard" className="btn btn-primary">
              <Shield size={18} /> Institutional Admin Portal
            </Link>
          ) : user && user.isVerified === false ? (
            <button className="btn btn-secondary" disabled title="Account pending administrative approval" style={{ opacity: 0.65, cursor: 'not-allowed' }}>
              <PlusCircle size={18} /> Create Exam (Pending Approval)
            </button>
          ) : (
            <Link to="/teacher/create-exam" className="btn btn-primary">
              <PlusCircle size={18} /> Create New Exam
            </Link>
          )}
        </div>
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
          <div style={{ background: 'rgba(245, 158, 11, 0.2)', padding: '0.6rem', borderRadius: '10px', flexShrink: 0 }}>
            <AlertCircle size={26} color="#fbbf24" />
          </div>
          <div>
            <div style={{ fontWeight: '800', color: '#fbbf24', fontSize: '1rem' }}>
              Faculty Account Pending Administrative Approval
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
              Your teacher account for <strong>{user.department || 'your department'}</strong> has been registered. The institution administrator must approve your account on the Admin Portal before you can create examinations.
            </div>
          </div>
        </div>
      )}

      {/* Department Scope Banner */}
      <div style={{
        background: 'rgba(99, 102, 241, 0.08)',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        borderRadius: '12px',
        padding: '1rem 1.25rem',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            background: 'rgba(99, 102, 241, 0.2)',
            padding: '0.65rem',
            borderRadius: '10px',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Building size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Your Department Scope
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#ffffff' }}>
              {user?.department || 'General Department'}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              {user?.course && <span>{user.course} {user.semester ? `• ${user.semester}` : ''} • </span>}
              <span>Papers Taught: <strong style={{ color: 'var(--text-main)' }}>{user?.subjects?.join(', ') || 'All Assigned Subjects'}</strong></span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span className="badge badge-published" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--emerald)', fontSize: '0.8rem' }}>
            🔒 Scoped to {user?.department || 'Department'} Only
          </span>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>Loading examination records...</div>
      ) : error ? (
        <div className="glass-card" style={{ color: 'var(--rose)', textAlign: 'center' }}>{error}</div>
      ) : exams.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <BookOpen size={48} color="var(--primary)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>No Exams Created Yet</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem auto' }}>
            Get started by creating your first exam. Google Gemini API or intelligent generators will draft interactive questions automatically!
          </p>
          {user?.role === 'admin' ? (
            <Link to="/admin/dashboard" className="btn btn-primary">
              <Shield size={18} /> View Institutional Exams & Approvals
            </Link>
          ) : user && user.isVerified === false ? (
            <button
              className="btn btn-secondary"
              disabled
              title="Account pending administrative approval"
              style={{ opacity: 0.65, cursor: 'not-allowed' }}
            >
              <Sparkles size={18} /> Create Exam (Pending Admin Approval)
            </button>
          ) : (
            <Link to="/teacher/create-exam" className="btn btn-primary">
              <Sparkles size={18} /> Create First Exam
            </Link>
          )}
        </div>
      ) : (
        <div className="grid-2">
          {exams.map((exam) => {
            const examId = exam._id || exam.id;
            const windowStatus = getWindowStatus(exam.startTime, exam.endTime);

            return (
              <div key={examId} className="glass-card fade-in" style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Header with Title and Badges */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                      <span className={`badge badge-${exam.status}`}>{exam.status}</span>
                      <span className="badge badge-published" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)' }}>
                        {exam.examType?.toUpperCase() || 'MCQ'}
                      </span>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '6px',
                        background: windowStatus.bg,
                        color: windowStatus.color,
                        border: `1px solid ${windowStatus.border}`
                      }}>
                        {windowStatus.label}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '1.3rem', marginTop: '0.2rem', fontWeight: '700' }}>{exam.title}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {exam.subject} &bull; {exam.topic}
                    </p>
                  </div>

                  {exam.examCode && (
                    <button
                      onClick={() => handleCopyCode(exam.examCode)}
                      title="Click to copy exam code"
                      style={{
                        background: 'rgba(99, 102, 241, 0.15)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        color: 'var(--primary)',
                        padding: '0.3rem 0.6rem',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: '800',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}>
                      {copiedCode === exam.examCode ? <Check size={12} /> : <Key size={12} />}
                      {exam.examCode}
                    </button>
                  )}
                </div>

                {/* Exam Schedule Window Box */}
                <div style={{
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                  fontSize: '0.82rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Calendar size={14} /> Schedule Window:
                    </span>
                    <button
                      onClick={() => openScheduleModal(exam)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#6366f1',
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        fontWeight: '700',
                        textDecoration: 'underline',
                        padding: 0
                      }}>
                      Change Window
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ffffff', flexWrap: 'wrap', gap: '0.4rem' }}>
                    <span>Start: <strong>{formatDisplayDate(exam.startTime)}</strong></span>
                    <span>&rarr;</span>
                    <span>End: <strong>{formatDisplayDate(exam.endTime)}</strong></span>
                  </div>
                </div>

                {/* Parameters Info Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem',
                  background: 'rgba(0,0,0,0.2)',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  marginBottom: '1.25rem',
                  color: 'var(--text-muted)'
                }}>
                  <div>
                    <Clock size={13} style={{ display: 'inline', marginRight: '4px' }} /> Duration:
                    <strong style={{ color: '#ffffff', marginLeft: '4px' }}>{exam.durationMinutes}m</strong>
                  </div>
                  <div>
                    Questions:
                    <strong style={{ color: '#ffffff', marginLeft: '4px' }}>
                      {exam.questionCount && exam.questions?.length && exam.questionCount < exam.questions.length
                        ? `${exam.questionCount} of ${exam.questions.length} (Shuffled)`
                        : `${exam.questions?.length || exam.questionCount || 0}`}
                    </strong>
                  </div>
                  <div>
                    Total Marks:
                    <strong style={{ color: 'var(--emerald)', marginLeft: '4px' }}>{exam.totalMarks || 10} pts</strong>
                  </div>
                  <div>
                    Passing:
                    <strong style={{ color: 'var(--primary)', marginLeft: '4px' }}>{exam.passingPercentage || 40}%</strong>
                  </div>
                </div>

                {/* Actions Grid */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => openScheduleModal(exam)}
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '0.6rem 0.75rem', fontSize: '0.85rem' }}
                    title="Edit Schedule Window & Exam Rules">
                    <Calendar size={15} /> Edit Schedule
                  </button>

                  <Link to={`/teacher/review-questions/${examId}`} className="btn btn-secondary" style={{ flex: 1, padding: '0.6rem 0.75rem', fontSize: '0.85rem' }}>
                    <Edit3 size={15} /> Questions
                  </Link>

                  <Link to={`/teacher/grading/${examId}`} className="btn btn-primary" style={{ flex: 1.2, padding: '0.6rem 0.75rem', fontSize: '0.85rem' }} title="View student results, response sheets, and scores">
                    <Award size={15} /> View Results
                  </Link>

                  <button
                    onClick={() => handleDeleteExam(examId)}
                    className="btn btn-secondary"
                    style={{ padding: '0.6rem 0.75rem', color: 'var(--rose)' }}
                    title="Delete Exam">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Schedule Window Modal */}
      {scheduleModalExam && (
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
            maxWidth: '560px',
            width: '100%',
            maxHeight: '92vh',
            overflowY: 'auto',
            padding: '2rem',
            borderRadius: '18px',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
            position: 'relative'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', fontSize: '0.85rem', fontWeight: '700' }}>
                  <Calendar size={16} /> Examination Window Control
                </div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginTop: '0.2rem' }}>
                  Edit Exam Schedule
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Modify the exam access window, test duration, and passing score.
                </p>
              </div>
              <button
                onClick={closeScheduleModal}
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

            {/* Error & Success alerts */}
            {scheduleError && (
              <div style={{
                background: 'rgba(244, 63, 94, 0.15)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                color: '#f43f5e',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertCircle size={16} /> {scheduleError}
              </div>
            )}

            {scheduleSuccess && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#10b981',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <CheckCircle size={16} /> {scheduleSuccess}
              </div>
            )}

            <form onSubmit={handleSaveSchedule}>
              {/* Title */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontSize: '0.85rem' }}>Exam Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={scheduleForm.title}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })}
                  required
                />
              </div>

              {/* Schedule Window Start and End Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.85rem' }}>Start Window Time</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={scheduleForm.startTime}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.85rem' }}>End Window Time</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={scheduleForm.endTime}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, endTime: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: '600' }}>
                  Quick Schedule Adjustments:
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
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
                    ⚡ Set Start to Right Now
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
                    +24 Hours (1 Day)
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
                    +7 Days
                  </button>
                </div>
              </div>

              {/* Dynamic Live Status Indicator */}
              {(() => {
                const status = getWindowStatus(scheduleForm.startTime, scheduleForm.endTime);
                return (
                  <div style={{
                    padding: '0.6rem 0.8rem',
                    borderRadius: '8px',
                    background: status.bg,
                    border: `1px solid ${status.border}`,
                    color: status.color,
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '1.25rem'
                  }}>
                    <span>Status with this window:</span>
                    <strong>{status.label}</strong>
                  </div>
                );
              })()}

              {/* Duration, Passing %, Exam Code, Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.85rem' }}>Duration (Minutes)</label>
                  <input
                    type="number"
                    min="5"
                    max="300"
                    className="form-input"
                    value={scheduleForm.durationMinutes}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, durationMinutes: e.target.value })}
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
                    value={scheduleForm.passingPercentage}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, passingPercentage: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.85rem' }}>Exam Code</label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    value={scheduleForm.examCode}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, examCode: e.target.value.toUpperCase() })}
                    placeholder="e.g. CS101"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.85rem' }}>Publication Status</label>
                  <select
                    className="form-select"
                    value={scheduleForm.status}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, status: e.target.value })}>
                    <option value="published">Published (Candidates can see)</option>
                    <option value="draft">Draft (Hidden from candidates)</option>
                    <option value="closed">Closed / Archived</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={closeScheduleModal}
                  className="btn btn-secondary"
                  disabled={scheduleSaving}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={scheduleSaving}
                  style={{ minWidth: '140px' }}>
                  {scheduleSaving ? (
                    <RefreshCw size={16} className="spin" />
                  ) : (
                    <>
                      <CheckCircle size={16} /> Save Schedule
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
