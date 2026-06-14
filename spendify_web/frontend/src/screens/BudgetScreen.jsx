import React, { useState } from 'react';
import { useBudgets, useExpenses } from '../hooks/useExpenses';
import { Pencil, Check, X } from 'lucide-react';

const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v ?? 0);
const CATEGORIES = [
  { id:'food',          label:'Food & Dining',     emoji:'🍔' },
  { id:'transport',     label:'Transport',          emoji:'🚗' },
  { id:'shopping',      label:'Shopping',           emoji:'🛍️' },
  { id:'bills',         label:'Bills & Utilities',  emoji:'💸' },
  { id:'entertainment', label:'Entertainment',      emoji:'🎬' },
  { id:'health',        label:'Health',             emoji:'💊' },
  { id:'other',         label:'Other',              emoji:'📦' },
];

export default function BudgetScreen() {
  const { budgets, setBudget } = useBudgets();
  const { expenses }           = useExpenses();
  const [editing, setEditing]  = useState(null);
  const [editVal, setEditVal]  = useState('');

  const thisMonth = expenses.filter(e => {
    const d = new Date(e.date), n = new Date();
    return d.getMonth()===n.getMonth() && d.getFullYear()===n.getFullYear();
  });

  const spentByCat = thisMonth.reduce((acc,e) => {
    acc[e.category] = (acc[e.category]||0)+e.amount;
    return acc;
  }, {});

  const totalBudget = Object.values(budgets).reduce((s,v)=>s+Number(v),0);
  const totalSpent  = thisMonth.reduce((s,e)=>s+e.amount,0);

  return (
    <div>
      {/* Summary */}
      {totalBudget > 0 && (
        <div className="card" style={{ background:'linear-gradient(135deg,#7C6AFF,#5E4DBE)',border:'none',padding:'28px 32px',marginBottom:24 }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
            <div>
              <p style={{ color:'rgba(255,255,255,0.65)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1,marginBottom:4 }}>
                Total Monthly Budget
              </p>
              <p style={{ fontSize:32,fontWeight:800 }}>
                {fmt(totalSpent)} <span style={{ fontSize:18,opacity:0.65 }}>/ {fmt(totalBudget)}</span>
              </p>
            </div>
            <div style={{ textAlign:'right' }}>
              <p style={{ fontSize:40,fontWeight:900,opacity:0.9 }}>{Math.round(totalSpent/totalBudget*100)}%</p>
              <p style={{ color:'rgba(255,255,255,0.65)',fontSize:12 }}>used</p>
            </div>
          </div>
          <div style={{ height:8,background:'rgba(0,0,0,0.25)',borderRadius:4,overflow:'hidden' }}>
            <div style={{ height:'100%',borderRadius:4,background:totalSpent>totalBudget?'#EF4444':'white',width:`${Math.min(totalSpent/totalBudget,1)*100}%`,transition:'width 0.8s ease' }}/>
          </div>
        </div>
      )}

      {/* Category grid */}
      <div className="grid-auto">
        {CATEGORIES.map(cat => {
          const budget  = Number(budgets[cat.id])||0;
          const spent   = spentByCat[cat.id]||0;
          const pct     = budget>0?Math.min(spent/budget,1):0;
          const over    = budget>0&&spent>budget;
          const isEdit  = editing===cat.id;

          return (
            <div key={cat.id} className="card" style={{ padding:'22px 24px' }}>
              <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:16 }}>
                <div style={{ display:'flex',alignItems:'center',gap:12 }}>
                  <div style={{ width:46,height:46,borderRadius:12,background:'var(--elevated)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22 }}>
                    {cat.emoji}
                  </div>
                  <div>
                    <p style={{ fontWeight:700,fontSize:14 }}>{cat.label}</p>
                    <p style={{ color:over?'var(--red)':'var(--text-muted)',fontSize:12,marginTop:2 }}>
                      {spent>0?fmt(spent)+' spent':'No spending'}
                      {over&&' ⚠️ Over!'}
                    </p>
                  </div>
                </div>
                {!isEdit ? (
                  <button className="btn btn-ghost btn-sm" onClick={()=>{ setEditing(cat.id); setEditVal(budget||''); }}>
                    <Pencil size={12}/> {budget>0?fmt(budget):'Set budget'}
                  </button>
                ) : (
                  <div style={{ display:'flex',gap:6,alignItems:'center' }}>
                    <input className="input" type="number" placeholder="₹" autoFocus
                      value={editVal} onChange={e=>setEditVal(e.target.value)}
                      style={{ width:110,padding:'6px 10px',fontSize:13 }}
                    />
                    <button className="btn btn-primary btn-sm" onClick={()=>{ setBudget(cat.id,editVal); setEditing(null); }}>
                      <Check size={12}/>
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>setEditing(null)}>
                      <X size={12}/>
                    </button>
                  </div>
                )}
              </div>

              {budget > 0 && (
                <>
                  <div className="progress" style={{ height:6 }}>
                    <div className="progress-fill" style={{ width:`${pct*100}%`,background:over?'var(--red)':pct>0.8?'var(--amber)':'var(--accent)' }}/>
                  </div>
                  <div style={{ display:'flex',justifyContent:'space-between',marginTop:8 }}>
                    <span style={{ fontSize:11,color:'var(--text-muted)' }}>{Math.round(pct*100)}% used</span>
                    <span style={{ fontSize:11,color:'var(--text-muted)' }}>{fmt(budget-spent)} left</span>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
