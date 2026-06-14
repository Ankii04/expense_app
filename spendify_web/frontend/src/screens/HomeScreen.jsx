import React, { useState } from 'react';
import { useExpenses, useBudgets, useProfile, useLends } from '../hooks/useExpenses';
import { useAuth } from '../context/AuthContext';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, Wallet, Smartphone, ExternalLink, Clock, CreditCard } from 'lucide-react';

const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v ?? 0);
const EMOJI = { food:'🍔', transport:'🚗', shopping:'🛍️', bills:'💸', entertainment:'🎬', health:'💊', other:'📦' };
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function HomeScreen({ onNavigate }) {
  const { expenses, monthTotal } = useExpenses();
  const { budgets }              = useBudgets();
  const { currentUser }          = useAuth();
  const { contactSummaries }     = useLends();

  const totalBudget  = Object.values(budgets).reduce((s, v) => s + Number(v), 0);
  const budgetPct    = totalBudget > 0 ? Math.min(monthTotal / totalBudget, 1) : 0;
  const isOver       = monthTotal > totalBudget && totalBudget > 0;
  const totalLent    = Object.values(contactSummaries).reduce((s, c) => s + c.lent, 0);
  const totalBorrowed= Object.values(contactSummaries).reduce((s, c) => s + c.borrowed, 0);

  // Category breakdown
  const catBreakdown = expenses.reduce((acc, e) => {
    acc[e.category || 'other'] = (acc[e.category || 'other'] || 0) + e.amount;
    return acc;
  }, {});
  const topCats = Object.entries(catBreakdown).sort((a,b) => b[1]-a[1]).slice(0, 5);
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);

  // Monthly chart data (last 6 months)
  const now = new Date();
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const total = expenses.filter(e => {
      const ed = new Date(e.date);
      return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear();
    }).reduce((s, e) => s + e.amount, 0);
    return { month: MONTHS[d.getMonth()], total };
  });
  const maxMonth = Math.max(...monthlyData.map(m => m.total), 1);

  const lastMonth  = monthlyData[monthlyData.length - 2]?.total || 0;
  const trend      = lastMonth > 0 ? ((monthTotal - lastMonth) / lastMonth * 100).toFixed(1) : 0;

  return (
    <div>
      {/* Welcome */}
      <div className="mb-6">
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
          Good {greeting()}, {currentUser?.name?.split(' ')[0]} 👋
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Here's your financial overview for {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Top stat cards */}
      <div className="grid-4 mb-6">
        <StatCard
          label="Monthly Spending"
          value={fmt(monthTotal)}
          sub={totalBudget > 0 ? `${Math.round(budgetPct * 100)}% of ${fmt(totalBudget)} budget` : 'No budget set'}
          icon={<Wallet size={18} />}
          color="#7C6AFF"
          accent={isOver ? 'var(--red)' : undefined}
        />
        <StatCard
          label="Total Lent"
          value={fmt(totalLent)}
          sub="Outstanding"
          icon={<ArrowUpRight size={18} />}
          color="var(--green)"
        />
        <StatCard
          label="Total Borrowed"
          value={fmt(totalBorrowed)}
          sub="To repay"
          icon={<ArrowDownLeft size={18} />}
          color="var(--red)"
        />
        <StatCard
          label="vs Last Month"
          value={`${Number(trend) >= 0 ? '+' : ''}${trend}%`}
          sub={`Last month: ${fmt(lastMonth)}`}
          icon={Number(trend) >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
          color={Number(trend) > 0 ? 'var(--red)' : 'var(--green)'}
        />
      </div>

      {/* Middle row: chart + categories + app banner */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, marginBottom: 16 }}>

        {/* Monthly bar chart */}
        <div className="card card-lg">
          <div className="section-header mb-4">
            <span className="section-title">Spending Trend</span>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate?.('analytics')}>
              View Analytics <ExternalLink size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 160 }}>
            {monthlyData.map((m, i) => {
              const pct = maxMonth > 0 ? m.total / maxMonth : 0;
              const isCurrent = i === monthlyData.length - 1;
              return (
                <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{fmt(m.total)}</span>
                  <div style={{
                    width: '100%', height: `${Math.max(pct * 120, 4)}px`,
                    borderRadius: '6px 6px 0 0', transition: 'height 0.6s ease',
                    background: isCurrent
                      ? 'linear-gradient(180deg,#7C6AFF,#5E4DBE)'
                      : 'var(--elevated)',
                  }} />
                  <span style={{ fontSize: 11, color: isCurrent ? 'var(--accent)' : 'var(--text-muted)', fontWeight: isCurrent ? 700 : 500 }}>
                    {m.month}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category breakdown */}
        <div className="card">
          <p className="section-title mb-4">Top Categories</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {topCats.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No data yet</p>
            ) : topCats.map(([cat, amt]) => {
              const pct = totalSpent > 0 ? amt / totalSpent : 0;
              return (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{EMOJI[cat]} {cat}</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{fmt(amt)}</span>
                  </div>
                  <div className="progress">
                    <div className="progress-fill" style={{ width: `${pct * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom row: recent expenses + download banner */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>

        {/* Recent expenses table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p className="section-title">Recent Expenses</p>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate?.('history')}>
              View all <ExternalLink size={12} />
            </button>
          </div>
          <table className="table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Description</th>
                <th>Category</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 16px' }}>
                    No expenses yet — add your first one!
                  </td>
                </tr>
              ) : expenses.slice(0, 7).map(e => (
                <tr key={e.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{EMOJI[e.category] || '📦'}</span>
                      <span style={{ fontWeight: 600 }}>{e.note || 'Expense'}</span>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-gray" style={{ textTransform: 'capitalize' }}>{e.category}</span>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--red)' }}>
                    -{fmt(e.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Budget card */}
          {totalBudget > 0 && (
            <div className="card" style={{ background: 'linear-gradient(135deg,#7C6AFF,#5E4DBE)', border: 'none' }}>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                Budget Used
              </p>
              <p style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>
                {Math.round(budgetPct * 100)}%
              </p>
              <div style={{ height: 6, background: 'rgba(0,0,0,0.25)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', borderRadius: 3, background: isOver ? '#EF4444' : 'white', width: `${budgetPct * 100}%`, transition: 'width 0.8s ease' }} />
              </div>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>
                {fmt(monthTotal)} of {fmt(totalBudget)} {isOver ? '⚠️ Over!' : 'remaining'}
              </p>
            </div>
          )}

          {/* Download app banner */}
          <a href="https://expo.dev/artifacts/eas/spendify-app.apk" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <div className="card" style={{
              background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)',
              cursor: 'pointer', transition: 'border-color 0.2s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#22C55E,#16A34A)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Smartphone size={20} color="white" />
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 13 }}>📱 Spendify Mobile</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>Android App</p>
                </div>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12 }}>
                Track expenses on the go with the full Android app.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--green)', fontWeight: 600, fontSize: 12 }}>
                Download APK <ExternalLink size={12} />
              </div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon, color, accent }) {
  return (
    <div className="stat-card">
      <div className="stat-label">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <div className="stat-value" style={{ color: accent || undefined }}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
