import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useExpenses } from '../hooks/useExpenses';
import { X, Image as ImageIcon, CheckCircle, AlertCircle } from 'lucide-react';

const CATEGORIES = ['food','transport','shopping','bills','entertainment','health','other'];
const EMOJI = { food:'🍔', transport:'🚗', shopping:'🛍️', bills:'💸', entertainment:'🎬', health:'💊', other:'📦' };

export default function ScanScreen({ onBack }) {
  const { addExpense } = useExpenses();
  const [error, setError] = useState(null);
  const [scanned, setScanned] = useState(null);   // { upiId, name, amount }
  const [scanKey, setScanKey] = useState(0);
  const [note, setNote]       = useState('');
  const [category, setCategory] = useState('other');
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    if (scanned) return; // don't restart if already scanned
    const html5QrCode = new Html5Qrcode('qr-reader');
    scannerRef.current = html5QrCode;
    let isMounted = true;

    const stopScanner = async (scanner) => {
      try {
        if (scanner && scanner.isScanning) {
          await scanner.stop();
        }
      } catch (e) {
        console.warn("Failed to stop scanner:", e);
      }
      try {
        if (scanner) {
          scanner.clear();
        }
      } catch (e) {
        console.warn("Failed to clear scanner:", e);
      }
      // Fail-safe: stop any media tracks that might still be active on any video element on the page
      document.querySelectorAll('video').forEach(video => {
        if (video.srcObject) {
          const stream = video.srcObject;
          if (stream && typeof stream.getTracks === 'function') {
            stream.getTracks().forEach(track => track.stop());
          }
          video.srcObject = null;
        }
      });
    };

    html5QrCode.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decoded) => {
        if (isMounted) {
          handleScan(decoded);
        }
      },
      () => {}
    ).then(() => {
      // If the component was unmounted or scanned state became active
      // while start() was in progress, stop the scanner immediately.
      if (!isMounted) {
        stopScanner(html5QrCode);
      }
    }).catch(() => {
      if (isMounted) {
        setError('Camera permission denied or not available.');
      }
    });

    return () => {
      isMounted = false;
      stopScanner(html5QrCode);
    };
  }, [scanned, scanKey]);

  const parseUPI = (raw) => {
    try {
      const url = new URL(raw);
      return {
        upiId: url.searchParams.get('pa') || '',
        name:  url.searchParams.get('pn') || url.searchParams.get('pa') || '',
        amount: parseFloat(url.searchParams.get('am') || '0') || 0,
      };
    } catch {
      return { upiId: raw, name: raw, amount: 0 };
    }
  };

  const handleScan = (data) => {
    if (scannerRef.current?.isScanning) {
      scannerRef.current.stop().catch(() => {});
    }
    if (data.startsWith('upi://')) {
      const parsed = parseUPI(data);
      setScanned(parsed);
    } else {
      setError('Not a valid UPI QR code. Please scan a UPI payment QR.');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const html5QrCode = new Html5Qrcode('qr-hidden');
      const result = await html5QrCode.scanFile(file, true);
      handleScan(result);
    } catch {
      setError('No QR code found in image.');
    }
  };

  const handleSave = () => {
    if (!scanned) return;
    setSaving(true);
    addExpense({
      amount: scanned.amount || 0,
      note: note || scanned.name,
      category,
      upiId: scanned.upiId,
      payeeName: scanned.name,
      date: new Date().toISOString(),
    });
    setTimeout(() => { setSaving(false); setSaved(true); }, 600);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000', zIndex: 2000,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 20px 0', zIndex: 10,
      }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
          <X size={28} />
        </button>
        <h2 style={{ color: '#fff' }}>Scan UPI QR</h2>
        {!scanned && (
          <label style={{ cursor: 'pointer' }}>
            <ImageIcon size={24} color="#fff" />
            <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
        )}
        {scanned && <div style={{ width: 24 }} />}
      </header>

      {!scanned ? (
        <>
          <div id="qr-reader" style={{ flex: 1, width: '100%' }} />
          <div id="qr-hidden" style={{ display: 'none' }} />
          {error && (
            <div style={{ position: 'absolute', top: '50%', width: '100%', textAlign: 'center', padding: '24px' }}>
              <AlertCircle size={32} color="var(--red)" style={{ marginBottom: '12px' }} />
              <p style={{ color: '#fff', fontWeight: '600' }}>{error}</p>
              <button onClick={() => { setError(null); setScanKey(k => k + 1); }} style={{
                marginTop: '16px', padding: '10px 20px', borderRadius: '10px', border: 'none',
                background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: '600', cursor: 'pointer',
              }}>Try Again</button>
            </div>
          )}
          <div style={{ padding: '24px', textAlign: 'center', background: 'rgba(0,0,0,0.6)', zIndex: 10 }}>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
              Point your camera at a UPI QR code
            </p>
          </div>
        </>
      ) : saved ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
          <CheckCircle size={64} color="var(--green)" style={{ marginBottom: '20px' }} />
          <h2 style={{ color: '#fff', marginBottom: '8px' }}>Expense Saved!</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '32px' }}>Payment to {scanned.name} recorded.</p>
          <button onClick={onBack} style={{
            padding: '14px 32px', borderRadius: '14px', background: 'var(--accent)',
            color: 'white', fontWeight: '700', border: 'none', cursor: 'pointer', fontSize: '15px',
          }}>Done</button>
        </div>
      ) : (
        /* Scanned — show form */
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          padding: '24px',
        }}>
          <div style={{
            background: 'var(--card)', borderRadius: '24px', padding: '28px',
            border: '1px solid var(--border)',
          }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>UPI Payment</p>
            <h2 style={{ marginBottom: '4px' }}>{scanned.name}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '24px' }}>{scanned.upiId}</p>

            {scanned.amount > 0 && (
              <div style={{
                background: 'var(--elevated)', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600' }}>Amount in QR</span>
                <span style={{ fontWeight: '800', fontSize: '16px' }}>
                  ₹{scanned.amount.toLocaleString('en-IN')}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input className="input" placeholder="Note (optional)" value={note}
                onChange={e => setNote(e.target.value)} />
              <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{EMOJI[c]} {c}</option>)}
              </select>
              <button
                className="btn btn-primary"
                style={{ opacity: saving ? 0.7 : 1 }}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Log Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
