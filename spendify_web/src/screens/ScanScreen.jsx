import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Image as ImageIcon } from 'lucide-react';

export default function ScanScreen({ onBack }) {
  const [error, setError] = useState(null);
  const scannerRef = useRef(null);

  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader");
    scannerRef.current = html5QrCode;

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrCode.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        handleScan(decodedText);
      },
      (errorMessage) => {
        // Just ignore noise
      }
    ).catch(err => {
      setError("Camera permission denied or not available.");
    });

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleScan = (data) => {
    if (data.startsWith('upi://pay')) {
      // For web, we can't easily "log" and then "open", 
      // so we just open the UPI link directly which triggers the app on mobile.
      window.location.href = data;
    } else {
      alert("Not a valid UPI QR code");
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const html5QrCode = new Html5Qrcode("reader-hidden");
      const result = await html5QrCode.scanFile(file, true);
      handleScan(result);
    } catch (err) {
      alert("No QR code found in image.");
    }
  };

  return (
    <div 
      className="fade-in" 
      style={{ 
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
        background: '#000', zIndex: 2000, display: 'flex', flexDirection: 'column' 
      }}
    >
      <header className="flex-row justify-between" style={{ padding: '20px', zIndex: 10 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#fff' }}>
          <X size={28} />
        </button>
        <h2 style={{ color: '#fff' }}>Scan QR</h2>
        <label style={{ cursor: 'pointer' }}>
          <ImageIcon size={24} color="#fff" />
          <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
        </label>
      </header>

      <div id="reader" style={{ flex: 1, width: '100%' }}></div>
      <div id="reader-hidden" style={{ display: 'none' }}></div>

      {error && (
        <div style={{ position: 'absolute', top: '50%', width: '100%', textAlign: 'center', color: '#fff', padding: '20px' }}>
          <p>{error}</p>
        </div>
      )}

      <div style={{ padding: '40px 20px', textAlign: 'center', background: 'rgba(0,0,0,0.5)', zIndex: 10 }}>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
          Point your camera at a UPI QR code to pay
        </p>
      </div>
    </div>
  );
}
