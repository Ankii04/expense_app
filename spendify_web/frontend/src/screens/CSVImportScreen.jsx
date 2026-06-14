import React, { useState, useEffect } from 'react';
import { useGroups } from '../hooks/useExpenses';
import importService from '../services/importService';
import { Upload, AlertCircle, XCircle, Check, ArrowLeft, Download, RefreshCw } from 'lucide-react';

const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v ?? 0);
const EMOJI = { food:'🍔', transport:'🚗', shopping:'🛍️', bills:'💸', entertainment:'🎬', health:'💊', other:'📦' };

export default function CSVImportScreen({ onBack }) {
  const { groups, loading: groupsLoading } = useGroups();
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [importId, setImportId] = useState(null);
  const [importLog, setImportLog] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [rows, setRows] = useState(null); // reports array
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState('');

  useEffect(() => {
    if (groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups, selectedGroupId]);

  const processFile = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv' && file.type !== 'application/vnd.ms-excel') {
      setParseError('Please upload a .csv file.');
      return;
    }
    if (!selectedGroupId) {
      setParseError('Please select a group first.');
      return;
    }
    setParseError('');
    setImporting(true);
    try {
      const log = await importService.uploadCSV(selectedGroupId, file);
      const report = await importService.getReport(selectedGroupId, log.id);
      setImportId(log.id);
      setImportLog(report.log);
      setAnomalies(report.anomalies);
      setRows(report.log.import_report?.reports || []);
    } catch (err) {
      setParseError(err.response?.data?.error || err.message || 'Failed to upload and parse CSV.');
    } finally {
      setImporting(false);
    }
  };

  const handleApproveAnomaly = async (rowNumber) => {
    try {
      await importService.approveAnomaly(selectedGroupId, importId, rowNumber);
      const report = await importService.getReport(selectedGroupId, importId);
      setAnomalies(report.anomalies);
      setImportLog(report.log);
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Failed to approve anomaly.');
    }
  };

  const onDragOver  = (e) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = ()  => setDragOver(false);
  const onDrop      = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    processFile(file);
  };

  const sampleCSV = `date,amount,note,category,payer\n15/06/2026,₹450,Lunch at cafe,food,\n01/06/2026,$10.99,Netflix subscription,entertainment,\n20/05/2026,1200,Electricity bill,bills,\n10/06/2026,750,Auto ride,transport,`;

  const downloadSample = () => {
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(sampleCSV);
    a.download = 'sample_group_expenses.csv'; a.click();
  };

  const importedCount = rows?.filter(r => r.status !== 'REJECTED' && !r.requiresApproval).length ?? 0;
  const duplicateCount = anomalies?.filter(a => a.requires_approval).length ?? 0;
  const approvedDuplicates = anomalies?.filter(a => a.requires_approval && a.approved).length ?? 0;
  const pendingCount = duplicateCount - approvedDuplicates;
  const errorCount = rows?.filter(r => r.status === 'REJECTED').length ?? 0;

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex',alignItems:'center',justifyContent: 'space-between',marginBottom:28 }}>
        <div style={{ display:'flex',alignItems:'center',gap:12 }}>
          <button onClick={onBack} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex',alignItems:'center',padding:6,borderRadius:8 }}>
            <ArrowLeft size={20}/>
          </button>
          <div>
            <p style={{ fontSize:12,color:'var(--text-muted)',fontWeight:600,marginBottom:2 }}>TOOLS</p>
            <h2 style={{ fontSize:20,fontWeight:800 }}>Import CSV</h2>
          </div>
        </div>
        <button onClick={downloadSample} className="btn btn-ghost btn-sm">
          <Download size={13}/> Download Sample
        </button>
      </div>

      {!rows ? (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:24, alignItems:'start' }}>
          {/* Upload zone */}
          <div>
            {groups.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                <AlertCircle size={40} color="var(--red)" style={{ marginBottom: 12 }} />
                <h3>No Groups Found</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>You must create a group before you can import group expenses from CSV.</p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 20 }}>
                  <label className="form-label" style={{ fontWeight: 700, display: 'block', marginBottom: 8 }}>Select Group for Import *</label>
                  <select
                    className="input"
                    value={selectedGroupId}
                    onChange={e => setSelectedGroupId(e.target.value)}
                    style={{ maxWidth: 350 }}
                  >
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name} ({g.members?.length || 0} members)</option>
                    ))}
                  </select>
                </div>

                <label
                  htmlFor="csv-file-input"
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  style={{
                    display:'block', border:`2px dashed ${dragOver?'var(--accent)':'var(--border)'}`,
                    borderRadius:16, padding:'60px 32px', textAlign:'center',
                    cursor:'pointer', transition:'all 0.2s', marginBottom:16,
                    background: dragOver ? 'rgba(124,106,255,0.06)' : 'transparent',
                  }}
                >
                  <input
                    id="csv-file-input"
                    type="file"
                    accept=".csv,text/csv,application/vnd.ms-excel"
                    style={{ display:'none' }}
                    onChange={e => { processFile(e.target.files[0]); e.target.value=''; }}
                  />
                  <div style={{ width:64,height:64,borderRadius:16,background:'var(--accent-dim)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px' }}>
                    <Upload size={28} color="var(--accent)"/>
                  </div>
                  <p style={{ fontWeight:700,fontSize:16,marginBottom:6 }}>
                    {importing ? 'Processing CSV...' : dragOver ? 'Drop it!' : 'Click to browse or drag & drop'}
                  </p>
                  <p style={{ color:'var(--text-muted)',fontSize:13 }}>Supports .csv files</p>
                </label>
              </>
            )}

            {parseError && (
              <div style={{ display:'flex',alignItems:'center',gap:10,padding:'12px 16px',borderRadius:10,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.25)',color:'var(--red)',marginBottom:16 }}>
                <XCircle size={16}/> {parseError}
              </div>
            )}
          </div>

          {/* Format guide */}
          <div>
            <div className="card" style={{ marginBottom:16 }}>
              <p style={{ fontWeight:700,fontSize:14,marginBottom:14 }}>📋 Accepted Columns</p>
              <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                {[
                  { col:'date',              desc:'DD/MM/YYYY, MM-DD-YYYY, or YYYY-MM-DD' },
                  { col:'amount',            desc:'₹ or $ prefix (USD auto-converts to INR)' },
                  { col:'note / description',desc:'Expense description' },
                  { col:'category',          desc:'food, transport, shopping, bills, entertainment, health, other' },
                  { col:'payer / paid_by',   desc:'Member name (optional, defaults to active user)' },
                ].map(item => (
                  <div key={item.col} style={{ padding:'10px 12px',background:'var(--elevated)',borderRadius:8 }}>
                    <code style={{ color:'var(--accent)',fontWeight:700,fontSize:12 }}>{item.col}</code>
                    <p style={{ color:'var(--text-muted)',fontSize:11,marginTop:3 }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding:'16px 18px' }}>
              <p style={{ fontWeight:700,fontSize:13,marginBottom:10 }}>✨ Smart detection</p>
              <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
                {[
                  '🔁 Duplicate row detection',
                  '💱 USD → INR conversion',
                  '⚠️ Negative / zero amount alerts',
                  '📅 Multiple date formats',
                  '🏷️ Unknown category remapping',
                  '👥 Payer membership timeline audit',
                ].map(f=>(
                  <p key={f} style={{ fontSize:12,color:'var(--text-muted)' }}>{f}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div>
          {/* Summary bar */}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20 }}>
            <SummaryCard count={importedCount + approvedDuplicates} label="Imported" color="var(--green)" bg="rgba(34,197,94,0.08)" border="rgba(34,197,94,0.2)" />
            <SummaryCard count={pendingCount}  label="Pending Approval"        color="var(--amber)" bg="rgba(245,158,11,0.08)" border="rgba(245,158,11,0.2)" />
            <SummaryCard count={errorCount}    label="Errors (skipped)" color="var(--red)"  bg="rgba(239,68,68,0.08)"  border="rgba(239,68,68,0.2)" />
          </div>

          {/* Quick actions */}
          <div style={{ display:'flex',gap:8,marginBottom:20 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setRows(null); setAnomalies([]); setImportLog(null); setImportId(null); }}>
              <RefreshCw size={12}/> Upload Another
            </button>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Imported into group: <strong>{groups.find(g => g.id === selectedGroupId)?.name}</strong>
              </span>
            </div>
          </div>

          {/* Row table */}
          <div className="card" style={{ padding:0,overflow:'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width:36 }}></th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th style={{ textAlign:'right' }}>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const isRejected = row.status === 'REJECTED';
                  const isDuplicate = row.requiresApproval;
                  const anomaly = anomalies?.find(a => a.row_number === row.rowNumber);
                  const isApproved = anomaly ? anomaly.approved : false;

                  return (
                    <tr key={row.rowNumber} style={{
                      opacity: isRejected ? 0.6 : 1,
                      background: isRejected ? 'rgba(239,68,68,0.02)' : isDuplicate ? 'rgba(245,158,11,0.02)' : 'transparent'
                    }}>
                      <td>
                        {isRejected && <XCircle size={16} color="var(--red)" />}
                        {!isRejected && !isDuplicate && <Check size={16} color="var(--green)" />}
                        {isDuplicate && isApproved && <Check size={16} color="var(--green)" />}
                        {isDuplicate && !isApproved && <AlertCircle size={16} color="var(--amber)" />}
                      </td>
                      <td>
                        <p style={{ fontWeight:600,fontSize:13.5 }}>{row.data?.note || row.note || 'Unnamed'}</p>
                        
                        {row.warnings?.map((w, i) => (
                          <div key={i} style={{ display:'flex',alignItems:'flex-start',gap:5,marginTop:4 }}>
                            <AlertCircle size={11} color="var(--amber)" style={{ marginTop:1,flexShrink:0 }}/>
                            <span style={{ fontSize:11,color:'var(--amber)' }}>{w}</span>
                          </div>
                        ))}
                        
                        {row.errors?.map((e, i) => (
                          <div key={i} style={{ display:'flex',alignItems:'flex-start',gap:5,marginTop:4 }}>
                            <XCircle size={11} color="var(--red)" style={{ marginTop:1,flexShrink:0 }}/>
                            <span style={{ fontSize:11,color:'var(--red)' }}>{e}</span>
                          </div>
                        ))}
                        
                        {row.autoFixes?.map((f, i) => (
                          <div key={i} style={{ display:'flex',alignItems:'center',gap:5,marginTop:4 }}>
                            <span style={{ fontSize:10,color:'var(--text-muted)',background:'var(--elevated)',padding:'2px 6px',borderRadius:4 }}>
                              🔧 {f}
                            </span>
                          </div>
                        ))}
                      </td>
                      <td>
                        <span className="badge badge-gray" style={{ textTransform:'capitalize' }}>
                          {EMOJI[row.data?.category || row.category] || '📦'} {row.data?.category || row.category}
                        </span>
                      </td>
                      <td style={{ color:'var(--text-muted)',fontSize:13 }}>
                        {row.data?.date ? new Date(row.data.date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : 'N/A'}
                      </td>
                      <td style={{ textAlign:'right',fontWeight:700 }}>
                        {fmt(row.data?.amountInINR || row.amount)}
                        {row.data?.currency === 'USD' && (
                          <span style={{ display:'block',fontSize:11,color:'var(--text-muted)',fontWeight:400 }}>
                            (${row.data.amount})
                          </span>
                        )}
                      </td>
                      <td>
                        {isRejected ? (
                          <span className="badge badge-red">Rejected</span>
                        ) : isDuplicate ? (
                          isApproved ? (
                            <span className="badge badge-green">Approved</span>
                          ) : (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleApproveAnomaly(row.rowNumber)}
                              style={{ padding: '4px 8px', fontSize: 11 }}
                            >
                              Approve
                            </button>
                          )
                        ) : (
                          <span className="badge badge-green">Imported</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ count, label, color, bg, border }) {
  return (
    <div style={{ padding:'16px 20px',background:bg,border:`1px solid ${border}`,borderRadius:12,textAlign:'center' }}>
      <p style={{ fontSize:28,fontWeight:800,color }}>{count}</p>
      <p style={{ fontSize:12,color:'var(--text-muted)',marginTop:3,fontWeight:600 }}>{label}</p>
    </div>
  );
}
