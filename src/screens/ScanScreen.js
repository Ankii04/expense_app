import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, Alert, ActivityIndicator, BackHandler,
  Modal, Linking, ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import RNQRGenerator from 'rn-qr-generator';
import { COLORS } from '../utils/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const FINDER_SIZE = SCREEN_W * 0.68;

// ─── Parse UPI QR data ────────────────────────────────────────────
const parseUPIData = (data) => {
  try {
    if (!data?.toLowerCase().startsWith('upi://pay')) return null;
    const qi = data.indexOf('?');
    if (qi === -1) return null;
    const rawQueryString = data.substring(qi + 1);
    const params = {};
    for (const pair of rawQueryString.split('&')) {
      const ei = pair.indexOf('=');
      if (ei !== -1) params[pair.substring(0, ei).toLowerCase()] = pair.substring(ei + 1);
    }
    return {
      upiId:         params.pa  ? decodeURIComponent(params.pa)  : '',
      payeeName:     params.pn  ? decodeURIComponent(params.pn)  : '',
      amount:        params.am  ? decodeURIComponent(params.am)  : '',
      note:          params.tn  ? decodeURIComponent(params.tn)  : '',
      rawQueryString,
    };
  } catch { return null; }
};

// ─── Merchant QR detection ────────────────────────────────────────
const checkIsMerchant = (rawData) => {
  if (!rawData) return false;
  if (/[?&]sign=/i.test(rawData))         return true; // digital signature
  if (/[?&]mc=/i.test(rawData))           return true; // merchant category code
  if (/[?&](mid=|tid=)/i.test(rawData))   return true; // merchant/terminal IDs
  // Known merchant VPA suffixes used by payment gateways
  if (/pa=[^&]*@(razorpay|paytmmp|ibl|ybl|okhdfcbank|okaxis|oksbi|okicici|bharatpe|pinelabs|freecharge|airtelpay|jiopay|axisbank)/i.test(rawData)) return true;
  return false;
};

