import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginScreen     from './screens/LoginScreen';
import HomeScreen      from './screens/HomeScreen';
import ExpensesScreen  from './screens/ExpensesScreen';
import AnalyticsScreen from './screens/AnalyticsScreen';
import GroupsScreen    from './screens/GroupsScreen';
import LendScreen      from './screens/LendScreen';
import ScanScreen      from './screens/ScanScreen';
import BudgetScreen    from './screens/BudgetScreen';
import RecurringScreen from './screens/RecurringScreen';
import CSVImportScreen from './screens/CSVImportScreen';
import ProfileScreen   from './screens/ProfileScreen';
import {
  LayoutDashboard, History, BarChart2, Users, HandCoins,
  ScanLine, Target, RefreshCw, User, FileUp, LogOut,
  Smartphone, ChevronDown, Settings,
} from 'lucide-react';

/* ─── Navigation config ──────────────────────────────────────────── */
const NAV = [
  { id: 'home',      label: 'Dashboard',  icon: LayoutDashboard },
  { id: 'history',   label: 'Expenses',   icon: History          },
  { id: 'analytics', label: 'Analytics',  icon: BarChart2        },
  { id: 'groups',    label: 'Groups',     icon: Users            },
  { id: 'lend',      label: 'Lend & Borrow', icon: HandCoins     },
];

const NAV_TOOLS = [
  { id: 'budget',    label: 'Budget',     icon: Target           },
  { id: 'recurring', label: 'Recurring',  icon: RefreshCw        },
  { id: 'csv',       label: 'CSV Import', icon: FileUp           },
  { id: 'scan',      label: 'Scan QR',    icon: ScanLine         },
];

const PAGE_TITLES = {
  home: 'Dashboard', history: 'Expenses', analytics: 'Analytics',
  groups: 'Groups', lend: 'Lend & Borrow', budget: 'Budget',
  recurring: 'Recurring', csv: 'CSV Import', scan: 'Scan QR', profile: 'Profile',
};

function AppContent() {
  const { currentUser, loading, logout } = useAuth();
  const [active, setActive] = useState('home');
  const [screenParam, setScreenParam] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const navigate = (screen, param = null) => {
    setActive(screen);
    setScreenParam(param);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#7C6AFF,#5E4DBE)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, animation: 'pulse 1.5s ease-in-out infinite' }}>💸</div>
        <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Loading Spendify…</p>
      </div>
    );
  }

  if (!currentUser) return <LoginScreen />;

  const renderScreen = () => {
    switch (active) {
      case 'home':      return <HomeScreen onNavigate={navigate} />;
      case 'history':   return <ExpensesScreen onNavigate={navigate} autoOpen={screenParam === 'add'} />;
      case 'analytics': return <AnalyticsScreen />;
      case 'groups':    return <GroupsScreen />;
      case 'lend':      return <LendScreen />;
      case 'budget':    return <BudgetScreen />;
      case 'recurring': return <RecurringScreen />;
      case 'csv':       return <CSVImportScreen onBack={() => navigate('history')} />;
      case 'scan':      return <ScanScreen onBack={() => navigate('home')} />;
      case 'profile':   return <ProfileScreen />;
      default:          return <HomeScreen onNavigate={navigate} />;
    }
  };

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">💸</div>
          <span>Spendify</span>
        </div>

        {/* Main nav */}
        <div className="sidebar-section">
          <div className="sidebar-section-label">Main</div>
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-link ${active === id ? 'active' : ''}`} onClick={() => navigate(id)}>
              <Icon size={17} className="nav-icon" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Tools */}
        <div className="sidebar-section">
          <div className="sidebar-section-label">Tools</div>
          {NAV_TOOLS.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-link ${active === id ? 'active' : ''}`} onClick={() => navigate(id)}>
              <Icon size={17} className="nav-icon" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Download app link */}
        <div style={{ padding: '8px 12px' }}>
          <a href="https://expo.dev/artifacts/eas/spendify-app.apk" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 12px', borderRadius: 'var(--radius-md)',
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)',
              cursor: 'pointer',
            }}>
              <Smartphone size={15} color="var(--green)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)' }}>Get Android App</span>
            </div>
          </a>
        </div>

        {/* User footer */}
        <div className="sidebar-footer">
          <div className="user-card" onClick={() => setUserMenuOpen(v => !v)} style={{ position: 'relative' }}>
            <div className="user-avatar">{currentUser.name[0]?.toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.name}</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.email}</p>
            </div>
            <ChevronDown size={14} color="var(--text-muted)" />
          </div>

          {userMenuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setUserMenuOpen(false)} />
              <div style={{
                position: 'absolute', bottom: 72, left: 12, width: 200,
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', padding: 6, zIndex: 200,
                boxShadow: 'var(--shadow-lg)',
              }}>
                <button onClick={() => { navigate('profile'); setUserMenuOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', borderRadius: 8, border: 'none', background: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                  <User size={14} /> Profile &amp; Settings
                </button>
                <div className="divider" style={{ margin: '4px 0' }} />
                <button onClick={() => { logout(); setUserMenuOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', borderRadius: 8, border: 'none', background: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main-content">
        {/* Top bar */}
        <header className="topbar">
          <h1 className="topbar-title">{PAGE_TITLES[active] || 'Spendify'}</h1>
          <div className="topbar-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('scan')}>
              <ScanLine size={14} /> Scan QR
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('history', 'add')}>
              + Add Expense
            </button>
          </div>
        </header>

        {/* Screen */}
        <div key={active} className="fade-in" style={{ padding: '32px', flex: 1 }}>
          {renderScreen()}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return <AuthProvider><AppContent /></AuthProvider>;
}
