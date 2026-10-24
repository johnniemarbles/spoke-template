import React from 'react';
import { useAuth } from '../auth/AuthProvider.tsx';
import { signOut } from '../platform/index.ts';
import { useNavigate } from 'react-router-dom';

export function MePage() {
  const { me, loading, error } = useAuth();
  const navigate = useNavigate();

  if (loading) return <div style={{ padding: 24 }}>Loading user profile...</div>;
  if (error || !me) return <div style={{ padding: 24 }}>Error: {error?.message ?? 'Not signed in'}</div>;

  const handleSignOut = () => {
    signOut();
    navigate('/sign-in');
  };

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: 24 }}>
      <h2>Current User (Me)</h2>
      <div style={{ background: 'var(--color-surface)', padding: 16, borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}>
        <p><strong>Person ID:</strong> {me.person.id}</p>
        <p><strong>Tenant ID:</strong> {me.tenant.id} ({me.tenant.country} - {me.tenant.region})</p>
        <p><strong>App:</strong> {me.app}</p>
        <p><strong>Hierarchy Scope:</strong> {me.hierarchyScope}</p>
        <div>
          <strong>Permissions ({me.permissions.length}):</strong>
          <ul>
            {me.permissions.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      </div>
      <div style={{ marginTop: 20 }}>
        <button
          onClick={handleSignOut}
          style={{ padding: '8px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
