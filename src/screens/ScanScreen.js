import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../utils/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const FINDER_SIZE = SCREEN_W * 0.7;

export default function ScanScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const parseUPIData = (data) => {
    try {
      const lower = data.toLowerCase();
      if (!lower.startsWith('upi://pay')) return null;
      const url = new URL(data);
      const p = url.searchParams;
      return { upiId: p.get('pa') || '', payeeName: p.get('pn') || '', amount: p.get('am') || '', note: p.get('tn') || '' };
    } catch {
      const m = data.match(/pa=([^&]+)/i);
      if (m) {
        const pn = data.match(/pn=([^&]+)/i);
        const am = data.match(/am=([^&]+)/i);
        const tn = data.match(/tn=([^&]+)/i);
        return { upiId: decodeURIComponent(m[1]), payeeName: pn ? decodeURIComponent(pn[1]) : '', amount: am ? am[1] : '', note: tn ? decodeURIComponent(tn[1]) : '' };
      }
      return null;
    }
  };

  const handleBarCodeScanned = ({ data }) => {
    if (scanned) return;
    setScanned(true);
    const parsed = parseUPIData(data);
    if (parsed && parsed.upiId) {
      navigation.navigate('Pay', parsed);
    } else {
      setTimeout(() => setScanned(false), 2000);
    }
  };

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => setScanned(false));
    return unsub;
  }, [navigation]);

  if (!permission) return <View style={styles.container}><Text style={styles.msg}>Requesting camera...</Text></View>;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permCard}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>📷</Text>
          <Text style={styles.permTitle}>Camera Access Needed</Text>
          <Text style={styles.permSub}>We need camera access to scan UPI QR codes</Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={StyleSheet.absoluteFill} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={scanned ? undefined : handleBarCodeScanned} />
      <View style={styles.overlay}>
        <View style={styles.overlaySection}>
          <Text style={styles.scanTitle}>Scan UPI QR</Text>
          <Text style={styles.scanSub}>Point camera at a UPI QR code</Text>
        </View>
        <View style={styles.finderRow}>
          <View style={styles.overlayFill} />
          <View style={styles.finder}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
          <View style={styles.overlayFill} />
        </View>
        <View style={[styles.overlaySection, { paddingBottom: 100 }]}>
          <TouchableOpacity style={styles.manualBtn} onPress={() => navigation.navigate('Pay', { upiId: '', payeeName: '', amount: '', note: '' })}>
            <Text style={styles.manualBtnText}>Enter UPI ID manually</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  msg: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md },
  permCard: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.xl, padding: 32, alignItems: 'center', marginHorizontal: 24, borderWidth: 1, borderColor: COLORS.border },
  permTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.xl, fontWeight: '700', marginBottom: 8 },
  permSub: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md, textAlign: 'center', marginBottom: 24 },
  permBtn: { backgroundColor: COLORS.accent, borderRadius: BORDER_RADIUS.md, paddingHorizontal: 24, paddingVertical: 12 },
  permBtnText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '700' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  overlaySection: { backgroundColor: 'rgba(10,10,15,0.8)', alignItems: 'center', justifyContent: 'center', paddingVertical: 40, flex: 1 },
  overlayFill: { flex: 1, backgroundColor: 'rgba(10,10,15,0.8)' },
  finderRow: { flexDirection: 'row', height: FINDER_SIZE },
  finder: { width: FINDER_SIZE, height: FINDER_SIZE },
  scanTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.xxl, fontWeight: '800', marginBottom: 8 },
  scanSub: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: COLORS.accent },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  manualBtn: { backgroundColor: COLORS.elevated, borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12, borderWidth: 1, borderColor: COLORS.borderLight },
  manualBtnText: { color: COLORS.accent, fontSize: FONT_SIZE.md, fontWeight: '600' },
});
