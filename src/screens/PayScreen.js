import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, formatCurrency } from '../utils/theme';
import { useExpenses } from '../hooks/useExpenses';
import CategoryPicker from '../components/CategoryPicker';
import ContactPicker from '../components/ContactPicker';
import BottomSheet from '../components/BottomSheet';
import UPIAppChooser from '../components/UPIAppChooser';

export default function PayScreen({ route, navigation }) {
  const params = route.params || {};
  const { addExpense } = useExpenses();

  const [upiId, setUpiId] = useState(params.upiId || '');
  const [payeeName, setPayeeName] = useState(params.payeeName || '');
  const [amount, setAmount] = useState(params.amount || '');
  const [category, setCategory] = useState('other');
  const [note, setNote] = useState(params.note || '');
  const [contact, setContact] = useState(null);
  const [showContacts, setShowContacts] = useState(false);
  const [showUPISheet, setShowUPISheet] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);

  const canPay = upiId.trim().length > 0 && Number(amount) > 0;

  const handlePay = () => {
    if (!canPay) {
      Alert.alert('Missing Info', 'Please enter UPI ID and amount');
      return;
    }
    setShowUPISheet(true);
  };

  const handleAppSelected = (app) => {
    setSelectedApp(app);
    setShowUPISheet(false);

    setTimeout(() => {
      Alert.alert('Payment Confirmation', 'Was the payment successful?', [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: async () => {
            await addExpense({
              amount: Number(amount),
              category,
              upiId,
              payeeName,
              note,
              contactName: contact?.name || '',
              contactPhone: contact?.phone || '',
              upiApp: app.id,
            });
            Alert.alert('Logged! ✓', `${formatCurrency(amount)} expense recorded`);
            navigation.goBack();
          },
        },
      ]);
    }, 1000);
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
  sheetTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.xl, fontWeight: '700', marginBottom: 4 },
  sheetSub: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, marginBottom: 16 },
});
