import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import {
  ShieldCheck, User, Mail, Lock, AlertCircle, Building,
  GraduationCap, Calendar, KeyRound, ArrowLeft
} from 'lucide-react';

const DEPARTMENTS = [
  'Computer Science & Engineering',
  'Information Technology',
  'Electronics & Communication Engineering',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Business Administration (Management)',
  'Commerce & Finance',
  'Science & Mathematics',
  'Arts & Humanities',
  'Medical & Health Sciences',
  'Law & Legal Studies',
  'Other'
];

const COURSES = [
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
  'Other'
];

const SEMESTERS = [
  'Semester 1',
  'Semester 2',
  'Semester 3',
  'Semester 4',
  'Semester 5',
  'Semester 6',
  'Semester 7',
  'Semester 8',
  'Year 1 (Annual)',
  'Year 2 (Annual)',
  'Year 3 (Annual)'
];

export default function FacultyRegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Department & Course
  const [department, setDepartment] = useState('Computer Science & Engineering');
  const [customDepartment, setCustomDepartment] = useState('');
  const [course, setCourse] = useState('B.Tech');
  const [customCourse, setCustomCourse] = useState('');
  const [semester, setSemester] = useState('Semester 1');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, API_BASE_URL } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const finalDept = department === 'Other' ? customDepartment.trim() : department;
    const finalCourse = course === 'Other' ? customCourse.trim() : course;

    if (!finalDept) {
      setError('Please select or specify your department.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        password,
        role: 'teacher',
        department: finalDept,
        course: finalCourse,
        semester
      };

      const res = await axios.post(`${API_BASE_URL}/auth/register`, payload);
      login(res.data.token, res.data.user);
      navigate('/teacher/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Faculty registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 'calc(100vh - 120px)',
      padding: '2rem 1rem'
    }}>
      <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '620px', padding: '2rem 1.75rem', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            display: 'inline-flex',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            padding: '0.8rem',
            borderRadius: '16px',
            marginBottom: '0.75rem',
            boxShadow: '0 8px 25px rgba(139, 92, 246, 0.35)'
          }}>
            <ShieldCheck size={32} color="#ffffff" />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '800' }}>Faculty Teacher Registration</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.25rem' }}>
            Set up an instructor account to manage examinations for your department
          </p>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            marginTop: '0.6rem',
            fontSize: '0.78rem',
            background: 'rgba(99, 102, 241, 0.12)',
            color: '#818cf8',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            padding: '0.3rem 0.75rem',
            borderRadius: '9999px'
          }}>
            🛡️ Requires Administrator Approval After Registration
          </div>
        </div>

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
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>

          {/* Teacher Profile Info */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Full Name & Title</label>
              <div style={{ position: 'relative' }}>
                <User size={18} color="var(--text-subtle)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="Prof. Alan Turing"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Official Faculty Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} color="var(--text-subtle)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email"
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="faculty@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Account Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="var(--text-subtle)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="password"
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="Create a strong password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          </div>

          {/* Department and Course Configuration */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-light)',
            borderRadius: '12px',
            padding: '1.25rem',
            marginBottom: '1.5rem'
          }}>
            <h4 style={{
              fontSize: '0.9rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--primary)',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}>
              <Building size={16} /> Departmental Teaching Assignment
            </h4>

            {/* Department */}
            <div className="form-group">
              <label className="form-label">Assigned Department</label>
              <select
                className="form-select"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                required
              >
                {DEPARTMENTS.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.3rem' }}>
                Note: You will only be permitted to view and create examinations for this department.
              </span>
            </div>

            {department === 'Other' && (
              <div className="form-group">
                <label className="form-label">Specify Department Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Department of Biotechnology"
                  value={customDepartment}
                  onChange={(e) => setCustomDepartment(e.target.value)}
                  required
                />
              </div>
            )}

            {/* Course & Semester Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <GraduationCap size={15} color="var(--text-subtle)" /> Primary Degree / Course
                </label>
                <select
                  className="form-select"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  required
                >
                  {COURSES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Calendar size={15} color="var(--text-subtle)" /> Semester
                </label>
                <select
                  className="form-select"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  required
                >
                  {SEMESTERS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {course === 'Other' && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Specify Course Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. B.Tech Biomedical"
                  value={customCourse}
                  onChange={(e) => setCustomCourse(e.target.value)}
                  required
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', marginBottom: '1.25rem' }}
            disabled={loading}
          >
            {loading ? 'Creating Faculty Account...' : (
              <>
                <ShieldCheck size={18} /> Register Faculty Teacher Account
              </>
            )}
          </button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <Link to="/register" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-muted)' }}>
            <ArrowLeft size={14} /> Student Registration
          </Link>
          <Link to="/login" style={{ fontWeight: '600', color: 'var(--primary)' }}>
            Sign In here
          </Link>
        </div>
      </div>
    </div>
  );
}
