import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import {
  UserPlus, BookOpen, User, Mail, Lock, AlertCircle,
  Building, GraduationCap, Calendar, Hash, ArrowRight, Shield
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

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Academic Affiliation Fields (Strictly for Student)
  const [department, setDepartment] = useState('Computer Science & Engineering');
  const [customDepartment, setCustomDepartment] = useState('');
  const [course, setCourse] = useState('B.Tech');
  const [customCourse, setCustomCourse] = useState('');
  const [semester, setSemester] = useState('Semester 1');
  const [rollNumber, setRollNumber] = useState('');

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

    if (!rollNumber.trim()) {
      setError('Please enter your University Roll Number / Student ID.');
      return;
    }

    setLoading(true);

    try {
      // Role is strictly hardcoded to student - no teacher or admin privilege can be selected
      const payload = {
        name: name.trim(),
        email: email.trim(),
        password,
        role: 'student',
        department: finalDept,
        course: finalCourse,
        semester,
        rollNumber: rollNumber.trim()
      };

      const res = await axios.post(`${API_BASE_URL}/auth/register`, payload);
      login(res.data.token, res.data.user);
      navigate('/student/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
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
      <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '580px', padding: '2rem 1.75rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            display: 'inline-flex',
            background: 'linear-gradient(135deg, var(--emerald), var(--primary))',
            padding: '0.8rem',
            borderRadius: '16px',
            marginBottom: '0.75rem',
            boxShadow: '0 8px 25px rgba(16, 185, 129, 0.3)'
          }}>
            <BookOpen size={30} color="#ffffff" />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '800' }}>Student Registration</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.25rem' }}>
            Create your candidate account to take departmental examinations
          </p>
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
          {/* Basic User Info */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Student Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={18} color="var(--text-subtle)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="Ada Lovelace"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} color="var(--text-subtle)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email"
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="student@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
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

          {/* Academic Department Details */}
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
              <Building size={16} /> Academic Department & Enrollment Details
            </h4>

            {/* Department Selection */}
            <div className="form-group">
              <label className="form-label">Department / Faculty</label>
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
            </div>

            {department === 'Other' && (
              <div className="form-group">
                <label className="form-label">Specify Your Department Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Department of Aerospace Engineering"
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
                  <GraduationCap size={15} color="var(--text-subtle)" /> Course / Degree
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
                  <Calendar size={15} color="var(--text-subtle)" /> Current Semester
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
              <div className="form-group">
                <label className="form-label">Specify Your Course Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. B.Tech Robotics & Automation"
                  value={customCourse}
                  onChange={(e) => setCustomCourse(e.target.value)}
                  required
                />
              </div>
            )}

            {/* Student Roll Number */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Hash size={15} color="var(--text-subtle)" /> Roll Number / Student ID
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. CS-2024-042"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                required
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.3rem' }}>
                Used by instructors to verify and grade your examination submissions.
              </span>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', marginBottom: '1.25rem' }}
            disabled={loading}
          >
            {loading ? 'Creating Student Account...' : (
              <>
                <UserPlus size={18} /> Register Student Account
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ fontWeight: '600', color: 'var(--primary)' }}>
            Sign In here
          </Link>
        </div>

        {/* Discrete Faculty Portal Registration Link */}
        <div style={{
          marginTop: '1.5rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--border-light)',
          textAlign: 'center',
          fontSize: '0.8rem',
          color: 'var(--text-subtle)'
        }}>
          Are you a University Faculty Member / Instructor?{' '}
          <Link to="/register/faculty" style={{ color: '#c084fc', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
            Faculty Registration <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}
