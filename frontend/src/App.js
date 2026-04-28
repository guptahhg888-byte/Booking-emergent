import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import AuthCallback from './pages/AuthCallback';
import DoctorsPage from './pages/DoctorsPage';
import BookingPage from './pages/BookingPage';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import PaymentStatus from './pages/PaymentStatus';
import PaymentSimulation from './pages/PaymentSimulation';
import './App.css';

function App() {
  // Intercept OAuth callback from Emergent Auth which returns to the origin root
  // with `#session_id=...`. We render the callback page immediately instead of routes.
  if (typeof window !== 'undefined' && window.location.hash?.includes('session_id=')) {
    return (
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-mc-bg">
            <Navbar />
            <AuthCallback />
          </div>
        </BrowserRouter>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-mc-bg">
          <Navbar />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/register" element={<AuthPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/doctors" element={<DoctorsPage />} />
            <Route path="/doctors/:id" element={<BookingPage />} />
            <Route path="/payment/status" element={<PaymentStatus />} />
            <Route path="/payment/simulate/:txnId" element={<PaymentSimulation />} />
            <Route path="/dashboard" element={
              <ProtectedRoute><UserDashboard /></ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>
            } />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
