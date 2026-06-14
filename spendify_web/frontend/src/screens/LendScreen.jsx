import React, { useState } from 'react';
import { useLends } from '../hooks/useExpenses';
import { Modal } from './ExpensesScreen';
import { HandCoins, Plus, Trash2, Check, ChevronDown, ChevronUp } from 'lucide-react';

const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.abs(v ?? 0));

export default function LendScreen() {
  const { contactSummaries, addLend, updateLend, deleteLend } = useLends();
  const [showAdd, setShowAdd]     = useState(false);
  const [expanded, setExpanded]   = useState(null);

  const totalLent     = Object.values(contactSummaries).reduce((s,c)=>s+c.lent, 0);
  const totalBorrowed = Object.values(contactSummaries).reduce((s,c)=>s+c.borrowed, 0);

  return (
    <div>
      {/* Stat row */}
      <div className="grid-4 mb-6">
        <div className="stat-card">
          <div className="stat-label" style={{ color:'var(--green)' }}>↑ Total Lent</div>
          <div className="stat-value" style={{ color:'var(--green)' }}>{fmt(totalLent)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label" style={{ color:'var(--red)' }}>↓ Total Borrowed</div>
          <div className="stat-value" style={{ color:'var(--red)' }}>{fmt(totalBorrowed)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Net Position</div>
          <div className="stat-value" style={{ color: totalLent-totalBorrowed>=0?'var(--green)':'var(--red)' }}>
            {totalLent-totalBorrowed>=0?'+':''}{fmt(totalLent-totalBorrowed)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Contacts</div>
          <div className="stat-value">{Object.keys(contactSummaries).length}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display:'flex',justifyContent:'flex-end',marginBottom:16 }}>
        <button className="btn btn-primary btn-sm" onClick={()=>setShowAdd(true)}>
          <Plus size={14}/> Record Transaction
        </button>
      </div>

      {/* Contact table */}
      {Object.keys(contactSummaries).length === 0 ? (
        <div className="card empty-state">
          <span className="empty-icon">🤝</span>
          <h3>No records yet</h3>
          <p>Record money you've lent or borrowed from friends and family.</p>
        </div>
      ) : (
        <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
          {Object.entries(contactSummaries).map(([key, contact])=>{
            const net = contact.lent - contact.borrowed;
            const isOpen = expanded === key;
            return (
              <div key={key} className="card" style={{ padding:0, overflow:'hidden' }}>
                {/* Row */}
                <div style={{ display:'flex',alignItems:'center',gap:16,padding:'16px 20px',cursor:'pointer' }} onClick={()=>setExpanded(isOpen?null:key)}>
                  <div style={{ width:40,height:40,borderRadius:'50%',background:net>=0?'rgba(34,197,94,0.12)':'rgba(239,68,68,0.12)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:15,color:net>=0?'var(--green)':'var(--red)',flexShrink:0 }}>
                    {contact.contactName[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex:1 }}>
                    <p style={{ fontWeight:700,fontSize:14 }}>{contact.contactName}</p>
                    <p style={{ color:'var(--text-muted)',fontSize:12 }}>{contact.records.length} record{contact.records.length!==1?'s':''}</p>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <p style={{ fontWeight:800,fontSize:15,color:net>=0?'var(--green)':'var(--red)' }}>
                      {net>=0?'+':'-'}{fmt(net)}
                    </p>
                    <p style={{ fontSize:11,color:'var(--text-muted)' }}>{net>=0?'they owe you':'you owe'}</p>
                  </div>
                  {isOpen?<ChevronUp size={16} color="var(--text-muted)"/>:<ChevronDown size={16} color="var(--text-muted)"/>}
                </div>

                {/* Expanded rows */}
                {isOpen && (
                  <div style={{ borderTop:'1px solid var(--border)' }}>
                    <table className="table">
                      <thead><tr><th>Type</th><th>Note</th><th>Date</th><th style={{textAlign:'right'}}>Amount</th><th>Status</th><th/></tr></thead>
                      <tbody>
                        {contact.records.map(r=>(
                          <tr key={r.id}>
                            <td>
                              <span className={`badge ${r.type==='lend'?'badge-green':'badge-red'}`}>
                                {r.type==='lend'?'↑ Lent':'↓ Borrowed'}
                              </span>
                            </td>
                            <td style={{ fontWeight:600 }}>{r.note||'—'}</td>
                            <td style={{ color:'var(--text-muted)',fontSize:12 }}>
                              {new Date(r.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}
                            </td>
                            <td style={{ textAlign:'right',fontWeight:700,color:r.type==='lend'?'var(--green)':'var(--red)' }}>
                              {r.type==='lend'?'+':'-'}{fmt(r.amount)}
                            </td>
                            <td>
                              {r.paid
                                ? <span className="badge badge-green">Settled</span>
                                : <button className="btn btn-ghost btn-sm" onClick={()=>updateLend(r.id,{paid:true})}><Check size={11}/> Settle</button>
                              }
                            </td>
                            <td>
                              <button className="btn btn-danger btn-icon btn-sm" onClick={()=>deleteLend(r.id)}><Trash2 size={12}/></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <Modal title="Record Transaction" onClose={()=>setShowAdd(false)}>
          <AddLendForm onSave={d=>{ addLend(d); setShowAdd(false); }} />
        </Modal>
      )}
    </div>
  );
}

function AddLendForm({ onSave }) {
  const [type, setType]     = useState('lend');
  const [name, setName]     = useState('');
  const [phone, setPhone]   = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote]     = useState('');
  const [date, setDate]     = useState(new Date().toISOString().slice(0,10));
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
      <div style={{ display:'flex',background:'var(--elevated)',borderRadius:'var(--radius-md)',padding:4 }}>
        {[['lend','↑ I Lent'],['borrow','↓ I Borrowed']].map(([t,label])=>(
          <button key={t} onClick={()=>setType(t)} style={{
            flex:1, padding:'8px', borderRadius:8, border:'none', cursor:'pointer',
            fontWeight:700, fontSize:13, transition:'all 0.15s',
            background:type===t?(t==='lend'?'var(--green)':'var(--red)'):'transparent',
            color:type===t?'white':'var(--text-muted)',
          }}>{label}</button>
        ))}
      </div>
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Contact Name *</label><input className="input" value={name} onChange={e=>setName(e.target.value)} autoFocus /></div>
        <div className="form-group"><label className="form-label">Phone</label><input className="input" value={phone} onChange={e=>setPhone(e.target.value)} /></div>
      </div>
      <div className="grid-2">
        <div className="form-group"><label className="form-label">Amount (₹) *</label><input className="input" type="number" value={amount} onChange={e=>setAmount(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Date</label><input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)} /></div>
      </div>
      <div className="form-group"><label className="form-label">Note</label><input className="input" placeholder="Optional note" value={note} onChange={e=>setNote(e.target.value)} /></div>
      <button className="btn btn-primary" onClick={()=>name&&amount&&onSave({ type, contactName:name, contactPhone:phone, amount:Number(amount), note, date:new Date(date).toISOString() })}>
        <Check size={14}/> Save
      </button>
    </div>
  );
}
