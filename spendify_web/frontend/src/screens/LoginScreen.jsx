import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Wallet, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function LoginScreen() {
  const { login, register } = useAuth();
  const [mode, setMode]     = useState('login');
  const [name, setName]     = useState('');
  const [email, setEmail]   = useState('');
  const [password, setPass] = useState('');
  const [showPass, setShow] = useState(false);
  const [error, setError]   = useState('');
  const [loading, setLoad]  = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    if (mode === 'register' && !name) { setError('Please enter your name.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoad(true);
    try {
      if (mode === 'login') login(email, password);
      else register(name, email, password);
    } catch (err) { setError(err.message); }
    finally { setLoad(false); }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'grid',
      gridTemplateColumns: '1fr 480px',
    }}>
      {/* Left: hero panel */}
      <div style={{
        background: 'linear-gradient(135deg,#0F0A2A 0%,#1A0E3D 50%,#0F0A2A 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 60, position: 'relative', overflow: 'hidden',
      }}>
        {/* Glow orbs */}
        <div style={{ position:'absolute',top:-80,left:-80,width:400,height:400,borderRadius:'50%',background:'radial-gradient(circle,rgba(124,106,255,0.2) 0%,transparent 70%)',pointerEvents:'none' }}/>
        <div style={{ position:'absolute',bottom:-80,right:-80,width:400,height:400,borderRadius:'50%',background:'radial-gradient(circle,rgba(34,197,94,0.1) 0%,transparent 70%)',pointerEvents:'none' }}/>

        <div style={{ position:'relative',maxWidth:440,textAlign:'center' }}>
          <div style={{ width:72,height:72,borderRadius:20,background:'linear-gradient(135deg,#7C6AFF,#5E4DBE)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 28px',boxShadow:'0 16px 48px rgba(124,106,255,0.45)',fontSize:32 }}>
            💸
          </div>
          <h1 style={{ fontSize:40,fontWeight:900,lineHeight:1.1,marginBottom:16,background:'linear-gradient(135deg,#fff,#A1A1AA)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent' }}>
            Spendify
          </h1>
          <p style={{ color:'rgba(255,255,255,0.55)',fontSize:16,lineHeight:1.6,marginBottom:40 }}>
            The smart way to track shared expenses, split bills, and stay on top of your finances.
          </p>

          {/* Feature list */}
          {[
            ['📊','Beautiful analytics & insights'],
            ['👥','Smart group expense splitting'],
            ['📱','Also available as a mobile app'],
            ['🔒','All data stored on your device'],
          ].map(([icon, text]) => (
            <div key={text} style={{ display:'flex',alignItems:'center',gap:12,marginBottom:14,textAlign:'left' }}>
              <span style={{ fontSize:18 }}>{icon}</span>
              <span style={{ color:'rgba(255,255,255,0.7)',fontSize:14 }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right: auth form */}
      <div style={{ background:'var(--bg)',display:'flex',flexDirection:'column',justifyContent:'center',padding:'60px 48px' }}>
        <div style={{ maxWidth:360,width:'100%',margin:'0 auto' }}>
          <h2 style={{ fontSize:26,fontWeight:800,marginBottom:6 }}>
            {mode==='login'?'Welcome back':'Create account'}
          </h2>
          <p style={{ color:'var(--text-muted)',fontSize:14,marginBottom:32 }}>
            {mode==='login'?'Sign in to your Spendify account.':'Start tracking your expenses today.'}
          </p>

          {/* Mode toggle */}
          <div style={{ display:'flex',gap:4,background:'var(--elevated)',padding:4,borderRadius:'var(--radius-md)',marginBottom:28 }}>
            {['login','register'].map(m=>(
              <button key={m} onClick={()=>{ setMode(m); setError(''); }} style={{
                flex:1,padding:'8px',borderRadius:8,border:'none',cursor:'pointer',
                fontWeight:700,fontSize:13,transition:'all 0.15s',
                background:mode===m?'var(--accent)':'transparent',
                color:mode===m?'white':'var(--text-muted)',
              }}>
                {m==='login'?'Sign In':'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display:'flex',flexDirection:'column',gap:14 }}>
            {mode==='register' && (
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="input" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="input" type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position:'relative' }}>
                <input className="input" type={showPass?'text':'password'} placeholder="Min. 6 characters" value={password} onChange={e=>setPass(e.target.value)} style={{ paddingRight:40 }} />
                <button type="button" onClick={()=>setShow(p=>!p)} style={{ position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer' }}>
                  {showPass?<EyeOff size={15}/>:<Eye size={15}/>}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:'var(--radius-md)',padding:'10px 14px',color:'var(--red)',fontSize:13 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ marginTop:8,padding:'12px',fontSize:15 }}>
              {loading?'Please wait…':(mode==='login'?'Sign In':'Create Account')}
              {!loading&&<ArrowRight size={16}/>}
            </button>
          </form>

          <p style={{ textAlign:'center',marginTop:24,color:'var(--text-muted)',fontSize:12 }}>
            Your data stays on your device. 🔒
          </p>
        </div>
      </div>
    </div>
  );
}
