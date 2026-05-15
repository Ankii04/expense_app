import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert, Modal } from 'react-native';
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
  const [includeSelf, setIncludeSelf] = useState(true);
  const [showContacts, setShowContacts] = useState(false);

  // For editing paid amount
  const [editingPayment, setEditingPayment] = useState(null); // { splitId, memberIdx, currentPaid }
  const [newPaidAmount, setNewPaidAmount] = useState('');

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const addMember = (contact) => {
    if (members.find((m) => m.phone === contact.phone)) return;
    setMembers([...members, { name: contact.name, phone: contact.phone, share: 0, paidAmount: 0 }]);
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
    const total = Number(totalAmount);
    if (!title.trim() || !totalAmount) {
      Alert.alert('Incomplete', 'Need title and amount');
      return;
    }

    let finalMembers = [...members];
    if (includeSelf) {
      finalMembers.push({ name: 'You (Organizer)', phone: 'self', share: 0, paidAmount: 0 });
    }

    if (finalMembers.length < 1) {
      Alert.alert('No Members', 'Add at least one member to the split');
      return;
    }

    if (splitType === 'equal') {
      const perPerson = Math.round((total / finalMembers.length) * 100) / 100;
      finalMembers = finalMembers.map((m) => ({ ...m, share: perPerson }));
    }

    await addSplit({ title, totalAmount: total, splitType, members: finalMembers });
    setCreating(false);
    setTitle('');
    setTotalAmount('');
    setMembers([]);
    setIncludeSelf(true);
  };

  const handleEditPayment = (splitId, memberIdx, currentPaid) => {
    setEditingPayment({ splitId, memberIdx });
    setNewPaidAmount(String(currentPaid || 0));
  };

  const savePayment = async () => {
    const { splitId, memberIdx } = editingPayment;
    const split = splits.find((s) => s.id === splitId);
    if (!split) return;

    const updatedMembers = [...split.members];
    updatedMembers[memberIdx].paidAmount = Number(newPaidAmount) || 0;
    // Keep compatibility with old 'paid' boolean if needed, or just use amount
    updatedMembers[memberIdx].paid = updatedMembers[memberIdx].paidAmount >= updatedMembers[memberIdx].share;

    await updateSplit(splitId, { members: updatedMembers });
    setEditingPayment(null);
  };

  const handleDeleteSplit = (id) => {
    Alert.alert('Delete Split', 'Remove this split?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSplit(id) },
    ]);
  };

  if (creating) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="always">
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

        <View style={styles.selfRow}>
          <TouchableOpacity style={styles.checkboxContainer} onPress={() => setIncludeSelf(!includeSelf)}>
            <View style={[styles.checkbox, includeSelf && styles.checkboxActive]}>
              {includeSelf && <Text style={styles.checkboxTick}>✓</Text>}
            </View>
            <Text style={styles.selfText}>Include myself in this split</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Members ({members.length + (includeSelf ? 1 : 0)})</Text>
        {includeSelf && (
          <View style={[styles.memberRow, { borderColor: COLORS.accentDim, backgroundColor: COLORS.accentDim + '20' }]}>
            <View style={styles.memberAvatar}><Text style={styles.memberAvatarText}>👤</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>You (Organizer)</Text>
              <Text style={styles.memberSub}>Self</Text>
            </View>
          </View>
        )}
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
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
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
            const totalPaid = split.members.reduce((sum, m) => sum + (m.paidAmount || 0), 0);
            const isFullyPaid = totalPaid >= split.totalAmount;

            return (
              <TouchableOpacity key={split.id} style={styles.splitCard} activeOpacity={0.8} onLongPress={() => handleDeleteSplit(split.id)}>
                <View style={styles.splitHeader}>
                  <Text style={styles.splitTitle}>{split.title}</Text>
                  <Text style={styles.splitAmount}>{formatCurrency(split.totalAmount)}</Text>
                </View>
                <View style={styles.progressRow}>
                   <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${Math.min(100, (totalPaid / split.totalAmount) * 100)}%` }]} />
                   </View>
                   <Text style={styles.progressText}>{formatCurrency(totalPaid)} / {formatCurrency(split.totalAmount)}</Text>
                </View>

                {split.members.map((m, i) => {
                  const paid = m.paidAmount || 0;
                  const due = Math.max(0, m.share - paid);
                  return (
                    <TouchableOpacity key={i} style={styles.splitMember} onPress={() => handleEditPayment(split.id, i, paid)}>
                      <View style={[styles.paidDot, due === 0 && { backgroundColor: COLORS.green }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.splitMemberName, due === 0 && { color: COLORS.textMuted }]}>{m.name}</Text>
                        <Text style={styles.splitMemberMeta}>
                          {due === 0 ? 'Settled' : `Due: ${formatCurrency(due)}`}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.splitMemberShare}>{formatCurrency(m.share)}</Text>
                        <Text style={styles.paidAmountText}>Paid: {formatCurrency(paid)}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modal for editing payment */}
      <Modal visible={!!editingPayment} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Payment</Text>
            <Text style={styles.modalLabel}>Enter amount paid by member:</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={newPaidAmount}
              onChangeText={setNewPaidAmount}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setEditingPayment(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={savePayment}>
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
  selfRow: { marginTop: 16, marginBottom: 8 },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: COLORS.accent, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: COLORS.accent },
  checkboxTick: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  selfText: { color: COLORS.textPrimary, fontSize: FONT_SIZE.md, fontWeight: '500' },
  memberRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.accentDim, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  memberAvatarText: { color: COLORS.accent, fontWeight: '700' },
  memberName: { color: COLORS.textPrimary, fontSize: FONT_SIZE.md, fontWeight: '600' },
  memberSub: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
  shareInput: { backgroundColor: COLORS.elevated, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, color: COLORS.textPrimary, fontSize: FONT_SIZE.sm, marginTop: 6, borderWidth: 1, borderColor: COLORS.border },
  addMemberBtn: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.accent + '40', borderStyle: 'dashed', marginTop: 8 },
  addMemberText: { color: COLORS.accent, fontWeight: '600' },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24 },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.elevated },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '600' },
  saveBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.accent },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  splitCard: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  splitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  splitTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.lg, fontWeight: '700' },
  splitAmount: { color: COLORS.accent, fontSize: FONT_SIZE.lg, fontWeight: '800' },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  progressBar: { flex: 1, height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.accent },
  progressText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, fontWeight: '600' },
  splitMember: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  paidDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.textMuted, marginRight: 12 },
  splitMemberName: { color: COLORS.textPrimary, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  splitMemberMeta: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, marginTop: 2 },
  splitMemberShare: { color: COLORS.textPrimary, fontSize: FONT_SIZE.sm, fontWeight: '700' },
  paidAmountText: { color: COLORS.green, fontSize: FONT_SIZE.xs, fontWeight: '600', marginTop: 2 },
  emptyCard: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.xl, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  emptyTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.lg, fontWeight: '700' },
  emptySub: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.elevated, borderRadius: BORDER_RADIUS.xl, padding: 24, width: '100%', maxWidth: 400 },
  modalTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.xl, fontWeight: '800', marginBottom: 16 },
  modalLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, marginBottom: 12 },
  modalInput: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, padding: 16, color: COLORS.textPrimary, fontSize: FONT_SIZE.xxl, fontWeight: '700', textAlign: 'center', borderWidth: 1, borderColor: COLORS.border, marginBottom: 24 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, padding: 14, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.card, alignItems: 'center' },
  modalCancelText: { color: COLORS.textSecondary, fontWeight: '600' },
  modalSave: { flex: 1, padding: 14, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.accent, alignItems: 'center' },
  modalSaveText: { color: '#fff', fontWeight: '700' },
});
