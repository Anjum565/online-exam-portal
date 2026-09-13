import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { BookOpen, User, LogOut, PlusCircle, Award, CheckSquare, Shield, Menu, X } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    navigate('/login');
  };

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <nav style={{
      background: 'rgba(15, 23, 42, 0.9)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '70px'
      }}>
        {/* Brand Logo */}
        <Link to="/" onClick={closeMenu} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}>
          <div style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            padding: '0.5rem',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <BookOpen size={22} color="#ffffff" />
          </div>
          <span style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.35rem',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #ffffff, #cbd5e1)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            ExamSphere
          </span>
          <span className="badge badge-published mobile-hide" style={{ marginLeft: '0.4rem', fontSize: '0.65rem' }}>
            Portal
          </span>
        </Link>

        {/* Desktop User Navigation Links */}
        <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {user ? (
            <>
              {user.role === 'admin' ? (
                <Link to="/admin/dashboard" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                  <Shield size={16} /> Institutional Admin Portal (Approvals & Exams)
                </Link>
              ) : user.role === 'teacher' ? (
                <>
                  <Link to="/teacher/dashboard" className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                    <CheckSquare size={16} /> Exams
                  </Link>
                  <Link to="/teacher/students" className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                    <User size={16} /> Verify Students
                  </Link>
                  {user.isVerified === false ? (
                    <button
                      className="btn btn-secondary"
                      disabled
                      title="Faculty account pending administrator approval"
                      style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', opacity: 0.55, cursor: 'not-allowed' }}
                    >
                      <PlusCircle size={16} /> Create Exam (Disabled)
                    </button>
                  ) : (
                    <Link to="/teacher/create-exam" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                      <PlusCircle size={16} /> Create Exam
                    </Link>
                  )}
                </>
              ) : (
                <Link to="/student/dashboard" className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                  <Award size={16} /> My Exams & Results
                </Link>
              )}

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '0.4rem 0.8rem',
                borderRadius: '8px',
                border: '1px solid var(--border-light)'
              }}>
                <User size={16} color="var(--primary)" />
                <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{user.name}</span>
                <span style={{
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  color: user.role === 'admin' ? '#f59e0b' : 'var(--text-muted)',
                  fontWeight: user.role === 'admin' ? '700' : '500',
                  marginLeft: '0.2rem'
                }}>
                  ({user.role})
                </span>
                {user.department && (
                  <span style={{
                    fontSize: '0.68rem',
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: '#818cf8',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    maxWidth: '120px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }} title={user.department}>
                    {user.department}
                  </span>
                )}
              </div>

              <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.5rem', borderRadius: '8px' }} title="Logout">
                <LogOut size={16} color="var(--rose)" />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary" style={{ padding: '0.5rem 1.2rem', fontSize: '0.9rem' }}>
                Sign In
              </Link>
              <Link to="/register" className="btn btn-primary" style={{ padding: '0.5rem 1.2rem', fontSize: '0.9rem' }}>
                Register Free
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="mobile-toggle" style={{ display: 'none' }}>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--border-light)',
              color: '#ffffff',
              padding: '0.5rem',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label="Toggle navigation menu">
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer / Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu-drawer" style={{
          background: '#0e1526',
          borderBottom: '1px solid var(--border-light)',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem'
        }}>
          {user ? (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '0.75rem',
                borderBottom: '1px solid var(--border-light)'
              }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{user.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Role: <strong style={{ color: user.role === 'admin' ? '#f59e0b' : 'var(--primary)' }}>{user.role?.toUpperCase()}</strong>
                  </div>
                </div>
                {user.department && (
                  <span style={{
                    fontSize: '0.7rem',
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: '#818cf8',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px'
                  }}>
                    {user.department}
                  </span>
                )}
              </div>

              {user.role === 'admin' ? (
                <Link to="/admin/dashboard" onClick={closeMenu} className="btn btn-primary" style={{ width: '100%', justifyContent: 'flex-start' }}>
                  <Shield size={16} /> Institutional Admin Portal (Approvals & Exams)
                </Link>
              ) : user.role === 'teacher' ? (
                <>
                  <Link to="/teacher/dashboard" onClick={closeMenu} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start' }}>
                    <CheckSquare size={16} /> Manage Exams
                  </Link>
                  <Link to="/teacher/students" onClick={closeMenu} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start' }}>
                    <User size={16} /> Verify Students
                  </Link>
                  {user.isVerified === false ? (
                    <button
                      className="btn btn-secondary"
                      disabled
                      style={{ width: '100%', justifyContent: 'flex-start', opacity: 0.55, cursor: 'not-allowed' }}
                    >
                      <PlusCircle size={16} /> Create Exam (Pending Approval)
                    </button>
                  ) : (
                    <Link to="/teacher/create-exam" onClick={closeMenu} className="btn btn-primary" style={{ width: '100%', justifyContent: 'flex-start' }}>
                      <PlusCircle size={16} /> Create New Exam
                    </Link>
                  )}
                </>
              ) : (
                <Link to="/student/dashboard" onClick={closeMenu} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start' }}>
                  <Award size={16} /> My Exams & Results
                </Link>
              )}

              <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--rose)', borderColor: 'rgba(244, 63, 94, 0.3)' }}>
                <LogOut size={16} /> Sign Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={closeMenu} className="btn btn-secondary" style={{ width: '100%' }}>
                Sign In
              </Link>
              <Link to="/register" onClick={closeMenu} className="btn btn-primary" style={{ width: '100%' }}>
                Register Free
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
