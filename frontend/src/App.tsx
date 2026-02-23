// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import BuyerDashboard  from './pages/dashboards/BuyerDashboard';
import SellerDashboard from './pages/dashboards/SellerDashboard';
import AdminDashboard  from './pages/dashboards/AdminDashboard';

function ProtectedRoute({
  children,
  allowedRole,
}: {
  children: React.ReactElement;
  allowedRole?: 'buyer' | 'seller' | 'admin';
}) {
  const token   = localStorage.getItem('token');
  const userRaw = localStorage.getItem('user');

  if (!token || !userRaw) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole) {
    const stored = JSON.parse(userRaw);
    const role: string = stored.role === 'user' ? 'buyer' : (stored.role ?? 'buyer');

    if (role !== allowedRole) {
      if (role === 'admin')  return <Navigate to="/dashboard/admin"  replace />;
      if (role === 'seller') return <Navigate to="/dashboard/seller" replace />;
      return <Navigate to="/dashboard/buyer" replace />;
    }
  }

  return children;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/"         element={<Home />} />
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/dashboard/buyer"
          element={
            <ProtectedRoute allowedRole="buyer">
              <BuyerDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/seller"
          element={
            <ProtectedRoute allowedRole="seller">
              <SellerDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/admin"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;