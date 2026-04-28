import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mc-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-mc-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-mc-text-secondary font-body text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
};

export default ProtectedRoute;
