import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import InlineScriptViewer from '../components/InlineScriptViewer';
import CodeBlock from '../components/CodeBlock';
import {
  Users, CheckCircle, Save, Award, ArrowLeft, Download, Printer,
  ShieldAlert, Check, X, Clock, Table, FileText, Search, Filter, AlertTriangle
} from 'lucide-react';

export default function GradingViewPage() {
  const { examId } = useParams();
  const [exam, setExam] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [selectedSub, setSelectedSub] = useState(null);
  const [marksObtained, setMarksObtained] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // View mode and filtering state
  const [viewMode, setViewMode] = useState('tabulation'); // 'tabulation' | 'evaluation'
  const [selectedSemester, setSelectedSemester] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const { API_BASE_URL } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const fetchGradingData = async () => {
      setError('');
      try {
        const token = localStorage.getItem('token');
        const config = {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        };

        const examRes = await axios.get(`${API_BASE_URL}/exams/${examId}`, config);
        if (isMounted) setExam(examRes.data);

        const subRes = await axios.get(`${API_BASE_URL}/grading/exam/${examId}`, config);
        if (isMounted) {
          const subs = Array.isArray(subRes.data) ? subRes.data : [];
          setSubmissions(subs);
          if (subs.length > 0) {
            const firstSub = subs[0];
            setSelectedSub(firstSub);
            setMarksObtained(firstSub.marksObtained !== null && firstSub.marksObtained !== undefined ? firstSub.marksObtained : '');
            setFeedback(firstSub.feedback || '');
          }
        }
      } catch (err) {
        console.error('Error fetching grading data:', err);
        if (isMounted) setError(err.response?.data?.error || 'Failed to load evaluation portal.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchGradingData();

    return () => {
      isMounted = false;
    };
  }, [examId]);

  const selectSubmission = (sub) => {
    setSelectedSub(sub);
    setMarksObtained(sub.marksObtained !== null && sub.marksObtained !== undefined ? sub.marksObtained : '');
    setFeedback(sub.feedback || '');
    setViewMode('evaluation');
  };

  const handleSaveGrade = async (e) => {
    e.preventDefault();
    if (!selectedSub) return;

    setSaving(true);
    try {
      const subId = selectedSub._id || selectedSub.id;
      const res = await axios.put(`${API_BASE_URL}/grading/submission/${subId}`, {
        marksObtained: Number(marksObtained),
        feedback
      });

      alert('Grade updated successfully!');
      // Update local state
      const updatedList = submissions.map(s => (s._id === subId || s.id === subId ? res.data.submission : s));
      setSubmissions(updatedList);
      setSelectedSub(res.data.submission);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save grade.');
    } finally {
      setSaving(false);
    }
  };

  // Collect available unique semesters
  const availableSemesters = Array.from(new Set(
    submissions.map(s => s.studentSemester || (exam && exam.semester) || '').filter(Boolean)
  )).sort();

  // Filtered candidate submissions for tabulation and export
  const filteredSubmissions = submissions.filter(sub => {
    const sem = (sub.studentSemester || (exam && exam.semester) || '').toLowerCase();
    if (selectedSemester !== 'ALL' && sem !== selectedSemester.toLowerCase()) {
      return false;
    }

    const passing = sub.examPassingPercentage || exam?.passingPercentage || 40;
    const total = sub.examTotalMarks || exam?.totalMarks || 10;
    const marks = sub.marksObtained ?? 0;
    const pct = sub.percentage !== undefined ? sub.percentage : (total > 0 ? Math.round((marks / total) * 100) : 0);
    const isTerminated = sub.isTerminated || sub.status === 'terminated';
    const isPass = !isTerminated && (sub.passed || pct >= passing);

    if (statusFilter === 'PASSED' && !isPass) return false;
    if (statusFilter === 'FAILED' && (isPass || isTerminated)) return false;
    if (statusFilter === 'TERMINATED' && !isTerminated) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const name = (sub.studentName || '').toLowerCase();
      const email = (sub.studentEmail || '').toLowerCase();
      const roll = (sub.studentRollNumber || '').toLowerCase();
      if (!name.includes(q) && !email.includes(q) && !roll.includes(q)) {
        return false;
      }
    }
    return true;
  });

  // Calculate statistics for the filtered view
  const totalFiltered = filteredSubmissions.length;
  let passedCount = 0;
  let failedCount = 0;
  let totalScoreSum = 0;

  filteredSubmissions.forEach(sub => {
    const passing = sub.examPassingPercentage || exam?.passingPercentage || 40;
    const total = sub.examTotalMarks || exam?.totalMarks || 10;
    const marks = sub.marksObtained ?? 0;
    const pct = sub.percentage !== undefined ? sub.percentage : (total > 0 ? Math.round((marks / total) * 100) : 0);
    totalScoreSum += marks;

    if (sub.isTerminated || sub.status === 'terminated') {
      failedCount++;
    } else if (sub.passed || pct >= passing) {
      passedCount++;
    } else {
      failedCount++;
    }
  });

  const passRate = totalFiltered > 0 ? Math.round((passedCount / totalFiltered) * 100) : 0;
  const avgMarks = totalFiltered > 0 ? Math.round((totalScoreSum / totalFiltered) * 10) / 10 : 0;

  // Enhanced Export CSV Handler with Student Semester, Subject, and Roll Number
  const handleExportCSV = () => {
    if (!filteredSubmissions || filteredSubmissions.length === 0) {
      return alert('No submission data matching the selected filters to export.');
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Roll Number,Student Name,Email,Department,Course,Semester,Subject,Exam Title,Exam Code,Score,Total Marks,Percentage (%),Result Status,Violations (Tab Switches),Submission Status,Evaluation Date,Feedback\n";

    filteredSubmissions.forEach(sub => {
      const roll = (sub.studentRollNumber || 'N/A').replace(/"/g, '""');
      const name = (sub.studentName || 'N/A').replace(/"/g, '""');
      const email = (sub.studentEmail || 'N/A').replace(/"/g, '""');
      const dept = (sub.studentDepartment || exam.department || 'N/A').replace(/"/g, '""');
      const course = (sub.studentCourse || exam.course || 'N/A').replace(/"/g, '""');
      const sem = (sub.studentSemester || exam.semester || 'N/A').replace(/"/g, '""');
      const subj = (sub.subject || exam.subject || 'N/A').replace(/"/g, '""');
      const title = (sub.examTitle || exam.title || '').replace(/"/g, '""');
      const code = (sub.examCode || exam.examCode || 'N/A').replace(/"/g, '""');

      const marks = sub.marksObtained !== null && sub.marksObtained !== undefined ? sub.marksObtained : 0;
      const total = sub.examTotalMarks || exam.totalMarks || 10;
      const pct = sub.percentage !== undefined ? sub.percentage : (total > 0 ? Math.round((marks / total) * 100) : 0);
      const passing = sub.examPassingPercentage || exam.passingPercentage || 40;
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
    const semTag = selectedSemester !== 'ALL' ? `_${selectedSemester}` : '';
    link.setAttribute("download", `Exam_Results_${(exam.subject || 'Subject').replace(/\s+/g, '_')}${semTag}_${(exam.title || 'Exam').replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintReport = () => {
    window.print();
  };

  if (loading) return <div className="container" style={{ padding: '4rem', textAlign: 'center' }}>Loading candidate submissions...</div>;
  if (error || !exam) return (
    <div className="container" style={{ padding: '4rem', textAlign: 'center' }}>
      <div className="glass-card" style={{ maxWidth: '500px', margin: '0 auto', color: 'var(--rose)' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Unable to Open Portal</h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{error || 'Exam record not found.'}</p>
        <button onClick={() => navigate('/teacher/dashboard')} className="btn btn-primary">
          Return to Teacher Dashboard
        </button>
      </div>
    </div>
  );

  return (
    <div className="container" style={{ padding: '1.5rem 1.5rem', maxWidth: '1360px' }}>
      {/* Top Header */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button onClick={() => navigate('/teacher/dashboard')} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800' }}>Exam Results: {exam.title}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Subject: <strong>{exam.subject}</strong> &bull; Semester: <strong>{exam.semester || 'All Semesters'}</strong> &bull; Course: <strong>{exam.course || 'All Courses'}</strong> &bull; Department: <strong>{exam.department || 'General'}</strong> &bull; Total Marks: <strong>{exam.totalMarks || 10}</strong> &bull; Passing Score: <strong>{exam.passingPercentage || 40}%</strong>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Mode Switcher */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '3px', border: '1px solid var(--border-light)' }}>
            <button
              onClick={() => setViewMode('tabulation')}
              className={`btn ${viewMode === 'tabulation' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}>
              <Table size={15} /> Tabular Gradebook
            </button>
            <button
              onClick={() => setViewMode('evaluation')}
              className={`btn ${viewMode === 'evaluation' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}>
              <FileText size={15} /> Script Grading ({submissions.length})
            </button>
          </div>

          <button onClick={handleExportCSV} className="btn btn-success" style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem' }} title="Export candidate results including Roll No, Semester, and Subject">
            <Download size={16} /> Export CSV Report
          </button>
          <button onClick={handlePrintReport} className="btn btn-secondary" style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}>
            <Printer size={16} /> Print Marksheet
          </button>
        </div>
      </div>

      {/* Printable Institutional Header (Visible only during window.print()) */}
      <div className="print-only" style={{ marginBottom: '1.5rem', textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '0.75rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: '800', textTransform: 'uppercase', color: '#000' }}>
          OFFICIAL EXAMINATION RESULTS TABULATION
        </h2>
        <div style={{ fontSize: '0.9rem', color: '#333', marginTop: '0.2rem' }}>
          Institution Department: <strong>{exam.department || 'General'}</strong> &bull; Subject: <strong>{exam.subject}</strong>
        </div>
        <div style={{ fontSize: '0.85rem', color: '#555', marginTop: '0.2rem' }}>
          Exam Title: {exam.title} &bull; Code: {exam.examCode} &bull; Total Marks: {exam.totalMarks || 10} &bull; Date: {new Date().toLocaleDateString()}
        </div>
      </div>

      {submissions.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem' }}>
          <Users size={48} color="var(--text-subtle)" style={{ marginBottom: '1rem' }} />
          <h3>No Student Submissions Yet</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.4rem' }}>
            No candidates have submitted attempts for this exam yet. Once students take the exam, their scores, roll numbers, answer sheets, and proctoring metrics will appear here immediately.
          </p>
        </div>
      ) : viewMode === 'tabulation' ? (
        /* TABULAR GRADEBOOK VIEW (WITH SEMESTER & SUBJECT FILTERING) */
        <div>
          {/* Summary Metric Cards */}
          <div className="no-print" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '1rem',
            marginBottom: '1.25rem'
          }}>
            <div className="glass-card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Candidates</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-main)', marginTop: '0.2rem' }}>{totalFiltered}</div>
            </div>
            <div className="glass-card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--emerald)', textTransform: 'uppercase', fontWeight: '700' }}>Passed</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--emerald)', marginTop: '0.2rem' }}>{passedCount}</div>
            </div>
            <div className="glass-card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--rose)', textTransform: 'uppercase', fontWeight: '700' }}>Failed / Needs Imprv.</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--rose)', marginTop: '0.2rem' }}>{failedCount}</div>
            </div>
            <div className="glass-card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--sky)', textTransform: 'uppercase', fontWeight: '700' }}>Pass Percentage</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--sky)', marginTop: '0.2rem' }}>{passRate}%</div>
            </div>
            <div className="glass-card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--amber)', textTransform: 'uppercase', fontWeight: '700' }}>Average Score</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--amber)', marginTop: '0.2rem' }}>{avgMarks} <span style={{ fontSize: '0.85rem' }}>/ {exam.totalMarks || 10}</span></div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="glass-card no-print" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                {/* Semester Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Filter size={15} color="var(--primary)" />
                  <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)' }}>Semester:</span>
                  <select
                    value={selectedSemester}
                    onChange={(e) => setSelectedSemester(e.target.value)}
                    className="form-select"
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem', minWidth: '140px' }}
                  >
                    <option value="ALL">All Semesters ({submissions.length})</option>
                    {availableSemesters.map(sem => (
                      <option key={sem} value={sem}>{sem}</option>
                    ))}
                    {availableSemesters.length === 0 && (
                      <>
                        <option value="Semester 1">Semester 1</option>
                        <option value="Semester 2">Semester 2</option>
                        <option value="Semester 3">Semester 3</option>
                        <option value="Semester 4">Semester 4</option>
                        <option value="Semester 5">Semester 5</option>
                        <option value="Semester 6">Semester 6</option>
                        <option value="Semester 7">Semester 7</option>
                        <option value="Semester 8">Semester 8</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Status Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)' }}>Result:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="form-select"
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem', minWidth: '130px' }}
                  >
                    <option value="ALL">All Status</option>
                    <option value="PASSED">Passed Only</option>
                    <option value="FAILED">Needs Improvement</option>
                    <option value="TERMINATED">Disqualified / Cheated</option>
                  </select>
                </div>
              </div>

              {/* Search Box */}
              <div style={{ position: 'relative', minWidth: '240px' }}>
                <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search student, roll number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '2.2rem', paddingRight: '0.75rem', paddingTop: '0.4rem', paddingBottom: '0.4rem', fontSize: '0.82rem' }}
                />
              </div>
            </div>
          </div>

          {/* Tabulation Table */}
          <div className="glass-card" style={{ padding: '0', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border-light)' }}>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Roll No</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Student Name & Email</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Semester</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Subject</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Score / Total</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Percentage</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Result</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Violations</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                  <th className="no-print" style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No student results match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredSubmissions.map((sub, idx) => {
                    const marks = sub.marksObtained ?? 0;
                    const total = sub.examTotalMarks || exam.totalMarks || 10;
                    const pct = sub.percentage !== undefined ? sub.percentage : (total > 0 ? Math.round((marks / total) * 100) : 0);
                    const passing = sub.examPassingPercentage || exam.passingPercentage || 40;
                    const isTerminated = sub.isTerminated || sub.status === 'terminated';
                    const isPassed = !isTerminated && (sub.passed || pct >= passing);

                    return (
                      <tr key={sub._id || sub.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.15s' }}>
                        {/* Roll Number */}
                        <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: '700', color: 'var(--primary)', fontFamily: 'monospace' }}>
                          {sub.studentRollNumber || 'N/A'}
                        </td>

                        {/* Student Details */}
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{sub.studentName}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{sub.studentEmail}</div>
                        </td>

                        {/* Semester */}
                        <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                          <span style={{ background: 'rgba(99, 102, 241, 0.12)', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '600', color: 'var(--primary)' }}>
                            {sub.studentSemester || exam.semester || 'Semester 4'}
                          </span>
                        </td>

                        {/* Subject */}
                        <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: '500' }}>
                          {sub.subject || exam.subject}
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

                        {/* Tab Switches / Violations */}
                        <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem' }}>
                          {sub.tabSwitchCount > 0 ? (
                            <span style={{ color: 'var(--amber)', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                              <AlertTriangle size={13} /> {sub.tabSwitchCount} {sub.tabSwitchCount === 1 ? 'switch' : 'switches'}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>0 (Clean)</span>
                          )}
                        </td>

                        {/* Submission Status */}
                        <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', textTransform: 'capitalize', color: 'var(--text-muted)' }}>
                          {sub.status || 'submitted'}
                        </td>

                        {/* Action Buttons */}
                        <td className="no-print" style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                          <button
                            onClick={() => selectSubmission(sub)}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                            title="Inspect answers and enter grades"
                          >
                            <FileText size={13} /> Grade Script
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ANSWER SCRIPT EVALUATION VIEW (SPLIT 3-COLUMN LAYOUT) */
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 320px', gap: '1.25rem', alignItems: 'start' }}>
          {/* Left Sidebar: Student Submissions List */}
          <div className="glass-card" style={{ padding: '1rem', maxHeight: '750px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                CANDIDATES ({submissions.length})
              </h3>
              <button
                onClick={() => setViewMode('tabulation')}
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}>
                <Table size={12} /> Table View
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {submissions.map((sub) => {
                const subId = sub._id || sub.id;
                const isSelected = selectedSub && (selectedSub._id === subId || selectedSub.id === subId);

                return (
                  <button
                    key={subId}
                    onClick={() => selectSubmission(sub)}
                    style={{
                      textAlign: 'left',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isSelected ? 'var(--primary)' : 'transparent'}`,
                      cursor: 'pointer',
                      color: '#ffffff',
                      transition: 'all 0.2s ease'
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{sub.studentName}</div>
                      {sub.studentRollNumber && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: '700', fontFamily: 'monospace' }}>
                          {sub.studentRollNumber}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sub.studentEmail}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
                      <span className={`badge ${sub.passed ? 'badge-published' : 'badge-draft'}`} style={{ fontSize: '0.65rem' }}>
                        {sub.passed ? 'PASSED' : 'NEEDS IMPROV.'}
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--emerald)' }}>
                        {sub.marksObtained ?? 0} pts ({sub.percentage ?? 0}%)
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Center Column: Interactive Answer Sheet OR Scanned PDF Viewer */}
          <div>
            {selectedSub ? (
              selectedSub.answers && selectedSub.answers.length > 0 ? (
                <div className="glass-card" style={{ padding: '1.5rem', maxHeight: '750px', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Candidate Response Sheet</h3>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Roll No: <strong>{selectedSub.studentRollNumber || 'N/A'}</strong> &bull; Completed in {selectedSub.timeSpentSeconds ? Math.round(selectedSub.timeSpentSeconds / 60) : 0} mins &bull; {selectedSub.correctCount || 0}/{selectedSub.totalQuestions || exam.questions?.length || 0} Correct
                      </span>
                    </div>
                    {selectedSub.tabSwitchCount > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--rose)', fontSize: '0.8rem', background: 'rgba(244, 63, 94, 0.1)', padding: '0.35rem 0.65rem', borderRadius: '6px' }}>
                        <ShieldAlert size={14} /> {selectedSub.tabSwitchCount} Focus Violations
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {selectedSub.answers.map((ans, idx) => (
                      <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <span style={{ fontWeight: '600', fontSize: '0.9rem', whiteSpace: 'pre-wrap', lineHeight: '1.45', flex: 1 }}>
                            Q{ans.questionOrder || idx + 1}: {ans.prompt}
                          </span>
                          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: ans.isCorrect ? 'var(--emerald)' : (ans.isCorrect === false ? 'var(--rose)' : 'var(--amber)'), flexShrink: 0 }}>
                            {ans.marksAwarded} / {ans.maxMarks} pts
                          </span>
                        </div>

                        {ans.selectedOptionText ? (
                          <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: ans.isCorrect ? 'var(--emerald)' : 'var(--rose)' }}>
                            <strong>Candidate Choice:</strong> {ans.selectedOptionText} {ans.isCorrect ? '✓' : '✗'}
                          </div>
                        ) : ans.textAnswer ? (
                          <div style={{ marginTop: '0.6rem' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#38bdf8', marginBottom: '0.2rem' }}>
                              Candidate Submitted Program:
                            </div>
                            <CodeBlock
                              code={ans.textAnswer}
                              title="Candidate Code Submission"
                              maxHeight="300px"
                              fontSize="0.82rem"
                            />
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', fontStyle: 'italic', marginTop: '0.25rem' }}>
                            No answer provided by candidate.
                          </div>
                        )}

                        {ans.correctAnswer && !ans.isCorrect && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                            <strong>Correct Solution:</strong> {ans.correctAnswer}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : selectedSub.scriptUrl ? (
                <div className="glass-card" style={{ padding: '1.25rem', minHeight: '750px' }}>
                  <InlineScriptViewer
                    scriptUrl={`${API_BASE_URL.replace('/api', '')}${selectedSub.scriptUrl}`}
                    fileType={selectedSub.fileType}
                    originalFileName={selectedSub.originalFileName}
                  />
                </div>
              ) : (
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                  <Award size={40} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                  <h3>Manual Evaluation Required</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No digital answer sheet or scanned script was detected for this student. You can assign marks and remarks in the right panel.
                  </p>
                </div>
              )
            ) : (
              <div className="glass-card" style={{ padding: '4rem', textAlign: 'center' }}>
                <Users size={40} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
                <h3>Select a Candidate to Inspect</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Click on any student submission on the left to review their answers, inspect anti-cheating alerts, and enter final marks.
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Faculty Grading & Feedback Controls */}
          <div className="glass-card" style={{ padding: '1.25rem', position: 'sticky', top: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.5rem' }}>Evaluation & Feedback</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Assign final evaluated score and comments. The student will be able to review these on their dashboard.
            </p>

            {selectedSub ? (
              <form onSubmit={handleSaveGrade}>
                <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Student Name</div>
                  <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{selectedSub.studentName}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '600', marginTop: '0.2rem' }}>
                    Roll: {selectedSub.studentRollNumber || 'N/A'} &bull; Sem: {selectedSub.studentSemester || exam.semester || 'N/A'}
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ fontSize: '0.85rem' }}>
                    Marks Awarded (Max: {exam.totalMarks || 10})
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={exam.totalMarks || 100}
                    step="0.5"
                    required
                    value={marksObtained}
                    onChange={(e) => setMarksObtained(e.target.value)}
                    className="form-input"
                    placeholder="Enter final marks..."
                    style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--emerald)' }}
                  />
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label" style={{ fontSize: '0.85rem' }}>Instructor Feedback / Corrections</label>
                  <textarea
                    rows={4}
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    className="form-textarea"
                    placeholder="Write constructive observations or corrections for the student..."
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
                >
                  <Save size={16} /> {saving ? 'Saving...' : 'Save & Publish Grade'}
                </button>
              </form>
            ) : (
              <div style={{ color: 'var(--text-subtle)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                Select a candidate from the left panel to begin evaluation.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
