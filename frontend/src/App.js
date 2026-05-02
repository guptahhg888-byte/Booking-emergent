import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import AuthCallback from './pages/AuthCallback';
import DoctorsPage from './pages/DoctorsPage';
import './App.css';

// Heavier routes are code-split to keep the initial bundle small.
const BookingPage = lazy(() => import('./pages/BookingPage'));
const UserDashboard = lazy(() => import('./pages/UserDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const PaymentStatus = lazy(() => import('./pages/PaymentStatus'));
const PaymentSimulation = lazy(() => import('./pages/PaymentSimulation'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

const RouteFallback = () => (
  <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-mc-bg" data-testid="route-loader">
    <div className="w-10 h-10 border-4 border-mc-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

function App() {


  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-mc-bg">
          <Navbar />
          <Suspense fallback={<RouteFallback />}>
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
              <Route path="/profile" element={
                <ProtectedRoute><ProfilePage /></ProtectedRoute>
              } />
              <Route path="/admin" element={
                <ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>
              } />
            </Routes>
          </Suspense>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
