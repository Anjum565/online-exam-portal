import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import ColdStartBanner from './components/ColdStartBanner';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import FacultyRegisterPage from './pages/FacultyRegisterPage';
import AdminRegisterPage from './pages/AdminRegisterPage';
import TeacherDashboard from './pages/TeacherDashboard';
import CreateExamPage from './pages/CreateExamPage';
import ReviewQuestionsPage from './pages/ReviewQuestionsPage';
import StudentDashboard from './pages/StudentDashboard';
import ExamSessionPage from './pages/ExamSessionPage';
import GradingViewPage from './pages/GradingViewPage';
import StudentVerificationPage from './pages/StudentVerificationPage';
import AdminOverviewPage from './pages/AdminOverviewPage';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>Loading session...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (user.role === 'teacher') return <Navigate to="/teacher/dashboard" replace />;
    return <Navigate to="/student/dashboard" replace />;
  }
  return children;
};

const RootRedirect = () => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (user.role === 'teacher') return <Navigate to="/teacher/dashboard" replace />;
  return <Navigate to="/student/dashboard" replace />;
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <ColdStartBanner />
          <Navbar />
          <main style={{ flex: 1 }}>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/register/faculty" element={<FacultyRegisterPage />} />
              <Route path="/register/admin" element={<AdminRegisterPage />} />

              {/* Admin Protected Routes */}
              <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><AdminOverviewPage /></ProtectedRoute>} />

              {/* Teacher Protected Routes */}
              <Route path="/teacher/dashboard" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherDashboard /></ProtectedRoute>} />
              <Route path="/teacher/students" element={<ProtectedRoute allowedRoles={['teacher']}><StudentVerificationPage /></ProtectedRoute>} />
              <Route path="/teacher/create-exam" element={<ProtectedRoute allowedRoles={['teacher']}><CreateExamPage /></ProtectedRoute>} />
              <Route path="/teacher/review-questions/:examId" element={<ProtectedRoute allowedRoles={['teacher', 'admin']}><ReviewQuestionsPage /></ProtectedRoute>} />
              <Route path="/teacher/grading/:examId" element={<ProtectedRoute allowedRoles={['teacher', 'admin']}><GradingViewPage /></ProtectedRoute>} />

              {/* Student Protected Routes */}
              <Route path="/student/dashboard" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
              <Route path="/student/exam/:examId" element={<ProtectedRoute allowedRoles={['student']}><ExamSessionPage /></ProtectedRoute>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}
