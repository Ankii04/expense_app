import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, formatCurrency } from '../utils/theme';
import { useExpenses, useGroups } from '../hooks/useExpenses';
import CategoryPicker from '../components/CategoryPicker';
import ContactPicker from '../components/ContactPicker';

export default function PayScreen({ route, navigation }) {
  const params = route.params || {};
  const { addExpense } = useExpenses();
  const { groups, updateGroup, refresh: refreshGroups } = useGroups();

  const [upiId, setUpiId] = useState(params.upiId || '');
  const [payeeName, setPayeeName] = useState(params.payeeName || '');
  const [amount, setAmount] = useState(params.amount || '');
  const [category, setCategory] = useState('other');
  const [note, setNote] = useState(params.note || '');
  const [contact, setContact] = useState(null);
  const [showContacts, setShowContacts] = useState(false);
  
  // Group split state
  const [splitGroupId, setSplitGroupId] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);

  const canPay = upiId.trim().length > 0 && Number(amount) > 0;

  const handlePay = async () => {
    if (!canPay) {
      Alert.alert('Missing Info', 'Please enter UPI ID and amount');
      return;
    }

    const url = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName || upiId)}&am=${amount}&tn=${encodeURIComponent(note || 'Antigravity')}&cu=INR`;
    
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        
        // Confirmation alert after app switch
        setTimeout(() => {
          Alert.alert('Payment Successful?', 'Has the payment been completed?', [
            { text: 'No', style: 'cancel' },
            {
              text: 'Yes, Log it',
              onPress: async () => {
                const expAmount = Number(amount);
                const expNote = note || `To ${payeeName || upiId}`;
                
                // 1. Log personal expense
                await addExpense({
                  amount: expAmount,
                  category,
                  upiId,
                  payeeName,
                  note: expNote,
                  contactName: contact?.name || '',
                  contactPhone: contact?.phone || '',
                });

                // 2. Handle group split
                if (splitGroupId && selectedMembers.length > 0) {
                  const group = groups.find(g => g.id === splitGroupId);
                  if (group) {
                    const perPerson = expAmount / (selectedMembers.length + 1);
                    const updatedExpenses = [...group.expenses, {
                      id: Date.now().toString(),
                      title: expNote,
                      amount: expAmount,
                      payerPhone: 'self',
                      date: new Date().toISOString()
                    }];

                    const updatedMembers = group.members.map(m => {
                      let newBalance = m.balance || 0;
                      if (selectedMembers.includes(m.phone)) {
                        newBalance -= perPerson;
                      }
                      return { ...m, balance: newBalance };
                    });

                    await updateGroup(group.id, { expenses: updatedExpenses, members: updatedMembers });
                  }
                }

                Alert.alert('Recorded! ✓', `${formatCurrency(amount)} payment logged`);
                navigation.navigate('Home');
              },
            },
          ]);
        }, 1500);
      } else {
        Alert.alert('Error', 'No UPI apps found on this device');
      }
    } catch (err) {
      Alert.alert('Error', 'Could not launch payment app');
    }
  };

  const handleToggleGroup = (groupId) => {
    if (splitGroupId === groupId) {
      setSplitGroupId(null);
      setSelectedMembers([]);
    } else {
      setSplitGroupId(groupId);
      const group = groups.find(g => g.id === groupId);
      if (group) {
        setSelectedMembers(group.members.filter(m => m.phone !== 'self').map(m => m.phone));
      }
    }
  };

  const toggleMember = (phone) => {
    if (selectedMembers.includes(phone)) {
      setSelectedMembers(selectedMembers.filter(p => p !== phone));
    } else {
      setSelectedMembers([...selectedMembers, phone]);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Pay via UPI</Text>

        {/* UPI ID */}
        <Text style={styles.label}>UPI ID</Text>
        <TextInput style={styles.input} placeholder="name@bank" placeholderTextColor={COLORS.textMuted} value={upiId} onChangeText={setUpiId} autoCapitalize="none" keyboardType="email-address" />

        {/* Payee Name */}
        <Text style={styles.label}>Payee Name</Text>
        <TextInput style={styles.input} placeholder="John Doe" placeholderTextColor={COLORS.textMuted} value={payeeName} onChangeText={setPayeeName} />

        {/* Amount */}
        <Text style={styles.label}>Amount (₹)</Text>
        <TextInput style={[styles.input, styles.amountInput]} placeholder="0" placeholderTextColor={COLORS.textMuted} value={amount} onChangeText={setAmount} keyboardType="numeric" />

        {/* Category */}
        <Text style={styles.label}>Category</Text>
        <CategoryPicker selected={category} onSelect={setCategory} />

        {/* Contact */}
        <Text style={styles.label}>Contact (optional)</Text>
        <TouchableOpacity style={styles.contactBtn} onPress={() => setShowContacts(true)}>
          <Text style={contact ? styles.contactText : styles.contactPlaceholder}>
            {contact ? `${contact.name} • ${contact.phone}` : 'Pick from contacts'}
          </Text>
          <Text style={styles.contactArrow}>→</Text>
        </TouchableOpacity>

        {/* Note */}
        <Text style={styles.label}>Note</Text>
        <TextInput style={styles.input} placeholder="What's this for?" placeholderTextColor={COLORS.textMuted} value={note} onChangeText={setNote} />

        {/* Group Split Section */}
        {groups.length > 0 && (
          <>
            <Text style={styles.label}>Split with Group</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupScroll}>
              {groups.map(g => (
                <TouchableOpacity 
                  key={g.id} 
                  style={[styles.groupChip, splitGroupId === g.id && styles.groupChipActive]} 
                  onPress={() => handleToggleGroup(g.id)}
                >
                  <Text style={[styles.groupChipText, splitGroupId === g.id && { color: '#fff' }]}>{g.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {splitGroupId && (
              <View style={styles.memberSelectBox}>
                 <Text style={styles.memberSelectTitle}>Include these members in the split:</Text>
                 <View style={styles.memberGrid}>
                    {groups.find(g => g.id === splitGroupId)?.members.filter(m => m.phone !== 'self').map(m => (
                      <TouchableOpacity 
                        key={m.phone} 
                        style={[styles.memberChip, selectedMembers.includes(m.phone) && styles.memberChipActive]}
                        onPress={() => toggleMember(m.phone)}
                      >
                        <Text style={[styles.memberChipText, selectedMembers.includes(m.phone) && { color: '#fff' }]}>{m.name}</Text>
                      </TouchableOpacity>
                    ))}
                 </View>
              </View>
            )}
          </>
        )}

        {/* Pay Button */}
        <TouchableOpacity style={[styles.payBtn, !canPay && styles.payBtnDisabled]} onPress={handlePay} disabled={!canPay}>
          <Text style={styles.payBtnText}>Pay {amount ? formatCurrency(amount) : ''}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Contact Picker Modal */}
      <ContactPicker visible={showContacts} onClose={() => setShowContacts(false)} onSelect={(c) => setContact(c)} />

      {/* UPI App Chooser Bottom Sheet */}
      <BottomSheet visible={showUPISheet} onClose={() => setShowUPISheet(false)} snapPoint={0.5}>
        <Text style={styles.sheetTitle}>Choose UPI App</Text>
        <Text style={styles.sheetSub}>Pay {formatCurrency(amount)} to {payeeName || upiId}</Text>
        <UPIAppChooser upiId={upiId} payeeName={payeeName} amount={amount} note={note} onAppSelected={handleAppSelected} />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingTop: 60, paddingHorizontal: SPACING.xl, paddingBottom: 40 },
  title: { color: COLORS.textPrimary, fontSize: FONT_SIZE.xxxl, fontWeight: '800', marginBottom: 24, letterSpacing: -0.5 },
  label: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: '600', marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, paddingHorizontal: 16, paddingVertical: 14, color: COLORS.textPrimary, fontSize: FONT_SIZE.md, borderWidth: 1, borderColor: COLORS.border },
  amountInput: { fontSize: FONT_SIZE.xxl, fontWeight: '700' },
  contactBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: COLORS.border },
  contactText: { flex: 1, color: COLORS.textPrimary, fontSize: FONT_SIZE.md },
  contactPlaceholder: { flex: 1, color: COLORS.textMuted, fontSize: FONT_SIZE.md },
  contactArrow: { color: COLORS.accent, fontSize: 18 },
  payBtn: { backgroundColor: COLORS.accent, borderRadius: BORDER_RADIUS.md, paddingVertical: 16, alignItems: 'center', marginTop: 32, shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  payBtnDisabled: { opacity: 0.4 },
  payBtnText: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: '800' },
  groupScroll: { flexDirection: 'row', marginBottom: 12 },
  groupChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: COLORS.elevated, marginRight: 10, borderWidth: 1, borderColor: COLORS.border },
  groupChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  groupChipText: { color: COLORS.textSecondary, fontWeight: '600' },
  memberSelectBox: { backgroundColor: COLORS.elevated, padding: 16, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, marginTop: 8 },
  memberSelectTitle: { color: COLORS.textMuted, fontSize: 12, marginBottom: 12, fontWeight: '600' },
  memberGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memberChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  memberChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  memberChipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
});
