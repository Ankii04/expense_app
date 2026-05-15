import React, { useState } from 'react';
import { useExpenses } from '../hooks/useExpenses';
import { Search, Plus } from 'lucide-react';

export default function ExpensesScreen() {
  const { expenses, deleteExpense, addExpense } = useExpenses();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const filtered = expenses.filter(e => 
    e.note?.toLowerCase().includes(search.toLowerCase()) || 
    e.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fade-in">
      <div className="flex-row justify-between" style={{ marginBottom: '24px' }}>
        <h1>History</h1>
        <button className="btn btn-secondary" style={{ padding: '8px 12px' }} onClick={() => setShowAdd(true)}>
          <Plus size={20} />
        </button>
      </div>

      <div className="flex-row gap-sm card" style={{ padding: '12px 16px', marginBottom: '20px' }}>
        <Search size={18} color="var(--text-muted)" />
        <input 
          className="input" 
          style={{ border: 'none', padding: 0, background: 'none' }} 
          placeholder="Search transactions..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="flex-col gap-sm">
        {filtered.map(exp => (
          <div key={exp.id} className="card flex-row justify-between">
            <div>
              <p style={{ fontWeight: '600' }}>{exp.note || 'Expense'}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{exp.category} · {new Date(exp.date).toLocaleDateString()}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontWeight: '800' }}>-₹{exp.amount}</p>
              <button 
                onClick={() => deleteExpense(exp.id)}
                style={{ color: 'var(--red)', fontSize: '10px', background: 'none', border: 'none', marginTop: '4px' }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div 
          style={{ 
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(0,0,0,0.8)', zIndex: 3000, display: 'flex', 
            alignItems: 'flex-end' 
          }}
          onClick={() => setShowAdd(false)}
        >
          <div 
            className="card" 
            style={{ width: '100%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingBottom: '40px' }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '20px' }}>Add Expense</h2>
            <AddForm onSave={() => setShowAdd(false)} addExpense={addExpense} />
          </div>
        </div>
      )}
    </div>
  );
}

function AddForm({ onSave, addExpense }) {
  const [amt, setAmt] = useState('');
  const [note, setNote] = useState('');
  const [cat, setCat] = useState('other');

  const handleSave = () => {
    if (!amt) return;
    addExpense({ amount: amt, note, category: cat });
    onSave();
  };

  return (
    <div className="flex-col gap-md">
      <input className="input" placeholder="Amount (₹)" type="number" value={amt} onChange={e => setAmt(e.target.value)} />
      <input className="input" placeholder="Note" value={note} onChange={e => setNote(e.target.value)} />
      <select className="input" value={cat} onChange={e => setCat(e.target.value)}>
        <option value="food">Food</option>
        <option value="transport">Transport</option>
        <option value="shopping">Shopping</option>
        <option value="bills">Bills</option>
        <option value="other">Other</option>
      </select>
      <button className="btn btn-primary" onClick={handleSave}>Save Expense</button>
    </div>
  );
}
