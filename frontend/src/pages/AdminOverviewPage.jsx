import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import {
  Shield, Users, BookOpen, Building, CheckCircle, Clock,
  Eye, Filter, RefreshCw, Award, AlertTriangle, Check, X, Search, FileText, Trash2,
  Download, Printer, Table, Camera, BarChart3, PieChart, TrendingUp, UserCheck
} from 'lucide-react';
import { ScoreDistributionChart, PassFailDonutChart, DepartmentComparisonChart } from '../components/AnalyticsCharts';

export default function AdminOverviewPage({ defaultTab = 'exams' }) {
  const [activeTab, setActiveTab] = useState(defaultTab); // 'exams' | 'teachers' | 'students' | 'results'
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [overview, setOverview] = useState(null);
  const [exams, setExams] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Department Results & Printouts Reporting States
  const [reportData, setReportData] = useState([]);
  const [reportAnalytics, setReportAnalytics] = useState(null);
  const [reportFilterOptions, setReportFilterOptions] = useState({ departments: [], courses: [], semesters: [], subjects: [] });
  const [reportDept, setReportDept] = useState('ALL');
  const [reportCourse, setReportCourse] = useState('ALL');
  const [reportSemester, setReportSemester] = useState('ALL');
  const [reportSubject, setReportSubject] = useState('ALL');
  const [reportSearch, setReportSearch] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  // Visual Analytics Charts Data
  const [chartsData, setChartsData] = useState(null);

  // Proctoring Snapshot Modal State
  const [selectedSnapshotSub, setSelectedSnapshotSub] = useState(null);

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

  const fetchDepartmentResults = async () => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams();
      if (reportDept && reportDept !== 'ALL') params.append('department', reportDept);
      if (reportCourse && reportCourse !== 'ALL') params.append('course', reportCourse);
      if (reportSemester && reportSemester !== 'ALL') params.append('semester', reportSemester);
      if (reportSubject && reportSubject !== 'ALL') params.append('subject', reportSubject);
      if (reportSearch && reportSearch.trim()) params.append('search', reportSearch.trim());

      const res = await axios.get(`${API_BASE_URL}/admin/reports/department-results?${params.toString()}`);
      setReportData(res.data.results || []);
      setReportAnalytics(res.data.analytics || null);
      if (res.data.filterOptions) {
        setReportFilterOptions(res.data.filterOptions);
      }
    } catch (err) {
      console.error('Failed to load department results report:', err);
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const fetchChartsData = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/admin/analytics/charts-data`);
      setChartsData(res.data);
    } catch (e) {
      console.warn('Failed to load charts data:', e.message);
    }
  };

  useEffect(() => {
    if (activeTab === 'results') {
      fetchDepartmentResults();
      fetchChartsData();
    }
  }, [activeTab, reportDept, reportCourse, reportSemester, reportSubject]);

  const handleReallowStudent = async (subId, studentName) => {
    if (!window.confirm(`Re-allow "${studentName}" to re-enter this examination? Their disqualified status will be lifted immediately.`)) return;
    setActionLoading(true);
    try {
      await axios.put(`${API_BASE_URL}/admin/submissions/${subId}/re-allow`, {
        reason: 'Authorized by institution administrator after accidental minimization'
      });
      alert(`Candidate "${studentName}" has been successfully unlocked and authorized to re-enter!`);
      fetchDepartmentResults();
      fetchChartsData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to re-allow student attempt.');
    } finally {
      setActionLoading(false);
    }
  };

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

  const handleDeleteTeacher = async (teacherId, teacherName) => {
    if (!window.confirm(`Are you sure you want to permanently delete teacher "${teacherName}"? This action cannot be undone.`)) return;
    setActionLoading(true);
    try {
      await axios.delete(`${API_BASE_URL}/admin/teachers/${teacherId}`);
      setTeachers(prev => prev.filter(t => (t._id !== teacherId && t.id !== teacherId)));
      alert(`Teacher "${teacherName}" has been deleted permanently.`);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete teacher account.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteExam = async (examId, examTitle) => {
    if (!window.confirm(`Are you sure you want to permanently delete examination "${examTitle}"? All associated student records and submissions will also be removed.`)) return;
    setActionLoading(true);
    try {
      await axios.delete(`${API_BASE_URL}/admin/exams/${examId}`);
      setExams(prev => prev.filter(e => (e._id !== examId && e.id !== examId)));
      alert(`Examination "${examTitle}" and all related student submissions have been deleted.`);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete examination.');
    } finally {
      setActionLoading(false);
    }
  };

  // Export Department CSV Handler
  const handleExportDepartmentCSV = () => {
    if (!reportData || reportData.length === 0) {
      return alert('No student results available to export for the selected criteria.');
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Roll Number,Student Name,Email,Department,Course,Semester,Subject,Exam Title,Exam Code,Score,Total Marks,Percentage (%),Result Status,Violations (Tab Switches),Submission Status,Evaluation Date,Feedback\n";

    reportData.forEach(sub => {
      const roll = (sub.studentRollNumber || 'N/A').replace(/"/g, '""');
      const name = (sub.studentName || 'N/A').replace(/"/g, '""');
      const email = (sub.studentEmail || 'N/A').replace(/"/g, '""');
      const dept = (sub.studentDepartment || reportDept || 'N/A').replace(/"/g, '""');
      const course = (sub.studentCourse || 'N/A').replace(/"/g, '""');
      const sem = (sub.studentSemester || 'N/A').replace(/"/g, '""');
      const subj = (sub.subject || 'N/A').replace(/"/g, '""');
      const title = (sub.examTitle || '').replace(/"/g, '""');
      const code = (sub.examCode || 'N/A').replace(/"/g, '""');

      const marks = sub.marksObtained !== null && sub.marksObtained !== undefined ? sub.marksObtained : 0;
      const total = sub.examTotalMarks || sub.totalMarks || 10;
      const pct = sub.percentage !== undefined ? sub.percentage : (total > 0 ? Math.round((marks / total) * 100) : 0);
      const passing = sub.examPassingPercentage || 40;
      const resultStatus = sub.isTerminated || sub.status === 'terminated' ? 'Disqualified' : (pct >= passing ? 'Passed' : 'Failed');
      const tabSwitches = sub.tabSwitchCount || 0;
      const status = sub.status || 'submitted';
      const evalDate = sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : 'N/A';
      const cleanFeedback = (sub.feedback || '').replace(/"/g, '""');

      csvContent += `"${roll}","${name}","${email}","${dept}","${course}","${sem}","${subj}","${title}","${code}",${marks},${total},${pct}%,${resultStatus},${tabSwitches},${status},"${evalDate}","${cleanFeedback}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const deptTag = reportDept !== 'ALL' ? `_${reportDept.replace(/\s+/g, '_')}` : '_All_Departments';
    link.setAttribute("download", `Institutional_Results${deptTag}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintInstitutionalReport = () => {
    window.print();
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
    <div className="container" style={{ padding: '2rem 1.5rem', maxWidth: '1280px' }}>
      {/* Admin Title Banner */}
      <div className="no-print" style={{
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

        <button onClick={() => { loadData(); if (activeTab === 'results') fetchDepartmentResults(); }} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <RefreshCw size={16} /> Refresh Records
        </button>
      </div>

      {/* Global Stat Counters */}
      <div className="grid-4 no-print" style={{ marginBottom: '2rem' }}>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Departments</span>
            <Building size={20} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800' }}>{overview?.totalDepartments || 0}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Active Institutions</div>
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
        <div className="fade-in no-print" style={{
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
      <div className="glass-card no-print" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
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
            <button
              onClick={() => setActiveTab('results')}
              className={`btn ${activeTab === 'results' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.88rem', padding: '0.6rem 1.1rem' }}
            >
              <Award size={16} /> Department Results & Printouts
            </button>
          </div>

          {/* Department dropdown & Search input (for tabs 1-3) */}
          {activeTab !== 'results' && (
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
          )}
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
                        {ex.questions?.length || 0} Qs • {ex.totalMarks || 10} Marks
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {ex.durationMinutes} mins
                      </td>
                      <td>
                        <span className={`badge ${ex.status === 'published' ? 'badge-published' : 'badge-draft'}`}>
                          {ex.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <Link
                            to={`/teacher/grading/${ex._id || ex.id}`}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                            title="Audit Exam Submissions & Scores"
                          >
                            <Eye size={13} /> Audit
                          </Link>
                          <button
                            onClick={() => handleDeleteExam(ex._id || ex.id, ex.title)}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', color: 'var(--rose)' }}
                            disabled={actionLoading}
                            title="Delete Exam & Submissions Permanently"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'teachers' ? (
        /* TAB 2: FACULTY TEACHERS TABLE */
        <div className="glass-card fade-in" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>Faculty Teachers ({filteredTeachers.length})</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Institutional security gate: Approve faculty accounts to permit exam generation & scheduling
              </p>
            </div>
            {teachers.some(t => !t.isVerified) && (
              <button
                onClick={handleVerifyAllTeachers}
                className="btn btn-success"
                style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem' }}
                disabled={actionLoading}
              >
                <Check size={14} /> Approve All Pending ({teachers.filter(t => !t.isVerified).length})
              </button>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Faculty Name & Email</th>
                  <th>Department</th>
                  <th>Designated Course / Semester</th>
                  <th>Assigned Subject(s)</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No teachers found matching your filter criteria.
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
                        {tc.course || '—'} {tc.semester ? `(${tc.semester})` : ''}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                          {tc.subjects && tc.subjects.length > 0 ? (
                            tc.subjects.map((sub, i) => (
                              <span key={i} style={{ background: 'rgba(255,255,255,0.05)', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {sub}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: 'var(--text-subtle)', fontSize: '0.8rem' }}>All Subjects</span>
                          )}
                        </div>
                      </td>
                      <td>
                        {tc.isVerified ? (
                          <span className="badge badge-published" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--emerald)' }}>
                            <Check size={12} style={{ display: 'inline', marginRight: '3px' }} /> Approved
                          </span>
                        ) : (
                          <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.18)', color: 'var(--amber)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                            Pending Approval
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          {tc.isVerified ? (
                            <button
                              onClick={() => handleVerifyTeacher(tc._id || tc.id, false)}
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', color: 'var(--rose)' }}
                              disabled={actionLoading}
                            >
                              Revoke
                            </button>
                          ) : (
                            <button
                              onClick={() => handleVerifyTeacher(tc._id || tc.id, true)}
                              className="btn btn-success"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                              disabled={actionLoading}
                            >
                              Approve
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteTeacher(tc._id || tc.id, tc.name)}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', color: 'var(--rose)' }}
                            disabled={actionLoading}
                            title="Delete Teacher Account Permanently"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'students' ? (
        /* TAB 3: STUDENTS VERIFICATION TABLE */
        <div className="glass-card fade-in" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>Student Verification & Enrolment ({filteredStudents.length})</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Review candidate registrations and approve eligibility to sit for examinations
              </p>
            </div>
            {students.some(s => !s.isVerified) && (
              <button
                onClick={handleVerifyAll}
                className="btn btn-success"
                style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem' }}
                disabled={actionLoading}
              >
                <Check size={14} /> Approve All Pending ({students.filter(s => !s.isVerified).length})
              </button>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Student Name & Email</th>
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
                      <td style={{ fontSize: '0.85rem', fontFamily: 'monospace', fontWeight: '700', color: 'var(--primary)' }}>
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
      ) : (
        /* TAB 4: DEPARTMENT RESULTS, EXPORTS & PRINTOUTS (NEW!) */
        <div className="fade-in">
          {/* Printable Letterhead Header (Only appears when window.print() is called) */}
          <div className="print-only" style={{ marginBottom: '1.5rem', textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '0.75rem' }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: '900', color: '#000', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ONLINE EXAMINATION CONTROL DIVISION
            </h1>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#111', marginTop: '0.2rem' }}>
              OFFICIAL DEPARTMENTAL RESULTS & PERFORMANCE TABULATION
            </h2>
            <div style={{ fontSize: '0.9rem', color: '#333', marginTop: '0.25rem' }}>
              Target Department: <strong>{reportDept === 'ALL' ? 'All Institutional Departments' : reportDept}</strong> &bull; Report Date: <strong>{new Date().toLocaleString()}</strong>
            </div>
            {reportAnalytics && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '0.5rem', fontSize: '0.85rem', color: '#222' }}>
                <span>Total Candidates: <strong>{reportAnalytics.totalCandidates}</strong></span>
                <span>Passed: <strong>{reportAnalytics.totalPassed}</strong></span>
                <span>Failed / Disqualified: <strong>{reportAnalytics.totalFailed}</strong></span>
                <span>Pass Rate: <strong>{reportAnalytics.passPercentage}%</strong></span>
                <span>Avg Marks: <strong>{reportAnalytics.averageScore}%</strong></span>
              </div>
            )}
          </div>

          {/* Web Filtering & Action Header (Hidden during printing) */}
          <div className="glass-card no-print" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Award color="var(--primary)" size={22} /> Departmental Examination Results & Marksheets
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                  Filter student examination attempts according to department, semester, and subject to generate official printouts or export complete CSV files.
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  onClick={handleExportDepartmentCSV}
                  className="btn btn-success"
                  style={{ padding: '0.55rem 1rem', fontSize: '0.85rem' }}
                  title="Export results including Roll Number, Semester, and Subject"
                >
                  <Download size={16} /> Export Department CSV
                </button>
                <button
                  onClick={handlePrintInstitutionalReport}
                  className="btn btn-secondary"
                  style={{ padding: '0.55rem 1rem', fontSize: '0.85rem' }}
                  title="Open print preview to print or save PDF marksheet"
                >
                  <Printer size={16} /> Print Official Marksheet
                </button>
              </div>
            </div>

            {/* Visual Performance Analytics Charts */}
            {chartsData && (
              <div style={{ marginBottom: '1.75rem' }} className="no-print">
                <div className="grid-2" style={{ marginBottom: '1.25rem' }}>
                  <ScoreDistributionChart data={chartsData.scoreDistribution} />
                  <PassFailDonutChart passFail={chartsData.passFailRatio} />
                </div>
                <DepartmentComparisonChart departments={chartsData.departmentComparison} />
              </div>
            )}

            {/* Filter Controls Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.75rem',
              background: 'rgba(255,255,255,0.02)',
              padding: '1rem',
              borderRadius: '10px',
              border: '1px solid var(--border-light)'
            }}>
              {/* Department Selector */}
              <div>
                <label className="form-label" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Department</label>
                <select
                  className="form-select"
                  value={reportDept}
                  onChange={(e) => setReportDept(e.target.value)}
                  style={{ fontSize: '0.85rem', padding: '0.45rem 0.75rem' }}
                >
                  <option value="ALL">All Departments</option>
                  {(reportFilterOptions.departments.length > 0 ? reportFilterOptions.departments : departmentsList).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Semester Selector */}
              <div>
                <label className="form-label" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Semester</label>
                <select
                  className="form-select"
                  value={reportSemester}
                  onChange={(e) => setReportSemester(e.target.value)}
                  style={{ fontSize: '0.85rem', padding: '0.45rem 0.75rem' }}
                >
                  <option value="ALL">All Semesters</option>
                  {(reportFilterOptions.semesters.length > 0 ? reportFilterOptions.semesters : ['Semester 1', 'Semester 2', 'Semester 3', 'Semester 4', 'Semester 5', 'Semester 6', 'Semester 7', 'Semester 8']).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Course Selector */}
              <div>
                <label className="form-label" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Course</label>
                <select
                  className="form-select"
                  value={reportCourse}
                  onChange={(e) => setReportCourse(e.target.value)}
                  style={{ fontSize: '0.85rem', padding: '0.45rem 0.75rem' }}
                >
                  <option value="ALL">All Courses</option>
                  {(reportFilterOptions.courses.length > 0 ? reportFilterOptions.courses : ['B.Tech', 'B.E.', 'BCA', 'MCA', 'M.Tech']).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Subject Selector */}
              <div>
                <label className="form-label" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Subject</label>
                <select
                  className="form-select"
                  value={reportSubject}
                  onChange={(e) => setReportSubject(e.target.value)}
                  style={{ fontSize: '0.85rem', padding: '0.45rem 0.75rem' }}
                >
                  <option value="ALL">All Subjects</option>
                  {reportFilterOptions.subjects.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>

              {/* Search Box */}
              <div>
                <label className="form-label" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Search Candidate</label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Name, Roll No, Email..."
                    value={reportSearch}
                    onChange={(e) => setReportSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') fetchDepartmentResults(); }}
                    className="form-input"
                    style={{ paddingLeft: '2.1rem', fontSize: '0.85rem', padding: '0.45rem 0.75rem 0.45rem 2.1rem' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Departmental Analytics Summary Cards (Hidden during printing) */}
          {reportAnalytics && (
            <div className="grid-4 no-print" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
              <div className="glass-card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Candidates Appeared</div>
                <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-main)', marginTop: '0.2rem' }}>{reportAnalytics.totalCandidates}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{reportDept === 'ALL' ? 'All Departments' : reportDept}</div>
              </div>
              <div className="glass-card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--emerald)', textTransform: 'uppercase', fontWeight: '700' }}>Passed</div>
                <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--emerald)', marginTop: '0.2rem' }}>{reportAnalytics.totalPassed}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Candidates cleared pass marks</div>
              </div>
              <div className="glass-card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--rose)', textTransform: 'uppercase', fontWeight: '700' }}>Failed / Disqualified</div>
                <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--rose)', marginTop: '0.2rem' }}>{reportAnalytics.totalFailed}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{reportAnalytics.totalTerminated} terminated attempts</div>
              </div>
              <div className="glass-card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--sky)', textTransform: 'uppercase', fontWeight: '700' }}>Department Pass Rate</div>
                <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--sky)', marginTop: '0.2rem' }}>{reportAnalytics.passPercentage}%</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Average score: {reportAnalytics.averageScore}%</div>
              </div>
            </div>
          )}

          {/* Tabular Department Marksheet Table */}
          <div className="glass-card" style={{ padding: '0', overflowX: 'auto' }}>
            {reportLoading ? (
              <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading department results...
              </div>
            ) : reportData.length === 0 ? (
              <div style={{ padding: '4rem', textAlign: 'center' }}>
                <Award size={48} color="var(--text-subtle)" style={{ marginBottom: '1rem' }} />
                <h3>No Examination Records Found</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.4rem', maxWidth: '500px', margin: '0 auto' }}>
                  No candidate submissions match the selected department, semester, or subject criteria. Try selecting "All Departments" or clearing search filters.
                </p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border-light)' }}>
                    <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Department</th>
                    <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Roll No</th>
                    <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Candidate Name & Email</th>
                    <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sem & Course</th>
                    <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Subject & Exam</th>
                    <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Score / Total</th>
                    <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Percentage</th>
                    <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Result</th>
                    <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Violations</th>
                    <th className="no-print" style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((sub, idx) => {
                    const marks = sub.marksObtained ?? 0;
                    const total = sub.examTotalMarks || sub.totalMarks || 10;
                    const pct = sub.percentage !== undefined ? sub.percentage : (total > 0 ? Math.round((marks / total) * 100) : 0);
                    const passing = sub.examPassingPercentage || 40;
                    const isTerminated = sub.isTerminated || sub.status === 'terminated';
                    const isPassed = !isTerminated && (sub.passed || pct >= passing);

                    return (
                      <tr key={sub._id || sub.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        {/* Department */}
                        <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', fontWeight: '600' }}>
                          <span className="badge badge-published" style={{ background: 'rgba(99, 102, 241, 0.12)', color: 'var(--primary)', fontSize: '0.75rem' }}>
                            {sub.studentDepartment || reportDept}
                          </span>
                        </td>

                        {/* Roll Number */}
                        <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: '700', color: 'var(--primary)', fontFamily: 'monospace' }}>
                          {sub.studentRollNumber || 'N/A'}
                        </td>

                        {/* Student Details */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#ffffff' }}>{sub.studentName}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{sub.studentEmail}</div>
                        </td>

                        {/* Semester & Course */}
                        <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem' }}>
                          <div>{sub.studentSemester || 'Semester 4'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sub.studentCourse || 'B.Tech'}</div>
                        </td>

                        {/* Subject & Exam */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{sub.subject || 'Subject'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sub.examTitle || 'Exam'} {sub.examCode ? `(${sub.examCode})` : ''}</div>
                        </td>

                        {/* Marks */}
                        <td style={{ padding: '0.85rem 1rem', fontSize: '0.92rem', fontWeight: '700', color: isPassed ? 'var(--emerald)' : 'var(--rose)' }}>
                          {sub.marksObtained !== null && sub.marksObtained !== undefined ? sub.marksObtained : '—'} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>/ {total}</span>
                        </td>

                        {/* Percentage */}
                        <td style={{ padding: '0.85rem 1rem', fontSize: '0.88rem', fontWeight: '700' }}>
                          {pct}%
                        </td>

                        {/* Result Badge */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          {isTerminated ? (
                            <span className="badge badge-draft" style={{ background: 'rgba(244, 63, 94, 0.2)', color: 'var(--rose)', borderColor: 'rgba(244, 63, 94, 0.4)' }}>
                              DISQUALIFIED
                            </span>
                          ) : isPassed ? (
                            <span className="badge badge-published" style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--emerald)', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                              PASSED
                            </span>
                          ) : (
                            <span className="badge badge-draft" style={{ background: 'rgba(245, 158, 11, 0.2)', color: 'var(--amber)', borderColor: 'rgba(245, 158, 11, 0.4)' }}>
                              NEEDS IMPR.
                            </span>
                          )}
                        </td>

                        {/* Tab Switches */}
                        <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem' }}>
                          {sub.tabSwitchCount > 0 ? (
                            <span style={{ color: 'var(--amber)', fontWeight: '700' }}>{sub.tabSwitchCount} switches</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>0 (Clean)</span>
                          )}
                        </td>

                        {/* Action Buttons (Hidden on Print) */}
                        <td className="no-print" style={{ padding: '0.85rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                            <Link
                              to={`/teacher/grading/${sub.examId}`}
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                              title="Audit individual answers and remarks"
                            >
                              <Eye size={13} /> Audit
                            </Link>

                            {isTerminated && (
                              <button
                                onClick={() => handleReallowStudent(sub._id || sub.id, sub.studentName)}
                                className="btn btn-primary"
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.75rem',
                                  background: 'var(--amber)',
                                  borderColor: 'var(--amber)',
                                  color: '#000000',
                                  fontWeight: '700'
                                }}
                                title="Re-allow candidate who was mistakenly minimized or disconnected"
                                disabled={actionLoading}
                              >
                                <RefreshCw size={13} /> Re-allow
                              </button>
                            )}

                            {sub.proctoringSnapshots && sub.proctoringSnapshots.length > 0 && (
                              <button
                                onClick={() => setSelectedSnapshotSub(sub)}
                                className="btn btn-secondary"
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}
                                title="View webcam snapshots captured during examination"
                              >
                                <Camera size={13} /> {sub.proctoringSnapshots.length} Snaps
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Proctoring Snapshots Modal */}
      {selectedSnapshotSub && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '780px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ffffff' }}>
                  <Camera size={18} color="var(--primary)" /> Proctoring Snapshot Audit
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                  Candidate: <strong>{selectedSnapshotSub.studentName}</strong> &bull; Exam: {selectedSnapshotSub.examTitle || 'Test'}
                </p>
              </div>
              <button
                onClick={() => setSelectedSnapshotSub(null)}
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem'
            }}>
              {(selectedSnapshotSub.proctoringSnapshots || []).map((snap, sIdx) => (
                <div key={sIdx} style={{
                  background: 'rgba(0, 0, 0, 0.5)',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  border: `1px solid ${snap.trigger === 'violation' ? 'var(--rose)' : 'var(--border-light)'}`
                }}>
                  <img
                    src={snap.image}
                    alt={`Snapshot ${sIdx + 1}`}
                    style={{ width: '100%', height: '150px', objectFit: 'cover', display: 'block', background: '#000' }}
                  />
                  <div style={{ padding: '0.6rem 0.75rem', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.8)' }}>
                    <span style={{
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: snap.trigger === 'violation' ? 'var(--rose)' : (snap.trigger === 'initial' ? 'var(--primary)' : '#34d399')
                    }}>
                      {snap.trigger || 'Periodic'}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {new Date(snap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedSnapshotSub(null)} className="btn btn-primary" style={{ padding: '0.5rem 1.5rem' }}>
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
