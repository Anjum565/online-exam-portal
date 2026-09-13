import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import {
  Shield, Users, BookOpen, Building, CheckCircle, Clock,
  Eye, Filter, RefreshCw, Award, AlertTriangle, Check, X, Search, FileText
} from 'lucide-react';

export default function AdminOverviewPage() {
  const [activeTab, setActiveTab] = useState('exams'); // 'exams' | 'teachers' | 'students'
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [overview, setOverview] = useState(null);
  const [exams, setExams] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const { API_BASE_URL } = useContext(AuthContext);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ovRes, exRes, tcRes, stRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/admin/overview`),
        axios.get(`${API_BASE_URL}/exams`),
        axios.get(`${API_BASE_URL}/admin/teachers`),
        axios.get(`${API_BASE_URL}/admin/students`)
      ]);

      setOverview(ovRes.data);
      setExams(exRes.data);
      setTeachers(tcRes.data.teachers || []);
      setStudents(stRes.data.students || []);
    } catch (err) {
      console.error('Failed to load admin overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleVerifyStudent = async (studentId, status) => {
    setActionLoading(true);
    try {
      const endpoint = status ? 'verify' : 'revoke';
      await axios.put(`${API_BASE_URL}/admin/students/${studentId}/${endpoint}`);
      setStudents(prev => prev.map(s => (s._id === studentId || s.id === studentId) ? { ...s, isVerified: status } : s));
    } catch (err) {
      alert('Failed to update student verification status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyAll = async () => {
    if (!window.confirm('Approve and verify all pending students across all departments?')) return;
    setActionLoading(true);
    try {
      await axios.put(`${API_BASE_URL}/admin/students/verify-all`);
      setStudents(prev => prev.map(s => ({ ...s, isVerified: true })));
    } catch (err) {
      alert('Failed to verify students.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyTeacher = async (teacherId, status) => {
    setActionLoading(true);
    try {
      const endpoint = status ? 'verify' : 'revoke';
      await axios.put(`${API_BASE_URL}/admin/teachers/${teacherId}/${endpoint}`);
      setTeachers(prev => prev.map(t => (t._id === teacherId || t.id === teacherId) ? { ...t, isVerified: status } : t));
    } catch (err) {
      alert('Failed to update faculty teacher approval status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyAllTeachers = async () => {
    if (!window.confirm('Approve all pending faculty teachers across all departments?')) return;
    setActionLoading(true);
    try {
      await axios.put(`${API_BASE_URL}/admin/teachers/verify-all`);
      setTeachers(prev => prev.map(t => ({ ...t, isVerified: true })));
    } catch (err) {
      alert('Failed to approve all teachers.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter lists based on selected department and search
  const filteredExams = exams.filter(e => {
    const matchDept = selectedDept === 'ALL' || e.department === selectedDept;
    const matchSearch = !searchQuery ||
      (e.title && e.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (e.subject && e.subject.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (e.examCode && e.examCode.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchDept && matchSearch;
  });

  const filteredTeachers = teachers.filter(t => {
    const matchDept = selectedDept === 'ALL' || t.department === selectedDept;
    const matchSearch = !searchQuery ||
      (t.name && t.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.email && t.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (t.subjects && t.subjects.some(s => s.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchDept && matchSearch;
  });

  const filteredStudents = students.filter(s => {
    const matchDept = selectedDept === 'ALL' || s.department === selectedDept;
    const matchSearch = !searchQuery ||
      (s.name && s.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.rollNumber && s.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchDept && matchSearch;
  });

  const departmentsList = overview?.departments || [];

  return (
    <div className="container" style={{ padding: '2rem 1.5rem', maxWidth: '1200px' }}>
      {/* Admin Title Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontWeight: '700', fontSize: '0.9rem', marginBottom: '0.3rem' }}>
            <Shield size={18} /> Central Examination Controller
          </div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: '800' }}>Institution Administration Overview</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Global oversight across all academic departments, faculty teachers, enrolled candidates, and examinations.
          </p>
        </div>

        <button onClick={loadData} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <RefreshCw size={16} /> Refresh Records
        </button>
      </div>

      {/* Global Stat Counters */}
      <div className="grid-4" style={{ marginBottom: '2rem' }}>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Departments</span>
            <Building size={20} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800' }}>{departmentsList.length || 1}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Active Divisions</div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Faculty Teachers</span>
            <Users size={20} color="var(--emerald)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800' }}>{teachers.length}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--emerald)', marginTop: '0.2rem' }}>
            {teachers.filter(t => t.isVerified).length} Approved • {teachers.filter(t => !t.isVerified).length} Pending
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Students</span>
            <Users size={20} color="var(--accent)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800' }}>{students.length}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--emerald)', marginTop: '0.2rem' }}>
            {students.filter(s => s.isVerified).length} Verified • {students.filter(s => !s.isVerified).length} Pending
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Exams</span>
            <BookOpen size={20} color="var(--amber)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800' }}>{exams.length}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Institution-wide</div>
        </div>
      </div>

      {/* Prominent Action Banner for Pending Faculty Approvals */}
      {teachers.some(t => !t.isVerified) && (
        <div className="fade-in" style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(217, 119, 6, 0.1))',
          border: '1px solid rgba(245, 158, 11, 0.5)',
          borderRadius: '14px',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: '0 8px 24px rgba(245, 158, 11, 0.12)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              background: 'rgba(245, 158, 11, 0.25)',
              padding: '0.75rem',
              borderRadius: '12px',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              color: '#fbbf24'
            }}>
              <AlertTriangle size={28} />
            </div>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#fbbf24' }}>
                {teachers.filter(t => !t.isVerified).length} Faculty Teacher(s) Pending Your Institutional Approval
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.2rem', maxWidth: '650px' }}>
                Newly registered teachers are blocked from creating exams until you approve their faculty status. Use the buttons to approve teachers below.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveTab('teachers')}
              className="btn btn-primary"
              style={{
                fontSize: '0.88rem',
                padding: '0.6rem 1.2rem',
                background: '#fbbf24',
                borderColor: '#fbbf24',
                color: '#000000',
                fontWeight: '700'
              }}
            >
              <Users size={16} /> View & Approve Teachers ({teachers.filter(t => !t.isVerified).length})
            </button>
            <button
              onClick={handleVerifyAllTeachers}
              className="btn btn-success"
              style={{ fontSize: '0.88rem', padding: '0.6rem 1.2rem' }}
              disabled={actionLoading}
            >
              <Check size={16} /> Approve All Instantly
            </button>
          </div>
        </div>
      )}

      {/* Filter and Tab Navigation Bar */}
      <div className="glass-card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          {/* Tab buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveTab('exams')}
              className={`btn ${activeTab === 'exams' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.88rem', padding: '0.6rem 1.1rem' }}
            >
              <BookOpen size={16} /> All Exams ({filteredExams.length})
            </button>
            <button
              onClick={() => setActiveTab('teachers')}
              className={`btn ${activeTab === 'teachers' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.88rem', padding: '0.6rem 1.1rem' }}
            >
              <Users size={16} /> Faculty Teachers ({filteredTeachers.length})
              {teachers.some(t => !t.isVerified) && (
                <span style={{
                  background: 'var(--amber)',
                  color: '#000',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '9999px',
                  fontSize: '0.7rem',
                  fontWeight: '800',
                  marginLeft: '0.35rem'
                }}>
                  {teachers.filter(t => !t.isVerified).length} PENDING
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('students')}
              className={`btn ${activeTab === 'students' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.88rem', padding: '0.6rem 1.1rem' }}
            >
              <CheckCircle size={16} /> Students Verification ({filteredStudents.length})
              {students.some(s => !s.isVerified) && (
                <span style={{
                  background: 'var(--amber)',
                  color: '#000',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '9999px',
                  fontSize: '0.7rem',
                  fontWeight: '800',
                  marginLeft: '0.35rem'
                }}>
                  {students.filter(s => !s.isVerified).length} PENDING
                </span>
              )}
            </button>
          </div>

          {/* Department dropdown & Search input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Filter size={16} color="var(--text-muted)" />
              <select
                className="form-select"
                style={{ width: 'auto', minWidth: '180px', padding: '0.45rem 0.8rem', fontSize: '0.85rem' }}
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
              >
                <option value="ALL">All Departments</option>
                {departmentsList.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div style={{ position: 'relative' }}>
              <Search size={15} color="var(--text-subtle)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '2rem', paddingRight: '0.75rem', paddingTop: '0.45rem', paddingBottom: '0.45rem', fontSize: '0.85rem', width: '180px' }}
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Areas */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>Loading institutional records...</div>
      ) : activeTab === 'exams' ? (
        /* TAB 1: ALL EXAMS TABLE */
        <div className="glass-card fade-in" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>All Examinations ({filteredExams.length})</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>View-Only Mode • Teachers set and modify their own department papers</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Exam Details</th>
                  <th>Department</th>
                  <th>Course / Sem</th>
                  <th>Questions & Marks</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExams.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No examinations found matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredExams.map(ex => (
                    <tr key={ex._id || ex.id}>
                      <td>
                        <div style={{ fontWeight: '700', fontSize: '0.92rem', color: '#ffffff' }}>{ex.title}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          Code: <strong style={{ color: 'var(--primary)' }}>{ex.examCode}</strong> • Subject: {ex.subject}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-published" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', fontSize: '0.78rem' }}>
                          {ex.department || 'General'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {ex.course || '—'} {ex.semester ? `(${ex.semester})` : ''}
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        <strong>{ex.questionCount || ex.questions?.length || 0}</strong> Qs • {ex.totalMarks || (ex.questionCount * 2) || 10} Marks
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {ex.durationMinutes} Mins
                      </td>
                      <td>
                        <span className={`badge ${ex.status === 'published' ? 'badge-published' : 'badge-draft'}`}>
                          {ex.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link
                          to={`/teacher/grading/${ex._id || ex.id}`}
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                          <Eye size={13} /> View Results
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'teachers' ? (
        /* TAB 2: TEACHERS TABLE */
        <div className="glass-card fade-in" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>Faculty Teachers Directory ({filteredTeachers.length})</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Approve faculty teachers to permit them to create and manage examinations for their registered department.
              </p>
            </div>

            {teachers.some(t => !t.isVerified) && (
              <button
                onClick={handleVerifyAllTeachers}
                className="btn btn-success"
                style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
                disabled={actionLoading}
              >
                <Check size={15} /> Batch Approve All Pending Teachers
              </button>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Faculty Name</th>
                  <th>Department</th>
                  <th>Affiliation (Course / Sem)</th>
                  <th>Approval Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No faculty teachers found for this department filter.
                    </td>
                  </tr>
                ) : (
                  filteredTeachers.map(tc => (
                    <tr key={tc._id || tc.id}>
                      <td>
                        <div style={{ fontWeight: '700', fontSize: '0.92rem', color: '#ffffff' }}>{tc.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{tc.email}</div>
                      </td>
                      <td>
                        <span className="badge badge-published" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', fontSize: '0.78rem' }}>
                          {tc.department || 'General'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {tc.course || '—'} {tc.semester ? `• ${tc.semester}` : ''}
                      </td>
                      <td>
                        {tc.isVerified ? (
                          <span className="badge badge-published" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--emerald)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <CheckCircle size={13} /> Approved Faculty
                          </span>
                        ) : (
                          <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <AlertTriangle size={13} /> Pending Approval
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {tc.isVerified ? (
                          <button
                            onClick={() => handleVerifyTeacher(tc._id || tc.id, false)}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', color: 'var(--rose)', borderColor: 'rgba(244, 63, 94, 0.3)' }}
                            disabled={actionLoading}
                          >
                            Revoke
                          </button>
                        ) : (
                          <button
                            onClick={() => handleVerifyTeacher(tc._id || tc.id, true)}
                            className="btn btn-success"
                            style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}
                            disabled={actionLoading}
                          >
                            <Check size={13} /> Approve Faculty
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* TAB 3: STUDENTS VERIFICATION */
        <div className="glass-card fade-in" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>Student Candidates Verification ({filteredStudents.length})</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Verify students to permit them to enter and take proctored examinations.
              </p>
            </div>

            {students.some(s => !s.isVerified) && (
              <button
                onClick={handleVerifyAll}
                className="btn btn-success"
                style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
                disabled={actionLoading}
              >
                <Check size={15} /> Batch Verify All Pending
              </button>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Roll / ID</th>
                  <th>Department</th>
                  <th>Course / Sem</th>
                  <th>Verification Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No students found matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map(st => (
                    <tr key={st._id || st.id}>
                      <td>
                        <div style={{ fontWeight: '700', fontSize: '0.92rem', color: '#ffffff' }}>{st.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{st.email}</div>
                      </td>
                      <td style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>
                        {st.rollNumber || '—'}
                      </td>
                      <td>
                        <span className="badge badge-published" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', fontSize: '0.78rem' }}>
                          {st.department || 'General'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {st.course || '—'} {st.semester ? `(${st.semester})` : ''}
                      </td>
                      <td>
                        {st.isVerified ? (
                          <span className="badge badge-published" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--emerald)' }}>
                            <Check size={12} style={{ display: 'inline', marginRight: '3px' }} /> Verified
                          </span>
                        ) : (
                          <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.18)', color: 'var(--amber)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                            Pending Approval
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {st.isVerified ? (
                          <button
                            onClick={() => handleVerifyStudent(st._id || st.id, false)}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', color: 'var(--rose)' }}
                            disabled={actionLoading}
                          >
                            Revoke
                          </button>
                        ) : (
                          <button
                            onClick={() => handleVerifyStudent(st._id || st.id, true)}
                            className="btn btn-success"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                            disabled={actionLoading}
                          >
                            Approve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
