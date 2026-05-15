import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, Alert, ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import RNQRGenerator from 'rn-qr-generator';
import { COLORS, FONT_SIZE, BORDER_RADIUS } from '../utils/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const FINDER_SIZE = SCREEN_W * 0.68;

const parseUPIData = (data) => {
  try {
    if (!data?.toLowerCase().startsWith('upi://pay')) return null;
    const qi = data.indexOf('?');
    if (qi === -1) return null;

    const rawQueryString = data.substring(qi + 1);
    const params = {};
    for (const pair of rawQueryString.split('&')) {
      const ei = pair.indexOf('=');
      if (ei !== -1) {
        params[pair.substring(0, ei).toLowerCase()] = pair.substring(ei + 1);
      }
    }
    return {
      upiId:        params.pa  ? decodeURIComponent(params.pa)  : '',
      payeeName:    params.pn  ? decodeURIComponent(params.pn)  : '',
      amount:       params.am  ? decodeURIComponent(params.am)  : '',
      note:         params.tn  ? decodeURIComponent(params.tn)  : '',
      rawQueryString,
    };
  } catch { return null; }
};

export default function ScanScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned]         = useState(false);
  const [scanning, setScanning]       = useState(false); // gallery loading indicator
  const processingRef = useRef(false);                   // debounce rapid duplicate scans

  // Reset scanned state when the tab is focused
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      setScanned(false);
      processingRef.current = false;
    });
    return unsub;
  }, [navigation]);

  const handleResult = (data) => {
    const parsed = parseUPIData(data);
    if (parsed?.upiId) {
      navigation.navigate('Pay', parsed);
    } else {
      Alert.alert('Invalid QR', 'This is not a valid UPI QR code.', [
        { text: 'OK', onPress: () => { setScanned(false); processingRef.current = false; } },
      ]);
    }
  };

  /**
   * Camera handler — called for every frame that contains a barcode.
   * We use a ref-based gate (processingRef) instead of setState to avoid
   * the React re-render lag that caused "double-scan" or slow detection.
   */
  const handleBarCodeScanned = ({ data }) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setScanned(true);
    handleResult(data);
  };

  /**
   * Gallery scan — shows loading indicator immediately so the user knows
   * something is happening (rn-qr-generator can take 200-600ms on large images).
   */
  const handleGalleryScan = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need gallery access to pick QR codes.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.5,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    setScanning(true);
    try {
      const response = await RNQRGenerator.detect({ uri: result.assets[0].uri });
      setScanning(false);
      if (response?.values?.length > 0) {
        handleResult(response.values[0]);
      } else {
        Alert.alert('No QR Found', 'Could not detect a QR code in this image. Try a clearer photo.');
      }
    } catch {
      setScanning(false);
      Alert.alert('Scan Error', 'Something went wrong scanning the image.');
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permCard}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>📷</Text>
          <Text style={styles.permTitle}>Camera Access Needed</Text>
          <Text style={styles.permSub}>We need camera access to scan UPI QR codes</Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission} activeOpacity={0.8}>
            <Text style={styles.permBtnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera — always mounted, feeds frames continuously for fast detection */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],    // only scan QR — fastest possible mode
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Top dim */}
        <View style={styles.dimRow}>
          <View style={[styles.dim, { flex: 1 }]} />
        </View>
        <Text style={styles.scanTitle}>Scan UPI QR</Text>
        <Text style={styles.scanSub}>Point camera at a QR code</Text>

        {/* Middle row: dim | finder | dim */}
        <View style={styles.finderRow}>
          <View style={styles.dim} />
          <View style={styles.finder}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
            {scanned && (
              <View style={styles.scanFlash} />
            )}
          </View>
          <View style={styles.dim} />
        </View>

        {/* Bottom area */}
        <View style={styles.bottomArea}>
          {scanning ? (
            <View style={styles.scanningIndicator}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.scanningText}>Scanning image…</Text>
            </View>
          ) : (
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.galleryBtn} onPress={handleGalleryScan} activeOpacity={0.8}>
                <Text style={styles.galleryBtnText}>🖼️  Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.manualBtn}
                onPress={() => navigation.navigate('Pay', {
                  upiId: '', payeeName: '', amount: '', note: '', rawQueryString: '',
                })}
                activeOpacity={0.8}
              >
                <Text style={styles.manualBtnText}>Enter UPI ID</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F', justifyContent: 'center', alignItems: 'center' },

  permCard: { backgroundColor: '#18181B', borderRadius: 24, padding: 32, alignItems: 'center', marginHorizontal: 24, borderWidth: 1, borderColor: '#27272A' },
  permTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  permSub:   { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 24 },
  permBtn:   { backgroundColor: COLORS.accent, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  permBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  overlay: { ...StyleSheet.absoluteFillObject },

  dimRow: { paddingTop: 56, alignItems: 'center' },
  dim: { backgroundColor: 'rgba(10,10,15,0.72)' },
  scanTitle: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 16, marginBottom: 4, backgroundColor: 'rgba(10,10,15,0.72)' },
  scanSub:   { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', backgroundColor: 'rgba(10,10,15,0.72)', paddingBottom: 8 },

  finderRow: { flexDirection: 'row', height: FINDER_SIZE },
  finder: {
    width: FINDER_SIZE, height: FINDER_SIZE,
    position: 'relative',
  },

  corner: { position: 'absolute', width: 28, height: 28, borderColor: COLORS.accent },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3,  borderTopLeftRadius:  8 },
  tr: { top: 0, right:0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  bl: { bottom:0, left: 0, borderBottomWidth:3, borderLeftWidth: 3,  borderBottomLeftRadius:  8 },
  br: { bottom:0, right:0, borderBottomWidth:3, borderRightWidth: 3, borderBottomRightRadius: 8 },

  scanFlash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(124,106,255,0.15)', borderRadius: 4 },

  bottomArea: {
    flex: 1,
    backgroundColor: 'rgba(10,10,15,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  actionRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 24 },
  galleryBtn: { flex: 1, backgroundColor: COLORS.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  galleryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  manualBtn: { flex: 1, backgroundColor: '#18181B', borderRadius: 999, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#3F3F46' },
  manualBtnText: { color: COLORS.accent, fontSize: 15, fontWeight: '700' },

  scanningIndicator: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#18181B', padding: 16, borderRadius: 16 },
  scanningText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
