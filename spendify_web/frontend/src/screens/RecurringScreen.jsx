import React, { useState } from 'react';
import { useRecurring, useExpenses } from '../hooks/useExpenses';
import { Modal } from './ExpensesScreen';
import { RefreshCw, Plus, Trash2, Check, Zap } from 'lucide-react';

const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v ?? 0);
const CATEGORIES  = ['food','transport','shopping','bills','entertainment','health','other'];
const EMOJI       = { food:'🍔', transport:'🚗', shopping:'🛍️', bills:'💸', entertainment:'🎬', health:'💊', other:'📦' };
const FREQUENCIES = [
  { id:'daily',   label:'Daily'   },
  { id:'weekly',  label:'Weekly'  },
  { id:'monthly', label:'Monthly' },
  { id:'yearly',  label:'Yearly'  },
];

export default function RecurringScreen() {
  const { recurring, addRecurring, updateRecurring, deleteRecurring } = useRecurring();
  const { addExpense } = useExpenses();
  const [showAdd, setShowAdd] = useState(false);

  const logNow = (r) => {
    addExpense({ amount: r.amount, note: r.name, category: r.category, date: new Date().toISOString() });
    const next = new Date(r.nextDate);
    if (r.frequency === 'daily')   next.setDate(next.getDate() + 1);
    if (r.frequency === 'weekly')  next.setDate(next.getDate() + 7);
    if (r.frequency === 'monthly') next.setMonth(next.getMonth() + 1);
    if (r.frequency === 'yearly')  next.setFullYear(next.getFullYear() + 1);
    updateRecurring(r.id, { nextDate: next.toISOString() });
  };

  const isDue = (r) => new Date(r.nextDate) <= new Date();

  /* ── Stats ── */
  const totalMonthly = recurring.reduce((s, r) => {
    const mult = r.frequency==='daily'?30 : r.frequency==='weekly'?4 : r.frequency==='yearly'?1/12 : 1;
    return s + r.amount * mult;
  }, 0);
  const dueNow = recurring.filter(isDue).length;

  return (
    <div>
      {/* Stat row */}
      <div className="grid-4" style={{ marginBottom:24 }}>
        <div className="stat-card">
          <div className="stat-label">Active Subscriptions</div>
          <div className="stat-value">{recurring.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Monthly Estimate</div>
          <div className="stat-value">{fmt(totalMonthly)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label" style={{ color:'var(--amber)' }}>Due Now</div>
          <div className="stat-value" style={{ color: dueNow>0?'var(--amber)':undefined }}>{dueNow}</div>
        </div>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'flex-end' }}>
          <button className="btn btn-primary" onClick={()=>setShowAdd(true)}>
            <Plus size={15}/> Add Recurring
          </button>
        </div>
      </div>

      {/* Table */}
      {recurring.length === 0 ? (
        <div className="card empty-state">
          <span className="empty-icon">🔄</span>
          <h3>No recurring expenses</h3>
          <p>Add subscriptions, rent, EMIs, and other repeating bills.</p>
          <button className="btn btn-primary" style={{ marginTop:8 }} onClick={()=>setShowAdd(true)}>
            <Plus size={14}/> Add First Recurring
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding:0,overflow:'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Frequency</th>
                <th>Next Due</th>
                <th style={{ textAlign:'right' }}>Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recurring.map(r => {
                const due = isDue(r);
                return (
                  <tr key={r.id}>
                    <td>
                      <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                        <div style={{
                          width:36,height:36,borderRadius:9,flexShrink:0,
                          background: due?'rgba(124,106,255,0.15)':'var(--elevated)',
                          display:'flex',alignItems:'center',justifyContent:'center',
                          fontSize:18, border: due?'1px solid rgba(124,106,255,0.4)':'none',
                        }}>
                          {EMOJI[r.category]||'📦'}
                        </div>
                        <p style={{ fontWeight:700,fontSize:13.5 }}>{r.name}</p>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-gray" style={{ textTransform:'capitalize' }}>{r.category}</span>
                    </td>
                    <td style={{ color:'var(--text-muted)',textTransform:'capitalize',fontSize:13 }}>{r.frequency}</td>
                    <td style={{ fontSize:13 }}>
                      {new Date(r.nextDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
                    </td>
                    <td style={{ textAlign:'right',fontWeight:700,fontSize:14 }}>{fmt(r.amount)}</td>
                    <td>
                      {due
                        ? <span className="badge badge-amber">⚡ Due</span>
                        : <span className="badge badge-gray">Scheduled</span>}
                    </td>
                    <td>
                      <div style={{ display:'flex',gap:6 }}>
                        {due && (
                          <button className="btn btn-primary btn-sm" onClick={()=>logNow(r)}>
                            <Zap size={12}/> Log
                          </button>
                        )}
                        <button className="btn btn-danger btn-icon btn-sm" onClick={()=>deleteRecurring(r.id)}>
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <Modal title="New Recurring Expense" onClose={()=>setShowAdd(false)}>
          <AddRecurringForm onSave={(data)=>{ addRecurring(data); setShowAdd(false); }} />
        </Modal>
      )}
    </div>
  );
}

function AddRecurringForm({ onSave }) {
  const [name, setName]       = useState('');
  const [amount, setAmount]   = useState('');
  const [category, setCat]    = useState('bills');
  const [frequency, setFreq]  = useState('monthly');
  const [nextDate, setNext]   = useState(new Date().toISOString().slice(0,10));

  const handleSave = () => {
    if (!name || !amount) return;
    onSave({ name, amount:Number(amount), category, frequency, nextDate:new Date(nextDate).toISOString() });
  };

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Name *</label>
          <input className="input" placeholder="e.g. Netflix, Rent, Gym" value={name} onChange={e=>setName(e.target.value)} autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">Amount (₹) *</label>
          <input className="input" type="number" placeholder="0" value={amount} onChange={e=>setAmount(e.target.value)} />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Frequency</label>
        <div style={{ display:'flex',gap:6,marginTop:4 }}>
          {FREQUENCIES.map(f=>(
            <button key={f.id} className={`chip ${frequency===f.id?'active':''}`} onClick={()=>setFreq(f.id)}>{f.label}</button>
          ))}
        </div>
      </div>

      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Category</label>
          <select className="input" value={category} onChange={e=>setCat(e.target.value)}>
            {CATEGORIES.map(c=><option key={c} value={c}>{EMOJI[c]} {c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Next Due Date</label>
          <input className="input" type="date" value={nextDate} onChange={e=>setNext(e.target.value)} />
        </div>
      </div>

      <button className="btn btn-primary" onClick={handleSave}>
        <Check size={14}/> Save Recurring
      </button>
    </div>
  );
}
