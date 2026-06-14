import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, PieChart, Pie, Tooltip } from 'recharts';
import { useExpenses, useBudgets } from '../hooks/useExpenses';
import { TrendingUp, TrendingDown } from 'lucide-react';

const COLORS = ['#7C6AFF','#22C55E','#EF4444','#F59E0B','#3B82F6','#A855F7','#EC4899'];
const EMOJI   = { food:'🍔', transport:'🚗', shopping:'🛍️', bills:'💸', entertainment:'🎬', health:'💊', other:'📦' };
const MONTHS  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt     = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v ?? 0);

export default function AnalyticsScreen() {
  const { expenses }  = useExpenses();
  const { budgets }   = useBudgets();
  const [tab, setTab] = useState('overview');

  const catData = expenses.reduce((acc, e) => {
    const cat = e.category || 'other';
    acc[cat] = (acc[cat] || 0) + e.amount;
    return acc;
  }, {});
  const pieData = Object.entries(catData).sort((a,b)=>b[1]-a[1]).map(([name, value]) => ({ name, value }));
  const totalSpent = expenses.reduce((s,e)=>s+e.amount, 0);

  const now = new Date();
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const total = expenses.filter(e => {
      const ed = new Date(e.date);
      return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear();
    }).reduce((s,e)=>s+e.amount, 0);
    return { month: MONTHS[d.getMonth()], total, year: d.getFullYear() };
  });

  const thisMonth = monthlyData[monthlyData.length-1]?.total || 0;
  const lastMonth = monthlyData[monthlyData.length-2]?.total || 0;
  const trend     = lastMonth > 0 ? ((thisMonth - lastMonth)/lastMonth*100).toFixed(1) : 0;
  const avgMonthly = monthlyData.reduce((s,m)=>s+m.total,0) / 12;

  return (
    <div>
      {/* Header tabs */}
      <div style={{ display:'flex', gap:16, marginBottom:24, borderBottom:'1px solid var(--border)', paddingBottom:0 }}>
        {[['overview','Overview'],['trends','Trends'],['budget','Budget vs Actual']].map(([t,label])=>(
          <button key={t} onClick={()=>setTab(t)} style={{
            padding:'8px 4px 16px', border:'none', background:'none', cursor:'pointer',
            fontWeight: tab===t ? 700 : 500, fontSize:14,
            color: tab===t ? 'var(--text-primary)' : 'var(--text-muted)',
            borderBottom: tab===t ? '2px solid var(--accent)' : '2px solid transparent',
            transition:'all 0.15s', marginBottom:-1,
          }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          {/* Stat cards */}
          <div className="grid-4 mb-6">
            <MiniStat label="Total Spent" value={fmt(totalSpent)} />
            <MiniStat label="This Month" value={fmt(thisMonth)} />
            <MiniStat label="Avg / Month" value={fmt(avgMonthly)} />
            <MiniStat
              label="vs Last Month"
              value={`${Number(trend)>=0?'+':''}${trend}%`}
              color={Number(trend)>0?'var(--red)':'var(--green)'}
              icon={Number(trend)>0?<TrendingUp size={16}/>:<TrendingDown size={16}/>}
            />
          </div>

          {/* Pie + table */}
          <div className="grid-2">
            <div className="card card-lg">
              <p style={{ fontWeight:700, fontSize:15, marginBottom:20 }}>Spending by Category</p>
              {pieData.length === 0 ? (
                <p style={{ color:'var(--text-muted)', fontSize:13 }}>No data yet.</p>
              ) : (
                <>
                  <div style={{ width:'100%', height:260, minWidth: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} innerRadius={70} outerRadius={110} paddingAngle={3} dataKey="value">
                          {pieData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                        </Pie>
                        <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,fontSize:12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display:'flex',flexDirection:'column',gap:10,marginTop:20 }}>
                    {pieData.map((item,i)=>(
                      <div key={item.name} style={{ display:'flex',alignItems:'center',gap:10 }}>
                        <div style={{ width:10,height:10,borderRadius:'50%',background:COLORS[i%COLORS.length],flexShrink:0 }}/>
                        <span style={{ flex:1,fontSize:13 }}>{EMOJI[item.name]||'📦'} {item.name}</span>
                        <span style={{ fontWeight:700,fontSize:13 }}>{fmt(item.value)}</span>
                        <span style={{ color:'var(--text-muted)',fontSize:11 }}>{totalSpent>0?Math.round(item.value/totalSpent*100):0}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="card card-lg">
              <p style={{ fontWeight:700, fontSize:15, marginBottom:20 }}>Category Breakdown</p>
              <table className="table">
                <thead><tr><th>Category</th><th style={{textAlign:'right'}}>Amount</th><th style={{textAlign:'right'}}>Share</th></tr></thead>
                <tbody>
                  {pieData.map((item,i)=>(
                    <tr key={item.name}>
                      <td><div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{width:8,height:8,borderRadius:'50%',background:COLORS[i%COLORS.length]}}/>
                        <span style={{fontWeight:600,textTransform:'capitalize'}}>{EMOJI[item.name]||'📦'} {item.name}</span>
                      </div></td>
                      <td style={{textAlign:'right',fontWeight:700}}>{fmt(item.value)}</td>
                      <td style={{textAlign:'right',color:'var(--text-muted)',fontSize:12}}>{totalSpent>0?Math.round(item.value/totalSpent*100):0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'trends' && (
        <div className="card card-lg">
          <p style={{ fontWeight:700, fontSize:15, marginBottom:24 }}>Monthly Spending — Last 12 Months</p>
          <div style={{ width:'100%', height:300, marginBottom:24, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} barCategoryGap="30%">
                <XAxis dataKey="month" tick={{fill:'var(--text-muted)',fontSize:12}} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={v=>fmt(v)} contentStyle={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,fontSize:12}} />
                <Bar dataKey="total" radius={[6,6,0,0]}>
                  {monthlyData.map((_,i)=><Cell key={i} fill={i===monthlyData.length-1?'#7C6AFF':'#232328'}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="table">
            <thead><tr><th>Month</th><th style={{textAlign:'right'}}>Spending</th><th style={{textAlign:'right'}}>vs Prior</th></tr></thead>
            <tbody>
              {monthlyData.slice().reverse().map((m,i,arr)=>{
                const prior = arr[i+1]?.total||0;
                const diff  = prior>0?((m.total-prior)/prior*100).toFixed(1):null;
                return (
                  <tr key={i}>
                    <td style={{fontWeight:600}}>{m.month} {m.year}</td>
                    <td style={{textAlign:'right',fontWeight:700}}>{fmt(m.total)}</td>
                    <td style={{textAlign:'right',fontSize:12,color:diff===null?'var(--text-muted)':Number(diff)>0?'var(--red)':'var(--green)'}}>
                      {diff===null?'–':`${Number(diff)>=0?'+':''}${diff}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'budget' && (
        <div>
          <div className="grid-auto">
            {Object.entries(catData).map(([cat, spent])=>{
              const budget = Number(budgets[cat])||0;
              const pct    = budget>0?Math.min(spent/budget,1):0;
              const over   = budget>0&&spent>budget;
              return (
                <div key={cat} className="card" style={{ padding:'20px 24px' }}>
                  <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:16 }}>
                    <span style={{ fontSize:24 }}>{EMOJI[cat]||'📦'}</span>
                    <div>
                      <p style={{ fontWeight:700,textTransform:'capitalize' }}>{cat}</p>
                      {budget>0&&<p style={{ fontSize:12,color:'var(--text-muted)' }}>Budget: {fmt(budget)}</p>}
                    </div>
                    {over&&<span className="badge badge-red" style={{marginLeft:'auto'}}>Over</span>}
                  </div>
                  <p style={{ fontSize:22,fontWeight:800,marginBottom:10,color:over?'var(--red)':undefined }}>{fmt(spent)}</p>
                  {budget>0&&(
                    <div className="progress">
                      <div className="progress-fill" style={{ width:`${pct*100}%`,background:over?'var(--red)':pct>0.8?'var(--amber)':'var(--accent)' }}/>
                    </div>
                  )}
                  {budget===0&&<p style={{fontSize:12,color:'var(--text-muted)'}}>No budget set</p>}
                </div>
              );
            })}
          </div>
          {Object.keys(catData).length===0&&(
            <div className="empty-state"><span className="empty-icon">📊</span><h3>No data</h3><p>Add expenses to see budget comparisons.</p></div>
          )}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{icon&&<span style={{color}}>{icon}</span>}{label}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
    </div>
  );
}
