import React, { useState, useEffect } from 'react';
import { useExpenses } from '../hooks/useExpenses';
import { Search, Plus, Pencil, Trash2, X, Check, FileUp, Filter } from 'lucide-react';

const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v ?? 0);
const CATEGORIES = ['food','transport','shopping','bills','entertainment','health','other'];
const EMOJI = { food:'🍔', transport:'🚗', shopping:'🛍️', bills:'💸', entertainment:'🎬', health:'💊', other:'📦' };

export default function ExpensesScreen({ onNavigate, autoOpen }) {
  const { expenses, addExpense, updateExpense, deleteExpense } = useExpenses();
  const [search, setSearch]   = useState('');
  const [filterCat, setFilter] = useState('all');
  const [modal, setModal]     = useState(autoOpen ? 'add' : null);

  useEffect(() => {
    if (autoOpen) {
      setModal('add');
    }
  }, [autoOpen]);

  const filtered = expenses.filter(e => {
    const matchSearch = (e.note || '').toLowerCase().includes(search.toLowerCase());
    const matchCat    = filterCat === 'all' || e.category === filterCat;
    return matchSearch && matchCat;
  });

  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0 14px' }}>
          <Search size={15} color="var(--text-muted)" />
          <input style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13.5, padding: '9px 0', fontFamily: 'inherit' }}
            placeholder="Search expenses..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Category filter */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['all', ...CATEGORIES].map(cat => (
            <button key={cat} className={`chip ${filterCat === cat ? 'active' : ''}`} onClick={() => setFilter(cat)}>
              {cat === 'all' ? 'All' : `${EMOJI[cat]} ${cat}`}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate?.('csv')}>
            <FileUp size={14} /> Import CSV
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setModal('add')}>
            <Plus size={14} /> Add Expense
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 16, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
        <SummaryPill label="Showing" value={filtered.length} />
        <SummaryPill label="Total" value={fmt(totalFiltered)} highlight />
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Category</th>
              <th>Date</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                  {search || filterCat !== 'all' ? '🔍 No results found.' : '💸 No expenses yet. Add your first one!'}
                </td>
              </tr>
            ) : filtered.map(exp => (
              <tr key={exp.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{EMOJI[exp.category] || '📦'}</span>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 13.5 }}>{exp.note || 'Expense'}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="badge badge-gray" style={{ textTransform: 'capitalize' }}>{exp.category}</span>
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  {new Date(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--red)', fontSize: 14 }}>
                  -{fmt(exp.amount)}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModal(exp)} title="Edit">
                      <Pencil size={13} />
                    </button>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => deleteExpense(exp.id)} title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <Modal title={modal === 'add' ? 'Add Expense' : 'Edit Expense'} onClose={() => setModal(null)}>
          <ExpenseForm
            initial={modal === 'add' ? null : modal}
            onSave={(data) => {
              if (modal === 'add') addExpense(data);
              else updateExpense(modal.id, data);
              setModal(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function SummaryPill({ label, value, highlight }) {
  return (
    <div>
      <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label} </span>
      <span style={{ fontWeight: 800, fontSize: 14, color: highlight ? 'var(--accent)' : 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function ExpenseForm({ initial, onSave }) {
  const [amt,  setAmt]  = useState(initial?.amount  || '');
  const [note, setNote] = useState(initial?.note    || '');
  const [cat,  setCat]  = useState(initial?.category || 'other');
  const [date, setDate] = useState(initial?.date ? initial.date.slice(0,10) : new Date().toISOString().slice(0,10));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Amount (₹) *</label>
          <input className="input" placeholder="0.00" type="number" value={amt} onChange={e => setAmt(e.target.value)} autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">Date</label>
          <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Note</label>
        <input className="input" placeholder="What did you spend on?" value={note} onChange={e => setNote(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">Category</label>
        <select className="input" value={cat} onChange={e => setCat(e.target.value)}>
          {CATEGORIES.map(c => <option key={c} value={c}>{EMOJI[c]} {c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
        </select>
      </div>
      <div className="modal-footer" style={{ padding: 0, borderTop: 'none' }}>
        <button className="btn btn-primary w-full" onClick={() => {
          if (!amt || isNaN(Number(amt))) return;
          onSave({ amount: Number(amt), note, category: cat, date: new Date(date).toISOString() });
        }}>
          <Check size={15} /> {initial ? 'Update Expense' : 'Save Expense'}
        </button>
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children, maxWidth = 520 }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
