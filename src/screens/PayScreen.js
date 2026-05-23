import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Linking, Switch, Image, Modal, BackHandler,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  COLORS, SPACING, FONT_SIZE, BORDER_RADIUS,
  formatCurrency, CATEGORIES,
} from '../utils/theme';
import { useExpenses, useGroups } from '../hooks/useExpenses';
import CategoryPicker from '../components/CategoryPicker';
import ContactPicker from '../components/ContactPicker';

export default function PayScreen({ route, navigation }) {
  const params        = route.params || {};
  const rawQS         = params.rawQueryString || '';
  const isMerchantQR  = rawQS.length > 0;

  // ── Does this merchant QR carry a digital signature? ──────────
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
  const [splitType, setSplitType] = useState('equal'); // 'equal' or 'custom'
  const [customShares, setCustomShares] = useState({}); // phone -> amount string

  // For local logs, payee/merchant name is completely optional! Only amount is required.
  const canSave = Number(amount) > 0;
  const canPay = (upiId || '').trim().length > 0 && (Number(amount) > 0 || isMerchantQR);

  // Hardware back button — close this modal screen
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.goBack();
      return true;
    });
    return () => handler.remove();
  }, [navigation]);

  /**
   * UPI URL Builder — NPCI-compliant
   */
  const buildUPIUrl = (appScheme) => {
    const scheme = appScheme || 'upi://pay';

    if (isMerchantQR && rawQS) {
      if (hasSign) {
        return `${scheme}?${rawQS}`;
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

  const recalculateBalances = (members, expenses) => {
    const newMembers = members.map(m => ({ ...m, balance: 0, totalSpent: 0 }));
    expenses.forEach(exp => {
      const amount = Number(exp.amount);
      
      if (exp.shares) {
        // Custom split: use explicit shares map
        newMembers.forEach(m => {
          const share = exp.shares[m.phone] || 0;
          if (m.phone === exp.payerPhone) {
            m.balance += (amount - share);
            m.totalSpent += amount;
          } else {
            m.balance -= share;
          }
        });
      } else if (exp.splitMembers && exp.splitMembers.length > 0) {
        // Partial split: divide equally among splitMembers (payer optional)
        const payerInSplit = exp.splitMembers.includes(exp.payerPhone);
        const divisor = exp.splitMembers.length + (payerInSplit ? 0 : 1);
        const perPerson = amount / divisor;
        
        newMembers.forEach(m => {
          const isInSplit = exp.splitMembers.includes(m.phone);
          const isPayer = m.phone === exp.payerPhone;
          
          if (isPayer) {
            const payerShare = payerInSplit ? perPerson : 0;
            m.balance += (amount - payerShare);
            m.totalSpent += amount;
          } else if (isInSplit) {
            m.balance -= perPerson;
          }
        });
      } else {
        // Equal split among all members
        const perPerson = amount / members.length;
        newMembers.forEach(m => {
          if (m.phone === exp.payerPhone) {
            m.balance += (amount - perPerson);
            m.totalSpent += amount;
          } else {
            m.balance -= perPerson;
          }
        });
      }
    });
    return newMembers;
  };

  const openApp = async () => {
    if (!canPay) {
      Alert.alert('Missing Info', 'Enter UPI ID and amount first');
      return;
    }
    const url = buildUPIUrl('upi://pay');

    try {
      await Linking.openURL(url);
      setTimeout(() => {
        Alert.alert(
          'Payment Done?',
          `Did the payment go through?`,
          [
            { text: 'No', style: 'cancel' },
            {
              text: 'Yes — Log it',
              onPress: async () => {
                const getFallbackPayee = () => {
                  const cat = CATEGORIES.find(c => c.id === category);
                  return cat ? `${cat.emoji} ${cat.name} Expense` : 'Logged Expense';
                };
                const finalPayee = payeeName.trim() || upiId.trim() || getFallbackPayee();
                const expAmount = Number(amount);
                const expNote = note || `To ${finalPayee}`;

                await addExpense({
                  amount: expAmount,
                  category,
                  upiId,
                  payeeName: finalPayee,
                  note: expNote,
                  contactName:  contact?.name  || finalPayee || '',
                  contactPhone: contact?.phone || '',
                  upiApp: 'UPI App',
                });

                // Handle group split functional logic
                if (splitGroupId && selectedMembers.length > 0) {
                  const group = groups.find(g => g.id === splitGroupId);
                  if (group) {
                    let updatedExpenses;
                    if (splitType === 'custom') {
                      const sharesObj = {};
                      selectedMembers.forEach(phone => {
                        sharesObj[phone] = Number(customShares[phone]) || 0;
                      });
                      sharesObj['self'] = selfShare;

                      updatedExpenses = [...group.expenses, {
                        id: Date.now().toString(),
                        title: expNote,
                        amount: expAmount,
                        payerPhone: 'self',
                        shares: sharesObj,
                        date: new Date().toISOString()
                      }];
                    } else {
                      updatedExpenses = [...group.expenses, {
                        id: Date.now().toString(),
                        title: expNote,
                        amount: expAmount,
                        payerPhone: 'self',
                        splitMembers: [...selectedMembers, 'self'],
                        date: new Date().toISOString()
                      }];
                    }

                    const updatedMembers = recalculateBalances(group.members, updatedExpenses);
                    await updateGroup(group.id, { expenses: updatedExpenses, members: updatedMembers });
                  }
                }

                Alert.alert('✓ Recorded', `${formatCurrency(amount)} logged`);
                navigation.navigate('Home');
              },
            },
          ],
        );
      }, 1500);
    } catch {
      Alert.alert('Could not open UPI app', 'Make sure a UPI payment app is installed on your phone.');
    }
  };

  const handleLogLocallyOnly = async () => {
    if (!canSave) {
      Alert.alert('Missing Info', 'Enter amount to log expense');
      return;
    }
    try {
      const getFallbackPayee = () => {
        const cat = CATEGORIES.find(c => c.id === category);
        return cat ? `${cat.emoji} ${cat.name} Expense` : 'Manual Log';
      };
      const finalPayee = payeeName.trim() || upiId.trim() || getFallbackPayee();
      const expAmount = Number(amount);
      const expNote = note || `Logged: ${finalPayee}`;

      await addExpense({
        amount: expAmount,
        category,
        upiId,
        payeeName: finalPayee,
        note: expNote,
        contactName:  contact?.name  || finalPayee || '',
        contactPhone: contact?.phone || '',
        upiApp: 'Local Log',
      });

      // Handle group split functional logic
      if (splitGroupId && selectedMembers.length > 0) {
        const group = groups.find(g => g.id === splitGroupId);
        if (group) {
          let updatedExpenses;
          if (splitType === 'custom') {
            const sharesObj = {};
            selectedMembers.forEach(phone => {
              sharesObj[phone] = Number(customShares[phone]) || 0;
            });
            sharesObj['self'] = selfShare;

            updatedExpenses = [...group.expenses, {
              id: Date.now().toString(),
              title: expNote,
              amount: expAmount,
              payerPhone: 'self',
              shares: sharesObj,
              date: new Date().toISOString()
            }];
          } else {
            updatedExpenses = [...group.expenses, {
              id: Date.now().toString(),
              title: expNote,
              amount: expAmount,
              payerPhone: 'self',
              splitMembers: [...selectedMembers, 'self'],
              date: new Date().toISOString()
            }];
          }

          const updatedMembers = recalculateBalances(group.members, updatedExpenses);
          await updateGroup(group.id, { expenses: updatedExpenses, members: updatedMembers });
        }
      }

      Alert.alert('✓ Recorded Locally', `${formatCurrency(amount)} logged successfully.`);
      navigation.navigate('Home');
    } catch (err) {
      Alert.alert('Error', 'Could not record expense.');
    }
  };

  const handleToggleGroup = (id) => {
    if (splitGroupId === id) {
      setSplitGroupId(null);
      setSelectedMembers([]);
      setSplitType('equal');
      setCustomShares({});
    } else {
      setSplitGroupId(id);
      setSplitType('equal');
      setCustomShares({});
      const g = groups.find(g => g.id === id);
      if (g) setSelectedMembers(g.members.filter(m => m.phone !== 'self').map(m => m.phone));
    }
  };

  const updateCustomShare = (phone, val) => {
    setCustomShares(prev => ({
      ...prev,
      [phone]: val
    }));
  };

  const totalCustomSplitAmount = splitType === 'custom'
    ? selectedMembers.reduce((sum, phone) => sum + (Number(customShares[phone]) || 0), 0)
    : 0;

  const selfShare = splitType === 'custom'
    ? Number(amount) - totalCustomSplitAmount
    : Number(amount) / (selectedMembers.length + 1);

  const perShare = splitGroupId && amount
    ? (splitType === 'custom'
        ? (selfShare < 0 ? '⚠️ Invalid custom shares sum' : `Your share: ${formatCurrency(selfShare)}`)
        : `Your share: ${formatCurrency(selfShare)} each`)
    : null;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.cancelBtn} onPress={() => navigation.goBack()} hitSlop={{ top:12,bottom:12,left:12,right:12 }}>
          <Text style={s.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{params.isLogOnlyDefault ? 'Record Expense' : 'Pay & Log'}</Text>
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
              <Text style={s.label}>UPI ID (Optional for Log Only)</Text>
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
              placeholder="Payee/Merchant Name"
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
                  <Text style={s.memberSelectTitle}>Split Type:</Text>
                  <View style={s.typeRow}>
                    {['equal', 'custom'].map((t) => (
                      <TouchableOpacity key={t} style={[s.typeBtn, splitType === t && s.typeBtnActive]} onPress={() => setSplitType(t)}>
                        <Text style={[s.typeBtnText, splitType === t && { color: COLORS.accent }]}>{t === 'equal' ? '⚖️ Equal' : '✏️ Custom'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  
                  <Text style={[s.memberSelectTitle, { marginTop: 12 }]}>Members in split:</Text>
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

                  {splitType === 'custom' && selectedMembers.length > 0 && (
                    <View style={{ marginTop: 16, gap: 10 }}>
                      <Text style={s.memberSelectTitle}>Enter Custom Shares (₹):</Text>
                      {selectedMembers.map(phone => {
                        const mObj = groups.find(g => g.id === splitGroupId)?.members.find(m => m.phone === phone);
                        if (!mObj) return null;
                        return (
                          <View key={phone} style={s.customShareRow}>
                            <Text style={s.customShareName}>{mObj.name}</Text>
                            <TextInput
                              style={s.customShareInput}
                              placeholder="0"
                              placeholderTextColor={COLORS.textMuted}
                              value={customShares[phone] || ''}
                              onChangeText={val => updateCustomShare(phone, val)}
                              keyboardType="numeric"
                            />
                          </View>
                        );
                      })}
                    </View>
                  )}
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

        {/* Actions Section */}
        <View style={{ gap: 12, marginTop: 12 }}>
          {params.isLogOnlyDefault ? (
            /* Log locally only */
            <TouchableOpacity
              style={[s.payBtn, !canSave && s.payBtnDisabled]}
              onPress={handleLogLocallyOnly}
              disabled={!canSave}
              activeOpacity={0.8}
            >
              <Text style={s.payBtnText}>✍️ Save Log</Text>
            </TouchableOpacity>
          ) : (
            /* Pay & Log via generic phone chooser */
            <TouchableOpacity
              style={[s.payBtn, !canPay && s.payBtnDisabled]}
              onPress={openApp}
              disabled={!canPay}
              activeOpacity={0.8}
            >
              <Text style={s.payBtnText}>
                {amount ? `💸 Pay & Log ${formatCurrency(amount)}` : '💸 Pay & Log via UPI App'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

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
  payBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },

  logLocallyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1C1C28', borderRadius: 18, paddingVertical: 17, gap: 8, borderWidth: 1.5, borderColor: COLORS.accent },
  logLocallyBtnDisabled: { opacity: 0.35 },
  logLocallyBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  typeRow: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  typeBtn: { flex: 1, backgroundColor: '#27272A', borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: '#3F3F46' },
  typeBtnActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accent + '20' },
  typeBtnText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },
  customShareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#27272A', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: '#3F3F46' },
  customShareName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  customShareInput: { backgroundColor: '#18181B', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, color: '#fff', fontSize: 14, fontWeight: '700', minWidth: 70, textAlign: 'right', borderWidth: 1, borderColor: '#3F3F46' },
});
