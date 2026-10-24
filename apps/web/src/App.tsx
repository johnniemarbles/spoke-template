import React from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider.tsx';
import { SignIn } from './pages/SignIn.tsx';
import { MePage } from './pages/Me.tsx';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!me) return <Navigate to="/sign-in" replace />;
  return <>{children}</>;
}

function Home() {
  const { me } = useAuth();
  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: 24 }}>
      <h1>Welcome to the Platform App</h1>
      <p>This is the application home placeholder.</p>
      <nav style={{ display: 'flex', gap: 16 }}>
        <Link to="/me">View Profile (/me)</Link>
        {!me && <Link to="/sign-in">Sign In</Link>}
      </nav>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/sign-in" element={<SignIn />} />
      <Route
        path="/me"
        element={
          <ProtectedRoute>
            <MePage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
