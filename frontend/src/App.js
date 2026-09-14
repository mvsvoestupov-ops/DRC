import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import Dashboard from './pages/Dashboard';
import StandardsPage from './pages/StandardsPage';
import QualificationsList from './pages/QualificationsList';
import QualificationDetail from './pages/QualificationDetail';
import CreateCompetenceWizard from './pages/CreateCompetenceWizard';
import CompetenceDetail from './pages/CompetenceDetail';
import StrategicSession from './pages/StrategicSession';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import MyProjects from './pages/MyProjects';
import FeedbackButton from './components/FeedbackButton';
import RegistrationsList from './pages/RegistrationsList';

function AppContent() {
  const { isAuthenticated, isAdmin } = useAuth();

  // Неаутентифицированные пользователи — показываем только Login/Register без AppLayout
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={isAdmin ? <Dashboard /> : <Navigate to="/my-projects" />} />
        <Route path="/my-projects" element={<MyProjects />} />
        <Route path="/standards" element={isAdmin ? <StandardsPage /> : <Navigate to="/my-projects" />} />
        <Route path="/qualifications" element={isAdmin ? <QualificationsList /> : <Navigate to="/my-projects" />} />
        <Route path="/qualifications/:id" element={isAdmin ? <QualificationDetail /> : <Navigate to="/my-projects" />} />
        <Route path="/create-competence" element={isAdmin ? <CreateCompetenceWizard /> : <Navigate to="/my-projects" />} />
        <Route path="/competence/:id" element={<CompetenceDetail />} />
        <Route path="/strategic-session" element={<StrategicSession />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<Navigate to="/" />} />
        <Route path="/admin/registrations" element={isAdmin ? <RegistrationsList /> : <Navigate to="/" />} />
        <Route path="*" element={<Navigate to="/my-projects" />} />
      </Routes>
      {isAuthenticated && <FeedbackButton />}
    </AppLayout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
