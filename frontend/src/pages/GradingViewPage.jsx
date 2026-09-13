import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import InlineScriptViewer from '../components/InlineScriptViewer';
import { Users, CheckCircle, Save, Award, ArrowLeft, Download, Printer, ShieldAlert, Check, X, Clock } from 'lucide-react';

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
    setMarksObtained(sub.marksObtained !== null ? sub.marksObtained : '');
    setFeedback(sub.feedback || '');
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

  const handleExportCSV = () => {
    if (!submissions || submissions.length === 0) return alert('No submission data available to export.');

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Student Name,Email,Score,Total Marks,Percentage (%),Violations,Status,Evaluation Date,Feedback\n";

    submissions.forEach(sub => {
      const marks = sub.marksObtained !== null ? sub.marksObtained : 0;
      const total = exam.totalMarks || 10;
      const pct = sub.percentage !== undefined ? sub.percentage : ((marks / total) * 100).toFixed(1);
      const evalDate = sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : 'N/A';
      const cleanFeedback = (sub.feedback || '').replace(/"/g, '""');
      const tabSwitches = sub.tabSwitchCount || 0;

      csvContent += `"${sub.studentName}","${sub.studentEmail}",${marks},${total},${pct}%,${tabSwitches},${sub.status},"${evalDate}","${cleanFeedback}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Exam_Results_${exam.title.replace(/\s+/g, '_')}.csv`);
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
    <div className="container" style={{ padding: '1.5rem 1.5rem', maxWidth: '1280px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button onClick={() => navigate('/teacher/dashboard')} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '800' }}>Exam Results & Submissions: {exam.title}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Subject: {exam.subject} &bull; Total Marks: {exam.totalMarks || 10} &bull; Exam Code: <strong>{exam.examCode || 'N/A'}</strong> &bull; Passing Score: <strong>{exam.passingPercentage || 40}%</strong>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={handleExportCSV} className="btn btn-success" style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}>
            <Download size={16} /> Export CSV Report
          </button>
          <button onClick={handlePrintReport} className="btn btn-secondary" style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem' }}>
            <Printer size={16} /> Print Results
          </button>
        </div>
      </div>

      {submissions.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem' }}>
          <Users size={48} color="var(--text-subtle)" style={{ marginBottom: '1rem' }} />
          <h3>No Student Submissions Yet</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.4rem' }}>
            No candidates have submitted attempts for this exam yet. Once students take the exam, their scores, answer sheets, and proctoring metrics will appear here immediately.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 320px', gap: '1.25rem', alignItems: 'start' }}>
          {/* Left Sidebar: Student Submissions List */}
          <div className="glass-card" style={{ padding: '1rem', maxHeight: '750px', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              STUDENT RESULTS ({submissions.length})
            </h3>

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
                    <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{sub.studentName}</div>
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
                        Completed in {selectedSub.timeSpentSeconds ? Math.round(selectedSub.timeSpentSeconds / 60) : 0} mins &bull; {selectedSub.correctCount || 0}/{selectedSub.totalQuestions || exam.questions?.length || 0} Correct
                      </span>
                    </div>

                    {selectedSub.tabSwitchCount > 0 && (
                      <span style={{ background: 'rgba(244, 63, 94, 0.2)', color: '#f43f5e', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <ShieldAlert size={14} /> {selectedSub.tabSwitchCount} Tab Switches
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {selectedSub.answers.map((ans, idx) => {
                      const isCorrect = ans.isCorrect;
                      return (
                        <div
                          key={idx}
                          style={{
                            background: 'rgba(0,0,0,0.25)',
                            borderRadius: '10px',
                            padding: '1rem',
                            borderLeft: `3px solid ${isCorrect ? 'var(--emerald)' : 'var(--rose)'}`
                          }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                              Q{ans.questionOrder || idx + 1}
                            </span>
                            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: isCorrect ? 'var(--emerald)' : 'var(--rose)' }}>
                              {isCorrect ? `+${ans.marksAwarded} Marks` : '0 Marks'}
                            </span>
                          </div>

                          <div style={{ fontWeight: '600', fontSize: '0.95rem', marginBottom: '0.75rem', color: '#ffffff' }}>
                            {ans.prompt}
                          </div>

                          {ans.codeSnippet && (
                            <div style={{
                              background: '#090d16',
                              border: '1px solid rgba(56, 189, 248, 0.25)',
                              borderRadius: '8px',
                              padding: '0.6rem 0.85rem',
                              marginBottom: '0.75rem',
                              overflowX: 'auto',
                              fontFamily: 'monospace',
                              fontSize: '0.82rem',
                              color: '#38bdf8'
                            }}>
                              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{ans.codeSnippet}</pre>
                            </div>
                          )}

                          <div style={{ fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Student Answer: </span>
                            <strong style={{ color: isCorrect ? 'var(--emerald)' : 'var(--rose)' }}>
                              {ans.selectedOptionText || '(Skipped)'}
                            </strong>
                          </div>

                          {!isCorrect && ans.correctAnswer && (
                            <div style={{ fontSize: '0.85rem', color: 'var(--emerald)' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Correct Answer: </span>
                              <strong>{ans.correctAnswer}</strong>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : selectedSub.scriptUrl ? (
                <InlineScriptViewer
                  scriptUrl={selectedSub.scriptUrl}
                  fileType={selectedSub.fileType}
                  fileName={selectedSub.originalFileName}
                />
              ) : (
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No submission details found for this candidate.
                </div>
              )
            ) : null}
          </div>

          {/* Right Column: Score & Feedback Panel */}
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Award size={18} color="var(--primary)" /> Evaluation & Grade
            </h3>

            {selectedSub ? (
              <form onSubmit={handleSaveGrade}>
                <div className="form-group" style={{ background: 'rgba(0,0,0,0.2)', padding: '0.8rem', borderRadius: '8px', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Student:</div>
                  <div style={{ fontWeight: '700', fontSize: '1rem' }}>{selectedSub.studentName}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>Max Score:</div>
                  <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--primary)' }}>{exam.totalMarks || 10} Points</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Marks Awarded</label>
                  <input
                    type="number"
                    className="form-input"
                    min="0"
                    max={exam.totalMarks || 100}
                    step="0.5"
                    value={marksObtained}
                    onChange={(e) => setMarksObtained(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Teacher Feedback</label>
                  <textarea
                    className="form-textarea"
                    rows="4"
                    placeholder="Enter notes or encouragement..."
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.8rem' }} disabled={saving}>
                  {saving ? 'Updating...' : <><Save size={18} /> Update Marks</>}
                </button>
              </form>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>Select a student from the left list.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
