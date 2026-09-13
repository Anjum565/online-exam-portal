import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import {
  Users, CheckCircle, XCircle, ShieldCheck, ShieldAlert, ArrowLeft,
  Search, Check, Trash2, RefreshCw, AlertTriangle, UserCheck, UserX,
  CheckSquare, Square, Filter, Zap
} from 'lucide-react';

export default function StudentVerificationPage() {
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState({ total: 0, verified: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'pending' | 'verified'
  const [selectedIds, setSelectedIds] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { API_BASE_URL } = useContext(AuthContext);

  const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  };

  const fetchStudents = async () => {
    try {
      setError('');
      const res = await axios.get(`${API_BASE_URL}/admin/students`, getAuthHeader());
      setStudents(res.data.students || []);
      setStats(res.data.stats || { total: 0, verified: 0, pending: 0 });
    } catch (err) {
      console.error('Error fetching students:', err);
      setError(err.response?.data?.error || 'Failed to load student roster.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // 1. APPROVE ONE BY ONE
  const handleVerifyOne = async (studentId, studentName) => {
    setActionLoading(studentId);
    try {
      const res = await axios.put(`${API_BASE_URL}/admin/students/${studentId}/verify`, {}, getAuthHeader());
      setSuccessMsg(res.data.message || `${studentName} verified successfully!`);
      setTimeout(() => setSuccessMsg(''), 3500);
      setSelectedIds(prev => prev.filter(id => id !== studentId));
      fetchStudents();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to verify student.');
    } finally {
      setActionLoading(null);
    }
  };

  // REVOKE ONE BY ONE
  const handleRevokeOne = async (studentId, studentName) => {
    if (!window.confirm(`Are you sure you want to revoke exam access for ${studentName}?`)) return;
    setActionLoading(studentId);
    try {
      const res = await axios.put(`${API_BASE_URL}/admin/students/${studentId}/revoke`, {}, getAuthHeader());
      setSuccessMsg(res.data.message || `Revoked verification for ${studentName}`);
      setTimeout(() => setSuccessMsg(''), 3500);
      fetchStudents();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update verification.');
    } finally {
      setActionLoading(null);
    }
  };

  // 2. APPROVE ALL PENDING AT ONCE
  const handleVerifyAllAtOnce = async () => {
    if (!window.confirm(`Are you sure you want to approve ALL ${stats.pending} pending students at once?`)) return;
    setLoading(true);
    try {
      const res = await axios.put(`${API_BASE_URL}/admin/students/verify-all`, {}, getAuthHeader());
      setSuccessMsg(res.data.message || 'All pending students approved at once!');
      setTimeout(() => setSuccessMsg(''), 4000);
      setSelectedIds([]);
      fetchStudents();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to batch verify students.');
      setLoading(false);
    }
  };

  // 3. APPROVE SELECTED BATCH (CHECKBOXES)
  const handleVerifySelected = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Approve ${selectedIds.length} selected students at once?`)) return;
    setLoading(true);
    try {
      const res = await axios.put(`${API_BASE_URL}/admin/students/verify-batch`, { studentIds: selectedIds }, getAuthHeader());
      setSuccessMsg(res.data.message || `${selectedIds.length} students approved!`);
      setTimeout(() => setSuccessMsg(''), 4000);
      setSelectedIds([]);
      fetchStudents();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to approve selected students.');
      setLoading(false);
    }
  };

  const handleDeleteStudent = async (studentId, studentName) => {
    if (!window.confirm(`⚠️ Permanently DELETE student account "${studentName}" and all their examination records? This action cannot be undone.`)) return;
    setActionLoading(studentId);
    try {
      await axios.delete(`${API_BASE_URL}/admin/students/${studentId}`, getAuthHeader());
      setSuccessMsg(`Student "${studentName}" removed permanently.`);
      setTimeout(() => setSuccessMsg(''), 3500);
      setSelectedIds(prev => prev.filter(id => id !== studentId));
      fetchStudents();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete student.');
    } finally {
      setActionLoading(null);
    }
  };

  // 4. BATCH DELETE SELECTED STUDENTS
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`⚠️ Are you sure you want to permanently DELETE all ${selectedIds.length} selected student accounts and their submissions? This action cannot be undone.`)) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/admin/students/delete-batch`, { studentIds: selectedIds }, getAuthHeader());
      setSuccessMsg(res.data.message || `${selectedIds.length} students removed permanently.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      setSelectedIds([]);
      fetchStudents();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete selected students.');
      setLoading(false);
    }
  };

  // Checkbox Selection Logic
  const handleToggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllVisible = () => {
    const visibleIds = displayedStudents.map(s => s._id || s.id);
    const allSelected = visibleIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  // Filter and search
  const displayedStudents = students.filter(st => {
    // Tab filter
    if (filterTab === 'pending' && st.isVerified) return false;
    if (filterTab === 'verified' && !st.isVerified) return false;

    // Search query
    const q = searchQuery.toLowerCase();
    return (
      st.name.toLowerCase().includes(q) ||
      st.email.toLowerCase().includes(q) ||
      (st.rollNumber && st.rollNumber.toLowerCase().includes(q))
    );
  });

  const allVisibleSelected = displayedStudents.length > 0 && displayedStudents.every(s => selectedIds.includes(s._id || s.id));

  return (
    <div className="container" style={{ padding: '2rem 1.5rem', maxWidth: '1180px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <Link to="/teacher/dashboard" className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
          <h1 style={{ fontSize: '2.2rem', fontWeight: '800' }}>Student Verification & Access Control</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Approve students <strong>one by one</strong>, select multiple candidates, or approve the <strong>entire batch at once</strong>.
          </p>
        </div>

        {/* Big Action: Approve All Pending At Once */}
        {stats.pending > 0 && (
          <button
            onClick={handleVerifyAllAtOnce}
            className="btn btn-success fade-in"
            style={{ padding: '0.85rem 1.75rem', fontSize: '1rem', fontWeight: '800', boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)' }}>
            <Zap size={18} /> Approve All Pending at Once ({stats.pending})
          </button>
        )}
      </div>

      {/* Success / Error Notification */}
      {successMsg && (
        <div className="fade-in" style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1.5px solid rgba(16, 185, 129, 0.4)',
          color: '#34d399',
          padding: '0.85rem 1.25rem',
          borderRadius: '12px',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          fontWeight: '700'
        }}>
          <CheckCircle size={20} /> {successMsg}
        </div>
      )}

      {error && (
        <div className="glass-card" style={{ color: 'var(--rose)', textAlign: 'center', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {/* Summary KPI Stats */}
      <div className="grid-3" style={{ marginBottom: '2rem' }}>
        <div
          onClick={() => setFilterTab('all')}
          className="glass-card"
          style={{
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            cursor: 'pointer',
            border: filterTab === 'all' ? '2px solid var(--primary)' : '1px solid var(--border-light)'
          }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.15)', padding: '0.9rem', borderRadius: '12px' }}>
            <Users size={28} color="var(--primary)" />
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: '800' }}>{stats.total}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Students (Click to view all)</div>
          </div>
        </div>

        <div
          onClick={() => setFilterTab('pending')}
          className="glass-card"
          style={{
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            cursor: 'pointer',
            border: filterTab === 'pending' ? '2px solid var(--amber)' : (stats.pending > 0 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-light)'),
            background: stats.pending > 0 ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-card)'
          }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '0.9rem', borderRadius: '12px' }}>
            <ShieldAlert size={28} color="var(--amber)" />
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: '800', color: stats.pending > 0 ? 'var(--amber)' : 'inherit' }}>
              {stats.pending}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Pending Approval (Click to filter)</div>
          </div>
        </div>

        <div
          onClick={() => setFilterTab('verified')}
          className="glass-card"
          style={{
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            cursor: 'pointer',
            border: filterTab === 'verified' ? '2px solid var(--emerald)' : '1px solid var(--border-light)'
          }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '0.9rem', borderRadius: '12px' }}>
            <ShieldCheck size={28} color="var(--emerald)" />
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--emerald)' }}>{stats.verified}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Verified & Active (Click to filter)</div>
          </div>
        </div>
      </div>

      {/* Control Bar: Filter Tabs + Search + Multi-Select Actions */}
      <div className="glass-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.4rem', background: 'rgba(0,0,0,0.3)', padding: '0.3rem', borderRadius: '10px' }}>
            <button
              onClick={() => setFilterTab('all')}
              style={{
                background: filterTab === 'all' ? 'var(--primary)' : 'transparent',
                color: '#ffffff',
                border: 'none',
                padding: '0.4rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}>
              All ({stats.total})
            </button>
            <button
              onClick={() => setFilterTab('pending')}
              style={{
                background: filterTab === 'pending' ? 'var(--amber)' : 'transparent',
                color: filterTab === 'pending' ? '#000000' : 'var(--text-muted)',
                border: 'none',
                padding: '0.4rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}>
              Pending ({stats.pending})
            </button>
            <button
              onClick={() => setFilterTab('verified')}
              style={{
                background: filterTab === 'verified' ? 'var(--emerald)' : 'transparent',
                color: '#ffffff',
                border: 'none',
                padding: '0.4rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}>
              Verified ({stats.verified})
            </button>
          </div>

          {/* Search Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, maxWidth: '380px', background: 'rgba(10, 15, 26, 0.8)', padding: '0.4rem 0.8rem', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              style={{ background: 'transparent', border: 'none', color: '#ffffff', outline: 'none', width: '100%', fontSize: '0.875rem' }}
              placeholder="Search candidate name, email, roll no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Multi-Select Toolbar (Appears if students are shown) */}
        {displayedStudents.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)' }}>
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={handleSelectAllVisible}
                style={{ width: '17px', height: '17px', cursor: 'pointer', accentColor: 'var(--primary)' }}
              />
              <span>Select All on Screen ({displayedStudents.length})</span>
            </label>

            {/* Batch Actions: Approve Selected & Delete Selected */}
            {selectedIds.length > 0 && (
              <div className="fade-in" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <strong>{selectedIds.length}</strong> selected
                </span>
                <button
                  onClick={handleVerifySelected}
                  className="btn btn-success"
                  style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
                  <Check size={15} /> Approve Selected ({selectedIds.length}) at Once
                </button>
                <button
                  onClick={handleDeleteSelected}
                  className="btn btn-secondary"
                  style={{
                    padding: '0.45rem 1rem',
                    fontSize: '0.85rem',
                    color: '#f43f5e',
                    background: 'rgba(244, 63, 94, 0.12)',
                    border: '1px solid rgba(244, 63, 94, 0.4)',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}>
                  <Trash2 size={15} /> Delete Selected ({selectedIds.length})
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="btn btn-secondary"
                  style={{ padding: '0.45rem 0.8rem', fontSize: '0.85rem' }}>
                  Clear
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Student Cards List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <RefreshCw size={32} className="pulse" color="var(--primary)" style={{ marginBottom: '1rem' }} />
          <div>Loading students...</div>
        </div>
      ) : displayedStudents.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <Users size={48} color="var(--text-subtle)" style={{ marginBottom: '1rem' }} />
          <h3>No Students in this View</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.4rem' }}>
            {filterTab === 'pending'
              ? 'Great news! There are no pending student verifications at this moment.'
              : 'No matching student accounts found.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {displayedStudents.map((st) => {
            const stId = st._id || st.id;
            const isVerified = st.isVerified;
            const isActing = actionLoading === stId;
            const isChecked = selectedIds.includes(stId);

            return (
              <div
                key={stId}
                className="glass-card fade-in"
                style={{
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  borderLeft: `4px solid ${isVerified ? 'var(--emerald)' : 'var(--amber)'}`,
                  background: isChecked ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-card)'
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {/* Select Checkbox for batch approval */}
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleSelect(stId)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                    title="Select to approve in batch"
                  />

                  {/* Avatar Letter */}
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: isVerified ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: isVerified ? 'var(--emerald)' : 'var(--amber)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '800',
                    fontSize: '1.1rem'
                  }}>
                    {st.name.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>{st.name}</h3>
                      <span className="badge" style={{
                        background: isVerified ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: isVerified ? '#34d399' : '#fbbf24',
                        fontSize: '0.7rem'
                      }}>
                        {isVerified ? 'VERIFIED' : 'PENDING APPROVAL'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      {st.email}
                      {st.rollNumber && <span> &bull; Roll: <strong>{st.rollNumber}</strong></span>}
                      <span> &bull; Joined: {new Date(st.createdAt).toLocaleDateString()}</span>
                      <span> &bull; Exams Completed: <strong>{st.submissionCount || 0}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Individual One-By-One Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {!isVerified ? (
                    <button
                      onClick={() => handleVerifyOne(stId, st.name)}
                      className="btn btn-success"
                      style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem', fontWeight: '700' }}
                      disabled={isActing}
                      title="Approve this student one by one">
                      <Check size={16} /> Approve This Student
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRevokeOne(stId, st.name)}
                      className="btn btn-secondary"
                      style={{ padding: '0.55rem 1rem', fontSize: '0.85rem', color: 'var(--amber)' }}
                      disabled={isActing}
                      title="Revoke exam permissions for this student">
                      <UserX size={15} /> Revoke Access
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteStudent(stId, st.name)}
                    className="btn btn-secondary"
                    style={{
                      padding: '0.55rem 0.95rem',
                      color: '#f43f5e',
                      background: 'rgba(244, 63, 94, 0.12)',
                      border: '1px solid rgba(244, 63, 94, 0.35)',
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                    title="Permanently remove this student account"
                    disabled={isActing}>
                    <Trash2 size={15} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
