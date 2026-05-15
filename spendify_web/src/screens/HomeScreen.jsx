import React from 'react';
import { useExpenses, useBudgets, useProfile, useLends } from '../hooks/useExpenses';
import { Wallet, TrendingUp, Calendar, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

export default function HomeScreen() {
  const { monthTotal, expenses } = useExpenses();
  const { budgets } = useBudgets();
  const { profile } = useProfile();
  const { contactSummaries } = useLends();

  const totalBudget = budgets['total'] || Object.entries(budgets).reduce((sum, [k, v]) => k === 'total' ? sum : sum + Number(v), 0);
  const budgetProgress = totalBudget > 0 ? Math.min(monthTotal / totalBudget, 1) : 0;
  const isOverBudget = monthTotal > totalBudget && totalBudget > 0;

  const totalLent = Object.values(contactSummaries).reduce((s, c) => s + c.lent, 0);
  const totalBorrowed = Object.values(contactSummaries).reduce((s, c) => s + c.borrowed, 0);

  return (
    <div className="fade-in">
      {/* Header */}
      <header className="flex-row justify-between" style={{ marginBottom: '24px' }}>
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Hello</p>
          <h1 className="text-gradient">{profile.name}</h1>
        </div>
        <div 
          style={{ 
            width: '48px', height: '48px', borderRadius: '50%', 
            background: 'var(--accent)', display: 'flex', alignItems: 'center', 
            justifyContent: 'center', fontWeight: '800', fontSize: '18px' 
          }}
        >
          {profile.name[0].toUpperCase()}
        </div>
      </header>

      {/* Main Budget Card */}
      <div 
        className="card" 
        style={{ 
          background: 'linear-gradient(135deg, #7C6AFF 0%, #5E4DBE 100%)', 
          border: 'none', 
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 10px 40px rgba(124, 106, 255, 0.3)'
        }}
      >
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Monthly Spendings</p>
        <h2 style={{ fontSize: '36px', fontWeight: '800', margin: '4px 0 16px 0' }}>{formatCurrency(monthTotal)}</h2>
        
        {totalBudget > 0 && (
          <div>
            <div style={{ height: '6px', background: 'rgba(0,0,0,0.2)', borderRadius: '3px', overflow: 'hidden', marginBottom: '12px' }}>
              <div 
                style={{ 
                  height: '100%', 
                  background: isOverBudget ? '#FF4B4B' : '#FFFFFF', 
                  width: `${budgetProgress * 100}%`,
                  transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
                }} 
              />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', fontWeight: '600' }}>
              {isOverBudget ? '⚠️ Over budget!' : `${Math.round(budgetProgress * 100)}% of ${formatCurrency(totalBudget)} used`}
            </p>
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="flex-row gap-md" style={{ marginBottom: '24px' }}>
        <StatItem label="Lent" amount={totalLent} color="var(--green)" icon={<ArrowUpRight size={14} />} />
        <StatItem label="Borrowed" amount={totalBorrowed} color="var(--red)" icon={<ArrowDownLeft size={14} />} />
      </div>

      {/* Recent Activity */}
      <section>
        <h3 style={{ marginBottom: '16px' }}>Recent Activity</h3>
        <div className="flex-col gap-sm">
          {expenses.slice(0, 5).map(exp => (
            <div key={exp.id} className="card flex-row justify-between" style={{ padding: '16px' }}>
              <div className="flex-row gap-md">
                <div 
                  style={{ 
                    width: '40px', height: '40px', borderRadius: '12px', 
                    background: 'var(--elevated)', display: 'flex', alignItems: 'center', 
                    justifyContent: 'center', fontSize: '18px' 
                  }}
                >
                  {getEmoji(exp.category)}
                </div>
                <div>
                  <p style={{ fontWeight: '600' }}>{exp.note || exp.payeeName || 'Expense'}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{new Date(exp.date).toLocaleDateString()}</p>
                </div>
              </div>
              <p style={{ fontWeight: '800', color: 'var(--text-primary)' }}>-{formatCurrency(exp.amount)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatItem({ label, amount, color, icon }) {
  return (
    <div className="card" style={{ flex: 1, padding: '16px' }}>
      <div className="flex-row gap-sm" style={{ marginBottom: '8px' }}>
        <div style={{ color }}>{icon}</div>
        <p style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>{label}</p>
      </div>
      <p style={{ fontSize: '18px', fontWeight: '800', color }}>{formatCurrency(amount)}</p>
    </div>
  );
}

function getEmoji(cat) {
  const map = { food: '🍔', transport: '🚗', shopping: '🛍️', bills: '💸', entertainment: '🎬', health: '💊', other: '📦' };
  return map[cat] || '📦';
}
