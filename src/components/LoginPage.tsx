import { useState } from 'react';
import { Lock, User, AlertCircle, Factory } from 'lucide-react';

interface LoginPageProps {
  onLogin: (username: string, password: string) => boolean;
}

const USERNAMES = [
  'Table 1', 'Table 2', 'Table 3', 'Table 4',
  'Management', 'Admin', 'All Table', 'Mom', 'Table 2&3'
];

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('Please select a username and enter your password');
      return;
    }
    setLoading(true);
    await new Promise(r => setTimeout(r, 300));
    const success = onLogin(username, password);
    setLoading(false);
    if (!success) {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 60%, #1e40af 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }}>
      <div style={{ position: 'fixed', inset: 0, opacity: 0.04,
        backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
        backgroundSize: '32px 32px' }} />

      <div style={{ width: '100%', maxWidth: '420px', background: 'white',
        borderRadius: '20px', boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
        overflow: 'hidden', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          padding: '36px 32px', textAlign: 'center' }}>
          <div style={{ width: '72px', height: '72px', background: 'white',
            borderRadius: '18px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 14px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.15)' }}>
            <Factory size={40} color="#d97706" />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'white', margin: '0 0 4px' }}>
            PCTracker
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.88)', fontSize: '13px', margin: 0 }}>
            Printing Table Production System
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '28px 32px 32px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '20px' }}>
            Sign In
          </h2>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: '10px', padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: '8px',
              marginBottom: '16px', color: '#dc2626' }}>
              <AlertCircle size={16} />
              <span style={{ fontSize: '13px' }}>{error}</span>
            </div>
          )}

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600,
              color: '#374151', marginBottom: '6px' }}>Username</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '13px', top: '50%',
                transform: 'translateY(-50%)', color: '#9ca3af', zIndex: 1 }} />
              <select value={username} onChange={e => setUsername(e.target.value)}
                style={{ width: '100%', paddingLeft: '40px', paddingRight: '12px',
                  paddingTop: '13px', paddingBottom: '13px',
                  border: '2px solid #e5e7eb', borderRadius: '10px',
                  fontSize: '14px', color: username ? '#111827' : '#9ca3af',
                  background: 'white', appearance: 'none', cursor: 'pointer',
                  outline: 'none', fontFamily: 'inherit' }}
                onFocus={e => e.target.style.borderColor = '#f59e0b'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'} required>
                <option value="">-- Select username --</option>
                {USERNAMES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600,
              color: '#374151', marginBottom: '6px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '13px', top: '50%',
                transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={{ width: '100%', paddingLeft: '40px', paddingRight: '12px',
                  paddingTop: '13px', paddingBottom: '13px',
                  border: '2px solid #e5e7eb', borderRadius: '10px',
                  fontSize: '14px', color: '#111827', outline: 'none', fontFamily: 'inherit' }}
                onFocus={e => e.target.style.borderColor = '#f59e0b'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'} required />
            </div>
          </div>

          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '14px',
              background: loading ? '#fbbf24' : 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: 'white', border: 'none', borderRadius: '10px',
              fontSize: '15px', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(245,158,11,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              fontFamily: 'inherit' }}>
            {loading ? (
              <><span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)',
                borderTopColor: 'white', borderRadius: '50%', display: 'inline-block',
                animation: 'spin 0.7s linear infinite' }} />Signing in...</>
            ) : 'Sign In →'}
          </button>

          <p style={{ textAlign: 'center', marginTop: '14px', fontSize: '12px', color: '#9ca3af' }}>
            Contact Admin if you forgot your password
          </p>
        </form>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
