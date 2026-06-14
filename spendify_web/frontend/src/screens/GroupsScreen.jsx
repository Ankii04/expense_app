import React, { useState, useEffect } from 'react';
import { useGroups } from '../hooks/useExpenses';
import balanceService from '../services/balanceService';
import { Modal } from './ExpensesScreen';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Users, UserPlus, Trash2, ChevronRight, ArrowRight, Check, X } from 'lucide-react';

const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.abs(v ?? 0));
const SPLIT_TYPES = ['equal','exact','percentage','shares'];
const CATEGORIES  = ['food','transport','shopping','bills','entertainment','health','other'];
const EMOJI       = { food:'🍔', transport:'🚗', shopping:'🛍️', bills:'💸', entertainment:'🎬', health:'💊', other:'📦' };

export default function GroupsScreen() {
  const { groups, addGroup, updateGroup, deleteGroup, addGroupExpense, deleteGroupExpense } = useGroups();
  const [selected, setSelected]    = useState(null); // group id
  const [createOpen, setCreate]    = useState(false);
  const [expenseOpen, setExpense]  = useState(false);
  const [memberOpen, setMember]    = useState(false);
  const [balances, setBalances]    = useState({});
  const [simplified, setSimplified] = useState([]);

  const group = groups.find(g => g.id === selected);

  useEffect(() => {
    if (selected) {
      balanceService.getBalances(selected)
        .then(data => {
          setBalances(data.balances || {});
          setSimplified(data.simplifiedDebts || []);
        })
        .catch(() => {});
    } else {
      setBalances({});
      setSimplified([]);
    }
  }, [selected, groups]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, minHeight: 'calc(100vh - 130px)' }}>

      {/* ── Left: group list ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
            {groups.length} Groups
          </span>
          <button className="btn btn-primary btn-sm" onClick={() => setCreate(true)}>
            <Plus size={13} /> New
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px 16px' }}>
            <Users size={36} color="var(--text-muted)" style={{ marginBottom: 10 }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No groups yet.</p>
          </div>
        ) : groups.map(g => {
          return (
            <button key={g.id} onClick={() => setSelected(g.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                borderRadius: 'var(--radius-lg)', border: '1px solid',
                borderColor: selected === g.id ? 'var(--accent)' : 'var(--border)',
                background: selected === g.id ? 'var(--accent-dim)' : 'var(--card)',
                cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'all 0.15s',
              }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#7C6AFF,#5E4DBE)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'white', fontSize: 16, flexShrink: 0 }}>
                {g.name[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
                  {g.members.length} members · {(g.expenses||[]).length} expenses
                </p>
              </div>
              {g.debtCount > 0 && (
                <span className="badge badge-red" style={{ flexShrink: 0 }}>{g.debtCount}</span>
              )}
              <ChevronRight size={14} color="var(--text-muted)" />
            </button>
          );
        })}
      </div>

      {/* ── Right: group detail ── */}
      {!group ? (
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="empty-state">
            <span className="empty-icon">👥</span>
            <h3>Select a group</h3>
            <p>Choose a group from the left to see balances, expenses, and settlements.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Group header */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 24px' }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#7C6AFF,#5E4DBE)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'white', fontSize: 22 }}>
              {group.name[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>{group.name}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                Created {new Date(group.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setMember(true)}>
                <UserPlus size={13} /> Add Member
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setExpense(true)}>
                <Plus size={13} /> Add Expense
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => { deleteGroup(group.id); setSelected(null); }}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          <div className="grid-2">
            {/* Members + balances */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <p style={{ fontWeight: 700, fontSize: 14 }}>Members & Balances</p>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Joined</th>
                    <th style={{ textAlign: 'right' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {group.members.map(m => {
                    const bal = balances[m.id] || 0;
                    return (
                      <tr key={m.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--accent)', fontSize: 12 }}>
                              {m.name[0]?.toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                          {new Date(m.joined_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          {m.left_at && ` – ${new Date(m.left_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 700, color: bal >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {bal >= 0 ? '+' : '-'}{fmt(bal)}
                          </span>
                          <br />
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {bal >= 0 ? 'gets back' : 'owes'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Simplified debts */}
            <div className="card">
              <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>💡 Who Pays Whom</p>
              {simplified.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>All settled up! ✅</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {simplified.map((t, i) => {
                    const from = group.members.find(m => m.id === t.from);
                    const to   = group.members.find(m => m.id === t.to);
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--elevated)' }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{from?.name || '?'}</span>
                        <ArrowRight size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{to?.name || '?'}</span>
                        <span style={{ marginLeft: 'auto', fontWeight: 800, color: 'var(--accent)' }}>{fmt(t.amount)}</span>
                        <button className="btn btn-primary btn-sm" onClick={() => addGroupExpense(group.id, {
                          description: `Settlement: ${from?.name} → ${to?.name}`,
                          amount: t.amount, paidBy: t.from,
                          splitType: 'exact', splits: { [t.to]: t.amount },
                          is_settlement: true,
                        })}>
                          Mark Paid
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Expenses table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontWeight: 700, fontSize: 14 }}>Expenses</p>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Paid By</th>
                  <th>Split</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(group.expenses || []).length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 16px' }}>No expenses yet.</td></tr>
                ) : [...(group.expenses || [])].reverse().map(exp => {
                  const payer = group.members.find(m => m.id === exp.paidBy);
                  return (
                    <tr key={exp.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{exp.is_settlement ? '✅' : (EMOJI[exp.category] || '📦')}</span>
                          <span style={{ fontWeight: 600 }}>{exp.description || 'Expense'}</span>
                          {exp.is_settlement && <span className="badge badge-green">Settlement</span>}
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{payer?.name || '?'}</td>
                      <td><span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>{exp.splitType}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                        {new Date(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(exp.amount)}</td>
                      <td>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => deleteGroupExpense(group.id, exp.id)}>
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {createOpen && (
        <Modal title="Create Group" onClose={() => setCreate(false)} maxWidth={560}>
          <CreateGroupForm onSave={d => { addGroup(d); setCreate(false); }} />
        </Modal>
      )}
      {expenseOpen && group && (
        <Modal title="Add Group Expense" onClose={() => setExpense(false)} maxWidth={540}>
          <AddExpenseForm group={group} onSave={d => { addGroupExpense(group.id, d); setExpense(false); }} />
        </Modal>
      )}
      {memberOpen && group && (
        <Modal title="Add Member" onClose={() => setMember(false)} maxWidth={420}>
          <AddMemberForm onSave={data => {
            updateGroup(group.id, { members: [...group.members, { id: uuidv4(), balance: 0, ...data }] });
            setMember(false);
          }} />
        </Modal>
      )}
    </div>
  );
}

function CreateGroupForm({ onSave }) {
  const [name, setName] = useState('');
  const [members, setMembers] = useState([{ id: uuidv4(), name: '', phone: '', joined_at: new Date().toISOString().slice(0,10), left_at: '' }]);
  const addRow = () => setMembers(p => [...p, { id: uuidv4(), name: '', phone: '', joined_at: new Date().toISOString().slice(0,10), left_at: '' }]);
  const upd = (i, f, v) => setMembers(p => { const a = [...p]; a[i] = { ...a[i], [f]: v }; return a; });
  const save = () => {
    if (!name.trim()) return;
    const mems = members.filter(m => m.name.trim()).map(m => ({
      ...m, joined_at: m.joined_at ? new Date(m.joined_at).toISOString() : new Date().toISOString(),
      left_at: m.left_at ? new Date(m.left_at).toISOString() : null,
    }));
    onSave({ name, members: mems });
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="form-group">
        <label className="form-label">Group Name *</label>
        <input className="input" placeholder="e.g. Goa Trip, Flat 4B" value={name} onChange={e => setName(e.target.value)} autoFocus />
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <label className="form-label">Members</label>
          <button className="btn btn-ghost btn-sm" onClick={addRow}><Plus size={12} /> Add</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {members.map((m, i) => (
            <div key={m.id} style={{ background: 'var(--elevated)', borderRadius: 'var(--radius-md)', padding: 14 }}>
              <div className="grid-2" style={{ gap: 10, marginBottom: 10 }}>
                <input className="input" placeholder="Name *" value={m.name} onChange={e => upd(i, 'name', e.target.value)} />
                <input className="input" placeholder="Phone (optional)" value={m.phone} onChange={e => upd(i, 'phone', e.target.value)} />
              </div>
              <div className="grid-2" style={{ gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Joined</label>
                  <input className="input" type="date" value={m.joined_at} onChange={e => upd(i, 'joined_at', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Left (optional)</label>
                  <input className="input" type="date" value={m.left_at} onChange={e => upd(i, 'left_at', e.target.value)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <button className="btn btn-primary" onClick={save}><Check size={14} /> Create Group</button>
    </div>
  );
}

function AddMemberForm({ onSave }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [joined, setJoined] = useState(new Date().toISOString().slice(0,10));
  const [left, setLeft]     = useState('');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="form-group"><label className="form-label">Name *</label><input className="input" value={name} onChange={e=>setName(e.target.value)} autoFocus /></div>
      <div className="form-group"><label className="form-label">Phone</label><input className="input" value={phone} onChange={e=>setPhone(e.target.value)} /></div>
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Joined</label><input className="input" type="date" value={joined} onChange={e=>setJoined(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Left (opt.)</label><input className="input" type="date" value={left} onChange={e=>setLeft(e.target.value)} /></div>
      </div>
      <button className="btn btn-primary" onClick={() => name.trim() && onSave({ name: name.trim(), phone, joined_at: new Date(joined).toISOString(), left_at: left ? new Date(left).toISOString() : null })}>
        <Check size={14} /> Add Member
      </button>
    </div>
  );
}

function AddExpenseForm({ group, onSave }) {
  const members = group?.members || [];
  const [desc, setDesc]       = useState('');
  const [amount, setAmount]   = useState('');
  const [paidBy, setPaidBy]   = useState(members[0]?.id || '');
  const [splitType, setSplit] = useState('equal');
  const [cat, setCat]         = useState('other');
  const [date, setDate]       = useState(new Date().toISOString().slice(0,10));
  const [splits, setSplits]   = useState({});
  const upd = (id, val) => setSplits(p => ({ ...p, [id]: val }));
  const save = () => {
    if (!amount || !paidBy) return;
    let fs = splits;
    if (splitType === 'equal') { fs = {}; members.forEach(m => { fs[m.id] = Number(amount) / members.length; }); }
    onSave({ description: desc, amount: Number(amount), paidBy, splitType, splits: fs, category: cat, date: new Date(date).toISOString() });
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="form-group"><label className="form-label">Description</label><input className="input" placeholder="e.g. Dinner at Taj" value={desc} onChange={e=>setDesc(e.target.value)} autoFocus /></div>
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Amount (₹) *</label><input className="input" type="number" value={amount} onChange={e=>setAmount(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Paid By</label>
          <select className="input" value={paidBy} onChange={e=>setPaidBy(e.target.value)}>
            {members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Split Type</label>
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          {SPLIT_TYPES.map(t=><button key={t} className={`chip ${splitType===t?'active':''}`} onClick={()=>setSplit(t)} style={{ textTransform:'capitalize' }}>{t}</button>)}
        </div>
      </div>
      {splitType !== 'equal' && (
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 8 }}>
            {splitType==='exact'?'Amounts (₹)':splitType==='percentage'?'Percentages (%)':'Shares'}
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {members.map(m=>(
              <div key={m.id} style={{ display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ flex:1, fontWeight:600, fontSize:13 }}>{m.name}</span>
                <input className="input" type="number" placeholder="0" style={{ width:120 }} value={splits[m.id]||''} onChange={e=>upd(m.id,e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Category</label>
          <select className="input" value={cat} onChange={e=>setCat(e.target.value)}>
            {CATEGORIES.map(c=><option key={c} value={c}>{EMOJI[c]} {c}</option>)}
          </select>
        </div>
        <div className="form-group"><label className="form-label">Date</label><input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)} /></div>
      </div>
      <button className="btn btn-primary" onClick={save}><Check size={14}/> Add Expense</button>
    </div>
  );
}
