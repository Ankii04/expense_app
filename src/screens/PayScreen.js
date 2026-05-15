import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Linking, Switch, Image, Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  COLORS, SPACING, FONT_SIZE, BORDER_RADIUS,
  formatCurrency, CATEGORIES,
} from '../utils/theme';
import { useExpenses, useGroups } from '../hooks/useExpenses';
import CategoryPicker from '../components/CategoryPicker';
import ContactPicker from '../components/ContactPicker';

const UPI_APPS_LIST = [
  { id: 'gpay',      name: 'Google Pay', emoji: '🟢', scheme: 'tez://upi/pay'       },
  { id: 'phonepe',   name: 'PhonePe',    emoji: '🟣', scheme: 'phonepe://pay'        },
  { id: 'paytm',     name: 'Paytm',      emoji: '🔵', scheme: 'paytmmp://pay'        },
  { id: 'bhim',      name: 'BHIM',       emoji: '🟠', scheme: 'upi://pay'            },
  { id: 'cred',      name: 'CRED',       emoji: '⚫', scheme: 'credpay://upi/pay'    },
  { id: 'amazonpay', name: 'Amazon',     emoji: '🟡', scheme: 'amazonpay://pay'      },
];

export default function PayScreen({ route, navigation }) {
  const params        = route.params || {};
  const rawQS         = params.rawQueryString || '';
  const isMerchantQR  = rawQS.length > 0;

  // ── Does this merchant QR carry a digital signature? ──────────
  // If yes → ANY modification (even changing am=) breaks the signature
  // and the bank returns "restricted to receiver"
  const hasSign = isMerchantQR && /(?:^|&)sign=/i.test(rawQS);

  const { addExpense } = useExpenses();
  const { groups, updateGroup } = useGroups();

  const [upiId,    setUpiId]    = useState(params.upiId    || '');
  const [payeeName,setPayeeName]= useState(params.payeeName|| '');
  // If signed QR: amount is LOCKED by merchant, user cannot change it
  const [amount,   setAmount]   = useState(params.amount   || '');
  const [category, setCategory] = useState('other');
  const [note,     setNote]     = useState(params.note     || '');
  const [contact,  setContact]  = useState(null);
  const [showContacts,  setShowContacts]  = useState(false);
  const [splitGroupId,  setSplitGroupId]  = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [recordAsLend, setRecordAsLend] = useState(false);

  const canPay = upiId.trim().length > 0 && (Number(amount) > 0 || isMerchantQR);

  /**
   * UPI URL Builder — NPCI-compliant
   *
   * Rule: If raw QR has sign= → NEVER touch any parameter.
   *       Open the URL byte-for-byte as scanned.
   *
   * Rule: If raw QR has no sign= → safe to substitute am= only.
   *
   * Rule: Manual entry → build fresh with only needed params.
   */
  const buildUPIUrl = (appScheme) => {
    const scheme = appScheme || 'upi://pay';

    if (isMerchantQR && rawQS) {
      if (hasSign) {
        // Signed QR: pass EXACTLY as scanned — do NOT modify ANYTHING
        return `upi://pay?${rawQS}`;
      }

      // Unsigned merchant QR: safe to substitute amount
      let q = rawQS;
      if (amount) {
        const amt = Number(amount).toFixed(2);
        q = q.includes('am=')
          ? q.replace(/am=[^&]*/i, `am=${amt}`)
          : `${q}&am=${amt}`;
      }
      if (!q.includes('cu=')) q += '&cu=INR';
      return `${scheme}?${q}`;
    }

    // Manual / P2P entry
    const parts = [];
    parts.push(`pa=${encodeURIComponent(upiId.trim())}`);
    if (payeeName) parts.push(`pn=${encodeURIComponent(payeeName.trim())}`);
    if (amount)    parts.push(`am=${Number(amount).toFixed(2)}`);
    if (note)      parts.push(`tn=${encodeURIComponent(note.trim())}`);
    parts.push('cu=INR');
    return `${scheme}?${parts.join('&')}`;
  };

  const openApp = async (app) => {
    if (!canPay) {
      Alert.alert('Missing Info', 'Enter UPI ID and amount first');
      return;
    }
    const url = buildUPIUrl(app?.scheme);

    try {
      await Linking.openURL(url);
      setTimeout(() => {
        Alert.alert(
          'Payment Done?',
          `Did the payment go through${app ? ` via ${app.name}` : ''}?`,
          [
            { text: 'No', style: 'cancel' },
            {
              text: 'Yes — Log it',
              onPress: async () => {
                await addExpense({
                  amount: Number(amount),
                  category,
                  upiId,
                  payeeName,
                  note: note || `To ${payeeName || upiId}`,
                  contactName:  contact?.name  || payeeName || '',
                  contactPhone: contact?.phone || '',
                  upiApp: app?.name || '',
                });
                Alert.alert('✓ Recorded', `${formatCurrency(amount)} logged`);
                navigation.navigate('Home');
              },
            },
          ],
        );
      }, 1500);
    } catch {
      Alert.alert('Could not open UPI app', 'Try another payment app or check if it\'s installed.');
    }
  };

  const handleToggleGroup = (id) => {
    if (splitGroupId === id) {
      setSplitGroupId(null);
      setSelectedMembers([]);
    } else {
      setSplitGroupId(id);
      const g = groups.find(g => g.id === id);
      if (g) setSelectedMembers(g.members.filter(m => m.phone !== 'self').map(m => m.phone));
    }
  };

  const perShare = splitGroupId && amount
    ? formatCurrency(Number(amount) / (selectedMembers.length + 1))
    : null;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.cancelBtn} onPress={() => navigation.goBack()} hitSlop={{ top:12,bottom:12,left:12,right:12 }}>
          <Text style={s.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Pay Now</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      >
        {/* UPI ID line */}
        {isMerchantQR && upiId
          ? <Text style={s.upiSmall}>{upiId}</Text>
          : (
            <View style={s.inputGroup}>
              <Text style={s.label}>UPI ID</Text>
              <TextInput
                style={s.input}
                placeholder="name@bank"
                placeholderTextColor={COLORS.textMuted}
                value={upiId}
                onChangeText={setUpiId}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
          )
        }

        {/* Amount — locked if signed merchant QR */}
        <View style={s.amountContainer}>
          <Text style={s.rupeeSign}>₹</Text>
          <TextInput
            style={s.amountInput}
            placeholder="0"
            placeholderTextColor={COLORS.textMuted}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            editable={!hasSign}   // locked for signed merchant QRs
          />
        </View>

        {hasSign && (
          <View style={s.signedBadge}>
            <Text style={s.signedBadgeText}>🔒 Amount set by merchant (signed QR)</Text>
          </View>
        )}
        {perShare && <Text style={s.perShareText}>Your share: {perShare} each</Text>}

        {/* Category chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[s.catChip, category === cat.id && s.catChipActive]}
              onPress={() => setCategory(cat.id)}
              activeOpacity={0.7}
            >
              <Text style={s.catChipEmoji}>{cat.emoji}</Text>
              <Text style={[s.catChipText, category === cat.id && s.catChipTextActive]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Merchant / note card */}
        <View style={s.card}>
          <View style={s.cardRow}>
            <Text style={s.cardIcon}>👤</Text>
            <Text style={s.cardValue} numberOfLines={1}>
              {payeeName || (isMerchantQR ? 'Merchant' : 'Payee')}
            </Text>
          </View>
          {!isMerchantQR && (
            <TextInput
              style={[s.input, { marginTop: 8 }]}
              placeholder="Payee Name"
              placeholderTextColor={COLORS.textMuted}
              value={payeeName}
              onChangeText={setPayeeName}
            />
          )}
          <View style={[s.cardRow, { marginTop: 12 }]}>
            <Text style={s.cardIcon}>📝</Text>
            <TextInput
              style={[s.noteInput, { flex: 1 }]}
              placeholder="What's this for?"
              placeholderTextColor={COLORS.textMuted}
              value={note}
              onChangeText={setNote}
            />
          </View>
        </View>

        {/* Split Bill */}
        {groups.length > 0 && (
          <>
            <Text style={s.sectionLabel}>Split Bill</Text>
            <View style={s.card}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {groups.map(g => (
                  <TouchableOpacity
                    key={g.id}
                    style={[s.groupChip, splitGroupId === g.id && s.groupChipActive]}
                    onPress={() => handleToggleGroup(g.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.groupChipText, splitGroupId === g.id && { color: '#fff' }]}>
                      {g.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {splitGroupId && (
                <View style={{ marginTop: 12 }}>
                  <Text style={s.memberSelectTitle}>Members in split:</Text>
                  <View style={s.memberGrid}>
                    {groups.find(g => g.id === splitGroupId)?.members
                      .filter(m => m.phone !== 'self')
                      .map(m => (
                        <TouchableOpacity
                          key={m.phone}
                          style={[s.memberChip, selectedMembers.includes(m.phone) && s.memberChipActive]}
                          onPress={() => setSelectedMembers(prev =>
                            prev.includes(m.phone) ? prev.filter(p => p !== m.phone) : [...prev, m.phone]
                          )}
                          activeOpacity={0.7}
                        >
                          <Text style={[s.memberChipText, selectedMembers.includes(m.phone) && { color: '#fff' }]}>
                            {m.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                </View>
              )}
            </View>
          </>
        )}

        {/* Record as Lend */}
        <View style={s.toggleRow}>
          <View style={s.toggleLeft}>
            <Text style={s.toggleIcon}>🤝</Text>
            <View>
              <Text style={s.toggleLabel}>Record as Lend</Text>
              <Text style={s.toggleSub}>Track this as money lent</Text>
            </View>
          </View>
          <Switch
            value={recordAsLend}
            onValueChange={setRecordAsLend}
            trackColor={{ false: COLORS.elevated, true: COLORS.accent + '60' }}
            thumbColor={recordAsLend ? COLORS.accent : COLORS.textMuted}
          />
        </View>

        {/* Contact link */}
        <TouchableOpacity
          style={s.contactRow}
          onPress={() => setShowContacts(true)}
          activeOpacity={0.7}
        >
          <Text style={s.contactRowIcon}>👥</Text>
          <Text style={contact ? s.contactText : s.contactPlaceholder}>
            {contact ? `${contact.name} · ${contact.phone}` : 'Link to contact (optional)'}
          </Text>
          <Text style={s.contactArrow}>›</Text>
        </TouchableOpacity>

        {/* Pay button */}
        <TouchableOpacity
          style={[s.payBtn, !canPay && s.payBtnDisabled]}
          onPress={() => openApp(null)}
          disabled={!canPay}
          activeOpacity={0.8}
        >
          <Text style={s.payBtnText}>
            {amount ? `Pay ${formatCurrency(amount)}` : 'Pay Now'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <ContactPicker
        visible={showContacts}
        onClose={() => setShowContacts(false)}
        onSelect={c => { setContact(c); setShowContacts(false); }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  cancelBtn: { borderWidth: 1.5, borderColor: COLORS.red, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  cancelText: { color: COLORS.red, fontWeight: '700', fontSize: 14 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  upiSmall: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center', marginBottom: 4 },
  content: { paddingHorizontal: 20, paddingTop: 16 },
  inputGroup: { marginBottom: 8 },
  label: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  input: { backgroundColor: '#18181B', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#27272A' },

  amountContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 20 },
  rupeeSign: { color: COLORS.red, fontSize: 40, fontWeight: '800', marginRight: 4 },
  amountInput: { color: '#fff', fontSize: 60, fontWeight: '800', minWidth: 100, textAlign: 'center' },

  signedBadge: { backgroundColor: '#27272A', borderRadius: 10, padding: 10, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#3F3F46' },
  signedBadgeText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },
  perShareText: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center', marginBottom: 12 },

  catScroll: { marginBottom: 16 },
  catChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181B', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: '#27272A', gap: 6 },
  catChipActive: { backgroundColor: COLORS.accent + '25', borderColor: COLORS.accent },
  catChipEmoji: { fontSize: 14 },
  catChipText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },
  catChipTextActive: { color: COLORS.accent },

  card: { backgroundColor: '#18181B', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#27272A', marginBottom: 16 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: { fontSize: 18 },
  cardValue: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  noteInput: { color: '#fff', fontSize: 15, paddingVertical: 4 },

  sectionLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12, marginTop: 4 },

  groupChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#27272A', marginRight: 8, borderWidth: 1, borderColor: '#3F3F46' },
  groupChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  groupChipText: { color: COLORS.textMuted, fontWeight: '600', fontSize: 13 },
  memberSelectTitle: { color: COLORS.textMuted, fontSize: 11, marginBottom: 10, fontWeight: '600' },
  memberGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memberChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#27272A', borderWidth: 1, borderColor: '#3F3F46' },
  memberChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  memberChipText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#18181B', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#27272A', marginBottom: 16 },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleIcon: { fontSize: 22 },
  toggleLabel: { color: '#fff', fontWeight: '700', fontSize: 15 },
  toggleSub: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },

  contactRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181B', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#27272A', marginBottom: 24, gap: 10 },
  contactRowIcon: { fontSize: 18 },
  contactText: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },
  contactPlaceholder: { flex: 1, color: COLORS.textMuted, fontSize: 14 },
  contactArrow: { color: COLORS.accent, fontSize: 22, fontWeight: '300' },

  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E05D2A', borderRadius: 18, paddingVertical: 18, gap: 8, elevation: 10, shadowColor: '#E05D2A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16 },
  payBtnDisabled: { opacity: 0.35 },
  payBtnText: { color: '#fff', fontSize: 20, fontWeight: '800' },
});
