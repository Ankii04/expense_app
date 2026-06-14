import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../hooks/useExpenses';
import { User, Mail, Save, LogOut, Smartphone, Globe, Shield, ChevronRight } from 'lucide-react';

export default function ProfileScreen() {
  const { currentUser, logout } = useAuth();
  const { profile, saveProfile }   = useProfile();
  const [name, setName] = useState(currentUser?.name || profile.name || '');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    saveProfile({ ...profile, name });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: '24px' }}>Profile</h1>

      {/* Avatar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #7C6AFF, #5E4DBE)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '32px', fontWeight: '800', color: 'white',
          boxShadow: '0 8px 32px rgba(124,106,255,0.4)', marginBottom: '16px',
        }}>
          {name[0]?.toUpperCase() || '?'}
        </div>
        <p style={{ fontWeight: '700', fontSize: '18px' }}>{name || 'User'}</p>
        {currentUser?.email && (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>{currentUser.email}</p>
        )}
      </div>

      {/* Edit name */}
      <div className="card" style={{ padding: '20px', marginBottom: '16px' }}>
        <label style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
          Display Name
        </label>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input className="input" value={name} onChange={e => setName(e.target.value)}
            placeholder="Your name" style={{ flex: 1 }} />
          <button onClick={handleSave}
            style={{
              padding: '0 16px', borderRadius: '12px', border: 'none', cursor: 'pointer',
              background: saved ? 'var(--green)' : 'var(--accent)', color: 'white',
              fontWeight: '700', fontSize: '13px', transition: 'background 0.3s',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
            {saved ? '✓ Saved' : <><Save size={14} /> Save</>}
          </button>
        </div>
      </div>

      {/* Info rows */}
      <div className="card" style={{ padding: '8px', marginBottom: '16px' }}>
        <InfoRow icon={<Mail size={16} />} label="Email" value={currentUser?.email || 'Not set'} />
        <div style={{ height: '1px', background: 'var(--border)', margin: '0 16px' }} />
        <InfoRow icon={<Shield size={16} />} label="Data storage" value="Local (your device only)" />
      </div>

      {/* App links */}
      <div className="card" style={{ padding: '8px', marginBottom: '24px' }}>
        <a href="https://expo.dev/artifacts/eas/spendify-app.apk" target="_blank" rel="noopener noreferrer"
          style={{ textDecoration: 'none', color: 'inherit' }}>
          <InfoRow icon={<Smartphone size={16} />} label="Get Android App" value="Download APK" chevron />
        </a>
        <div style={{ height: '1px', background: 'var(--border)', margin: '0 16px' }} />
        <InfoRow icon={<Globe size={16} />} label="Version" value="Web v2.0" />
      </div>

      {/* Sign out */}
      <button
        onClick={logout}
        style={{
          width: '100%', padding: '16px', borderRadius: '14px', border: 'none', cursor: 'pointer',
          background: 'rgba(255,75,75,0.12)', border: '1px solid rgba(255,75,75,0.25)',
          color: 'var(--red)', fontWeight: '700', fontSize: '15px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
        }}>
        <LogOut size={18} /> Sign Out
      </button>
    </div>
  );
}

function InfoRow({ icon, label, value, chevron }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px' }}>
      <div style={{ color: 'var(--accent)', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>{label}</p>
        <p style={{ fontSize: '14px', fontWeight: '600', marginTop: '2px' }}>{value}</p>
      </div>
      {chevron && <ChevronRight size={16} color="var(--text-muted)" />}
    </div>
  );
}
