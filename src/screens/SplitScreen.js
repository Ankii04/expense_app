import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, formatCurrency } from '../utils/theme';
import { useSplits } from '../hooks/useExpenses';
import ContactPicker from '../components/ContactPicker';

export default function SplitScreen() {
  const { splits, addSplit, updateSplit, deleteSplit, refresh } = useSplits();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [splitType, setSplitType] = useState('equal');
  const [members, setMembers] = useState([]);
  const [showContacts, setShowContacts] = useState(false);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const addMember = (contact) => {
    if (members.find((m) => m.phone === contact.phone)) return;
    setMembers([...members, { name: contact.name, phone: contact.phone, share: 0, paid: false }]);
  };

  const removeMember = (idx) => {
    setMembers(members.filter((_, i) => i !== idx));
  };

  const updateShare = (idx, val) => {
    const updated = [...members];
    updated[idx].share = Number(val) || 0;
    setMembers(updated);
  };

  const handleCreate = async () => {
    if (!title.trim() || !totalAmount || members.length < 2) {
      Alert.alert('Incomplete', 'Need title, amount, and at least 2 members');
      return;
    }
    const total = Number(totalAmount);
    let finalMembers = members;
    if (splitType === 'equal') {
      const perPerson = Math.round((total / members.length) * 100) / 100;
      finalMembers = members.map((m) => ({ ...m, share: perPerson }));
    }
    await addSplit({ title, totalAmount: total, splitType, members: finalMembers });
    setCreating(false);
    setTitle('');
    setTotalAmount('');
    setMembers([]);
  };

  const togglePaid = async (splitId, memberIdx) => {
    const split = splits.find((s) => s.id === splitId);
    if (!split) return;
    const updatedMembers = [...split.members];
    updatedMembers[memberIdx].paid = !updatedMembers[memberIdx].paid;
    await updateSplit(splitId, { members: updatedMembers });
  };

  const handleDeleteSplit = (id) => {
    Alert.alert('Delete Split', 'Remove this split?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSplit(id) },
    ]);
  };

  if (creating) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>New Split</Text>

        <Text style={styles.label}>Title</Text>
        <TextInput style={styles.input} placeholder="Dinner, Trip, etc." placeholderTextColor={COLORS.textMuted} value={title} onChangeText={setTitle} />

        <Text style={styles.label}>Total Amount (₹)</Text>
        <TextInput style={[styles.input, { fontSize: FONT_SIZE.xxl, fontWeight: '700' }]} placeholder="0" placeholderTextColor={COLORS.textMuted} value={totalAmount} onChangeText={setTotalAmount} keyboardType="numeric" />

        <Text style={styles.label}>Split Type</Text>
        <View style={styles.typeRow}>
          {['equal', 'custom'].map((t) => (
            <TouchableOpacity key={t} style={[styles.typeBtn, splitType === t && styles.typeBtnActive]} onPress={() => setSplitType(t)}>
              <Text style={[styles.typeBtnText, splitType === t && { color: COLORS.accent }]}>{t === 'equal' ? '⚖️ Equal' : '✏️ Custom'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Members ({members.length})</Text>
        {members.map((m, i) => (
          <View key={i} style={styles.memberRow}>
            <View style={styles.memberAvatar}><Text style={styles.memberAvatarText}>{m.name[0]}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{m.name}</Text>
              {splitType === 'custom' && (
                <TextInput style={styles.shareInput} placeholder="Share ₹" placeholderTextColor={COLORS.textMuted} value={m.share > 0 ? String(m.share) : ''} onChangeText={(v) => updateShare(i, v)} keyboardType="numeric" />
              )}
            </View>
            <TouchableOpacity onPress={() => removeMember(i)}>
              <Text style={{ color: COLORS.red, fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.addMemberBtn} onPress={() => setShowContacts(true)}>
          <Text style={styles.addMemberText}>+ Add Member</Text>
        </TouchableOpacity>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => { setCreating(false); setMembers([]); }}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={handleCreate}>
            <Text style={styles.saveBtnText}>Create Split</Text>
          </TouchableOpacity>
        </View>

        <ContactPicker visible={showContacts} onClose={() => setShowContacts(false)} onSelect={addMember} />
        <View style={{ height: 60 }} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Splits</Text>
        <TouchableOpacity style={styles.newBtn} onPress={() => setCreating(true)}>
          <Text style={styles.newBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {splits.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🤝</Text>
          <Text style={styles.emptyTitle}>No splits yet</Text>
          <Text style={styles.emptySub}>Split expenses with friends</Text>
        </View>
      ) : (
        splits.map((split) => {
          const paidCount = split.members.filter((m) => m.paid).length;
          return (
            <TouchableOpacity key={split.id} style={styles.splitCard} activeOpacity={0.8} onLongPress={() => handleDeleteSplit(split.id)}>
              <View style={styles.splitHeader}>
                <Text style={styles.splitTitle}>{split.title}</Text>
                <Text style={styles.splitAmount}>{formatCurrency(split.totalAmount)}</Text>
              </View>
              <Text style={styles.splitMeta}>{split.members.length} members • {split.splitType} split • {paidCount}/{split.members.length} paid</Text>
              {split.members.map((m, i) => (
                <TouchableOpacity key={i} style={styles.splitMember} onPress={() => togglePaid(split.id, i)}>
                  <View style={[styles.paidDot, m.paid && { backgroundColor: COLORS.green }]} />
                  <Text style={[styles.splitMemberName, m.paid && { textDecorationLine: 'line-through', color: COLORS.textMuted }]}>{m.name}</Text>
                  <Text style={styles.splitMemberShare}>{formatCurrency(m.share)}</Text>
                </TouchableOpacity>
              ))}
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
  typeRow: { flexDirection: 'row', gap: 12 },
  typeBtn: { flex: 1, backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  typeBtnActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accentDim },
  typeBtnText: { color: COLORS.textSecondary, fontWeight: '600' },
  memberRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.accentDim, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  memberAvatarText: { color: COLORS.accent, fontWeight: '700' },
  memberName: { color: COLORS.textPrimary, fontSize: FONT_SIZE.md, fontWeight: '600' },
  shareInput: { backgroundColor: COLORS.elevated, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, color: COLORS.textPrimary, fontSize: FONT_SIZE.sm, marginTop: 6, borderWidth: 1, borderColor: COLORS.border },
  addMemberBtn: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.accent + '40', borderStyle: 'dashed', marginTop: 8 },
  addMemberText: { color: COLORS.accent, fontWeight: '600' },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24 },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.elevated },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '600' },
  saveBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.accent },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  splitCard: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  splitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  splitTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.lg, fontWeight: '700' },
  splitAmount: { color: COLORS.accent, fontSize: FONT_SIZE.lg, fontWeight: '800' },
  splitMeta: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, marginBottom: 12 },
  splitMember: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  paidDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.textMuted, marginRight: 10 },
  splitMemberName: { flex: 1, color: COLORS.textPrimary, fontSize: FONT_SIZE.sm },
  splitMemberShare: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  emptyCard: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.xl, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  emptyTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.lg, fontWeight: '700' },
  emptySub: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginTop: 4 },
});
