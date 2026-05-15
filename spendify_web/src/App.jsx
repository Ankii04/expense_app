import React, { useState } from 'react';
import { 
  Home, 
  History, 
  PieChart as PieIcon, 
  Users, 
  HandCoins, 
  Plus, 
  Scan, 
  User as UserIcon,
  Search
} from 'lucide-react';
import HomeScreen from './screens/HomeScreen';
import ExpensesScreen from './screens/ExpensesScreen';
import AnalyticsScreen from './screens/AnalyticsScreen';
import GroupsScreen from './screens/GroupsScreen';
import LendScreen from './screens/LendScreen';
import ScanScreen from './screens/ScanScreen';

function App() {
  const [activeTab, setActiveTab] = useState('home');

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':      return <HomeScreen />;
      case 'history':   return <ExpensesScreen />;
      case 'analytics': return <AnalyticsScreen />;
      case 'groups':    return <GroupsScreen />;
      case 'lend':      return <LendScreen />;
      case 'scan':      return <ScanScreen onBack={() => setActiveTab('home')} />;
      default:          return <HomeScreen />;
    }
  };

  return (
    <div className="flex-col min-h-screen">
      <main className="container flex-1">
        {renderScreen()}
      </main>

      {/* Quick Action Button */}
      {activeTab !== 'scan' && (
        <button 
          className="btn btn-primary" 
          style={{ 
            position: 'fixed', 
            bottom: '90px', 
            right: '20px', 
            borderRadius: '50%', 
            width: '56px', 
            height: '56px', 
            padding: 0,
            boxShadow: '0 8px 30px rgba(124, 106, 255, 0.4)',
            zIndex: 900
          }}
          onClick={() => setActiveTab('scan')}
        >
          <Scan size={24} />
        </button>
      )}

      {/* Navigation Bar */}
      <nav className="nav-bar">
        <NavItem 
          active={activeTab === 'home'} 
          icon={<Home size={22} />} 
          label="Home" 
          onClick={() => setActiveTab('home')} 
        />
        <NavItem 
          active={activeTab === 'history'} 
          icon={<History size={22} />} 
          label="History" 
          onClick={() => setActiveTab('history')} 
        />
        <NavItem 
          active={activeTab === 'analytics'} 
          icon={<PieIcon size={22} />} 
          label="Stats" 
          onClick={() => setActiveTab('analytics')} 
        />
        <NavItem 
          active={activeTab === 'groups'} 
          icon={<Users size={22} />} 
          label="Groups" 
          onClick={() => setActiveTab('groups')} 
        />
        <NavItem 
          active={activeTab === 'lend'} 
          icon={<HandCoins size={22} />} 
          label="Lend" 
          onClick={() => setActiveTab('lend')} 
        />
      </nav>
    </div>
  );
}

function NavItem({ active, icon, label, onClick }) {
  return (
    <div className={`nav-item ${active ? 'active' : ''}`} onClick={onClick} style={{ cursor: 'pointer' }}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

export default App;
