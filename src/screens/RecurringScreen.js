import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert, Switch } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, formatCurrency, getCategoryById } from '../utils/theme';
import { useRecurring } from '../hooks/useExpenses';
import CategoryPicker from '../components/CategoryPicker';

const FREQUENCIES = [
  { id: 'daily', label: 'Daily', emoji: '📅' },
  { id: 'weekly', label: 'Weekly', emoji: '📆' },
  { id: 'monthly', label: 'Monthly', emoji: '🗓️' },
];

export default function RecurringScreen() {
  const { recurring, addRecurring, updateRecurring, deleteRecurring, refresh } = useRecurring();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [category, setCategory] = useState('bills');

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const getNextDue = (freq) => {
    const d = new Date();
    if (freq === 'daily') d.setDate(d.getDate() + 1);
    else if (freq === 'weekly') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    return d.toISOString();
  };

  const handleCreate = async () => {
    if (!name.trim() || !amount) {
      Alert.alert('Incomplete', 'Name and amount are required');
      return;
    }
    const nextDue = getNextDue(frequency);
    const entry = await addRecurring({ name, upiId, amount: Number(amount), frequency, nextDue, category });
    setCreating(false);
    setName(''); setUpiId(''); setAmount('');
  };

  const toggleEnabled = async (item) => {
    await updateRecurring(item.id, { enabled: !item.enabled });
  };

  const handleDelete = (id) => {
    Alert.alert('Delete', 'Remove this recurring payment?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteRecurring(id) },
    ]);
  };

  const getDaysUntilDue = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
    if (diff <= 0) return 'Due today';
    if (diff === 1) return 'Due tomorrow';
    return `Due in ${diff} days`;
  };

  if (creating) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>New Recurring</Text>

        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} placeholder="Netflix, Rent, etc." placeholderTextColor={COLORS.textMuted} value={name} onChangeText={setName} />

        <Text style={styles.label}>UPI ID (optional)</Text>
        <TextInput style={styles.input} placeholder="merchant@bank" placeholderTextColor={COLORS.textMuted} value={upiId} onChangeText={setUpiId} autoCapitalize="none" />

        <Text style={styles.label}>Amount (₹)</Text>
        <TextInput style={[styles.input, { fontSize: FONT_SIZE.xxl, fontWeight: '700' }]} placeholder="0" placeholderTextColor={COLORS.textMuted} value={amount} onChangeText={setAmount} keyboardType="numeric" />

        <Text style={styles.label}>Frequency</Text>
        <View style={styles.freqRow}>
          {FREQUENCIES.map((f) => (
            <TouchableOpacity key={f.id} style={[styles.freqBtn, frequency === f.id && styles.freqBtnActive]} onPress={() => setFrequency(f.id)}>
              <Text style={styles.freqEmoji}>{f.emoji}</Text>
              <Text style={[styles.freqText, frequency === f.id && { color: COLORS.accent }]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Category</Text>
        <CategoryPicker selected={category} onSelect={setCategory} />

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreating(false)}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={handleCreate}>
            <Text style={styles.saveBtnText}>Create</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 60 }} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Recurring</Text>
        <TouchableOpacity style={styles.newBtn} onPress={() => setCreating(true)}>
          <Text style={styles.newBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {recurring.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🔄</Text>
          <Text style={styles.emptyTitle}>No recurring payments</Text>
          <Text style={styles.emptySub}>Add subscriptions and regular bills</Text>
        </View>
      ) : (
        recurring.map((item) => {
          const cat = getCategoryById(item.category);
          const dueText = getDaysUntilDue(item.nextDue);
          const isDueNow = dueText === 'Due today';
          return (
            <TouchableOpacity key={item.id} style={styles.recurCard} activeOpacity={0.8} onLongPress={() => handleDelete(item.id)}>
              <View style={styles.recurHeader}>
                <View style={[styles.recurIcon, { backgroundColor: cat.color + '18' }]}>
                  <Text style={{ fontSize: 20 }}>{cat.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recurName}>{item.name}</Text>
                  <Text style={styles.recurMeta}>{item.frequency} • {item.upiId || 'No UPI ID'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.recurAmount}>{formatCurrency(item.amount)}</Text>
                  <Text style={[styles.recurDue, isDueNow && { color: COLORS.amber }]}>{dueText}</Text>
                </View>
              </View>
              <View style={styles.recurFooter}>
                <Switch value={item.enabled} onValueChange={() => toggleEnabled(item)} trackColor={{ false: COLORS.elevated, true: COLORS.accent + '60' }} thumbColor={item.enabled ? COLORS.accent : COLORS.textMuted} />
                <Text style={styles.recurStatus}>{item.enabled ? 'Active' : 'Paused'}</Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingTop: 60, paddingHorizontal: SPACING.xl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { color: COLORS.textPrimary, fontSize: FONT_SIZE.xxxl, fontWeight: '800' },
  newBtn: { backgroundColor: COLORS.accent, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8 },
  newBtnText: { color: '#fff', fontSize: FONT_SIZE.sm, fontWeight: '700' },
  label: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: '600', marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, paddingHorizontal: 16, paddingVertical: 14, color: COLORS.textPrimary, fontSize: FONT_SIZE.md, borderWidth: 1, borderColor: COLORS.border },
  freqRow: { flexDirection: 'row', gap: 12 },
  freqBtn: { flex: 1, backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  freqBtnActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accentDim },
  freqEmoji: { fontSize: 18, marginBottom: 4 },
  freqText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24 },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.elevated },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '600' },
  saveBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.accent },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  recurCard: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  recurHeader: { flexDirection: 'row', alignItems: 'center' },
  recurIcon: { width: 44, height: 44, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  recurName: { color: COLORS.textPrimary, fontSize: FONT_SIZE.md, fontWeight: '600' },
  recurMeta: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  recurAmount: { color: COLORS.textPrimary, fontSize: FONT_SIZE.md, fontWeight: '700' },
  recurDue: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, marginTop: 2 },
  recurFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  recurStatus: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginLeft: 10 },
  emptyCard: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.xl, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  emptyTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.lg, fontWeight: '700' },
  emptySub: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginTop: 4 },
});