// ─── Component ────────────────────────────────────────────────────
export default function ScanScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned]           = useState(false);
  const [scanning, setScanning]         = useState(false);
  const processingRef                   = useRef(false);

  // Merchant modal state
  const [merchantData,    setMerchantData]    = useState(null); // { upiId, payeeName }
  const [showMerchant,    setShowMerchant]    = useState(false);
  const [copied,          setCopied]          = useState(false);

  // ── Hardware back button ────────────────────────────────────────
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showMerchant) { closeMerchantModal(); return true; }
      navigation.navigate('HomeTab');
      return true;
    });
    return () => handler.remove();
  }, [navigation, showMerchant]);

  // ── Reset on focus ──────────────────────────────────────────────
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      setScanned(false);
      processingRef.current = false;
      setShowMerchant(false);
      setCopied(false);
    });
    return unsub;
  }, [navigation]);

  // ── Merchant modal helpers ──────────────────────────────────────
  const closeMerchantModal = () => {
    setShowMerchant(false);
    setMerchantData(null);
    setCopied(false);
    setScanned(false);
    processingRef.current = false;
  };

  const copyUpiId = async (upiId) => {
    await Clipboard.setStringAsync(upiId);
    setCopied(true);
  };

  const openUpiApp = async (homeScheme) => {
    try {
      await Linking.openURL(homeScheme);
    } catch {
      Alert.alert('App not found', 'No compatible UPI app could be opened.');
    }
  };

  // ── Main QR result handler ──────────────────────────────────────
  const handleResult = async (data) => {
    const parsed = parseUPIData(data);
    if (!parsed?.upiId) {
      Alert.alert('Invalid QR', 'This is not a valid UPI QR code.', [
        { text: 'OK', onPress: () => { setScanned(false); processingRef.current = false; } },
      ]);
      return;
    }

    if (checkIsMerchant(data)) {
      // ── Merchant QR: copy UPI ID → show bottom sheet ──────
      await copyUpiId(parsed.upiId);
      setMerchantData(parsed);
      setShowMerchant(true);
    } else {
      // ── Normal P2P QR: navigate to PayScreen ─────────
      navigation.navigate('Pay', parsed);
    }
  };

  // ── Camera scan handler ─────────────────────────────────────────
  const handleBarCodeScanned = ({ data }) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setScanned(true);
    handleResult(data);
  };

  // ── Gallery scan ────────────────────────────────────────────────
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
        processingRef.current = true;
        setScanned(true);
        handleResult(response.values[0]);
      } else {
        Alert.alert('No QR Found', 'Could not detect a QR code in this image.');
      }
    } catch {
      setScanning(false);
      Alert.alert('Scan Error', 'Something went wrong scanning the image.');
    }
  };

  // ── Permission screens ──────────────────────────────────────────
  if (!permission) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centeredContainer}>
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

  // ── Main render ─────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* Camera — always live */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* ── Overlay ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

        {/* Top dim with title */}
        <View style={styles.dimTop}>
          <Text style={styles.scanTitle}>Scan UPI QR</Text>
          <Text style={styles.scanSub}>Point camera at a QR code</Text>
        </View>

        {/* Middle row: side dim | finder box | side dim */}
        <View style={styles.finderRow}>
          <View style={styles.dimSide} />
          <View style={styles.finder}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
            {scanned && <View style={styles.scanFlash} />}
          </View>
          <View style={styles.dimSide} />
        </View>

        {/* Bottom dim with buttons */}
        <View style={styles.dimBottom}>
          {scanning ? (
            <View style={styles.scanningIndicator}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.scanningText}>Scanning image…</Text>
            </View>
          ) : (
            <View style={{ width: '100%', paddingHorizontal: 24, gap: 12 }}>
              {/* Direct Log Button */}
              <TouchableOpacity
                style={styles.directLogBtn}
                onPress={() => navigation.navigate('Pay', { upiId: '', payeeName: '', amount: '', note: '', rawQueryString: '', isLogOnlyDefault: true })}
                activeOpacity={0.8}
              >
                <Text style={styles.directLogBtnText}>✍️ Direct Log (Record Locally)</Text>
              </TouchableOpacity>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.galleryBtn} onPress={handleGalleryScan} activeOpacity={0.8}>
                  <Text style={styles.galleryBtnText}>🖼️  Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.manualBtn}
                  onPress={() => navigation.navigate('Pay', { upiId: '', payeeName: '', amount: '', note: '', rawQueryString: '' })}
                  activeOpacity={0.8}
                >
                  <Text style={styles.manualBtnText}>Enter UPI ID</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* ── Merchant QR Modal ── */}
      <Modal
        visible={showMerchant}
        transparent
        animationType="slide"
        onRequestClose={closeMerchantModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.merchantSheet}>

            {/* Header */}
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>🏪 Merchant QR Detected</Text>
            <Text style={styles.sheetSub}>
              Merchant payments need to be done from inside your UPI app.
            </Text>

            {/* UPI ID display */}
            <View style={styles.upiIdCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.upiIdLabel}>UPI ID</Text>
                <Text style={styles.upiIdValue} numberOfLines={1}>
                  {merchantData?.upiId}
                </Text>
                {merchantData?.payeeName ? (
                  <Text style={styles.upiPayeeName}>{merchantData.payeeName}</Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={[styles.copyBtn, copied && styles.copyBtnDone]}
                onPress={() => copyUpiId(merchantData?.upiId)}
                activeOpacity={0.8}
              >
                <Text style={styles.copyBtnText}>{copied ? '✓ Copied' : '📋 Copy'}</Text>
              </TouchableOpacity>
            </View>

            {/* Instructions */}
            <View style={styles.instructionBox}>
              <Text style={styles.instructionText}>
                1. Copy the Merchant UPI ID above{'\n'}
                2. Tap 'Log Expense First' below to record the details{'\n'}
                3. Then open your standard UPI App to pay the merchant
              </Text>
            </View>

            {/* Bottom Sheet Actions */}
            <View style={{ gap: 10, marginTop: 10, marginBottom: 15 }}>
              <TouchableOpacity
                style={styles.sheetLogBtn}
                onPress={() => {
                  const parsed = merchantData;
                  closeMerchantModal();
                  navigation.navigate('Pay', {
                    ...parsed,
                    isLogOnlyDefault: true
                  });
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.sheetLogBtnText}>✍️ Log Expense First (Recommended)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetOpenAppBtn}
                onPress={() => openUpiApp('upi://')}
                activeOpacity={0.8}
              >
                <Text style={styles.sheetOpenAppBtnText}>🔓 Open UPI App Chooser to Pay</Text>
              </TouchableOpacity>
            </View>

            {/* Cancel */}
            <TouchableOpacity style={styles.closeBtn} onPress={closeMerchantModal} activeOpacity={0.8}>
              <Text style={styles.closeBtnText}>Cancel</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  centeredContainer: { flex: 1, backgroundColor: '#0A0A0F', justifyContent: 'center', alignItems: 'center' },

  // Permission card
  permCard: {
    backgroundColor: '#18181B', borderRadius: 24, padding: 32,
    alignItems: 'center', marginHorizontal: 24,
    borderWidth: 1, borderColor: '#27272A',
  },
  permTitle:   { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  permSub:     { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 24 },
  permBtn:     { backgroundColor: COLORS.accent, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  permBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // ── Overlay layout ──────────────────────────────────────────────
  dimTop: {
    backgroundColor: 'rgba(10,10,15,0.72)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 56,
    paddingBottom: 24,
    minHeight: 180,   // pushes finder box down into the screen center
  },
  scanTitle: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  scanSub:   { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 4 },

  finderRow: {
    flexDirection: 'row',
    height: FINDER_SIZE,
  },
  dimSide: {
    flex: 1,
    backgroundColor: 'rgba(10,10,15,0.72)',
  },
  finder: {
    width: FINDER_SIZE,
    height: FINDER_SIZE,
    position: 'relative',
  },

  // Corner markers
  corner:  { position: 'absolute', width: 28, height: 28, borderColor: COLORS.accent },
  tl: { top: 0,    left: 0,  borderTopWidth: 3, borderLeftWidth: 3,  borderTopLeftRadius: 8 },
  tr: { top: 0,    right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  bl: { bottom: 0, left: 0,  borderBottomWidth: 3, borderLeftWidth: 3,  borderBottomLeftRadius: 8 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },

  scanFlash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(124,106,255,0.18)', borderRadius: 4 },

  dimBottom: {
    flex: 1,
    backgroundColor: 'rgba(10,10,15,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },

  // Direct Log button
  directLogBtn: {
    backgroundColor: 'rgba(124, 106, 255, 0.12)',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.accent,
  },
  directLogBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },

  // Buttons
  actionRow:     { flexDirection: 'row', gap: 12 },
  galleryBtn:    { flex: 1, backgroundColor: COLORS.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  galleryBtnText:{ color: '#fff', fontSize: 15, fontWeight: '700' },
  manualBtn:     { flex: 1, backgroundColor: '#18181B', borderRadius: 999, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#3F3F46' },
  manualBtnText: { color: COLORS.accent, fontSize: 15, fontWeight: '700' },

  scanningIndicator: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#18181B', padding: 16, borderRadius: 16 },
  scanningText:      { color: '#fff', fontWeight: '600', fontSize: 14 },

  // ── Merchant Modal ──────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  merchantSheet: {
    backgroundColor: '#13131A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#3F3F46',
    alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 6 },
  sheetSub:   { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 18 },

  // UPI ID card
  upiIdCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#18181B', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: '#27272A',
    marginBottom: 14, gap: 12,
  },
  upiIdLabel:   { color: COLORS.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  upiIdValue:   { color: '#fff', fontSize: 15, fontWeight: '700' },
  upiPayeeName: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  copyBtn:     { backgroundColor: COLORS.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  copyBtnDone: { backgroundColor: COLORS.green },
  copyBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Instructions
  instructionBox: {
    backgroundColor: '#1C1C28', borderRadius: 14,
    padding: 14, marginBottom: 18,
    borderWidth: 1, borderColor: 'rgba(124,106,255,0.2)',
  },
  instructionText: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 22 },

  sheetLogBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  sheetLogBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  sheetOpenAppBtn: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#3F3F46',
  },
  sheetOpenAppBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Close
  closeBtn:     { backgroundColor: '#18181B', borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#27272A' },
  closeBtnText: { color: COLORS.red, fontWeight: '700', fontSize: 15 },
});
