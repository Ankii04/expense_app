import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert, Modal, Share } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, formatCurrency } from '../utils/theme';
import { useGroups } from '../hooks/useExpenses';
import ContactPicker from '../components/ContactPicker';

export default function GroupsScreen() {
  const { groups, addGroup, updateGroup, deleteGroup, refresh } = useGroups();
  const [creating, setCreating] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState([]);
  const [showContacts, setShowContacts] = useState(false);

  // Group Details & Actions
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [addExpenseModal, setAddExpenseModal] = useState(false);
  const [settleModal, setSettleModal] = useState(null); // { memberIdx, memberName }
  const [settleAmount, setSettleAmount] = useState('');
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [payerPhone, setPayerPhone] = useState('self');

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const handleAddMember = (contact) => {
    if (members.find(m => m.phone === contact.phone)) return;
    setMembers([...members, { name: contact.name, phone: contact.phone, balance: 0 }]);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }
    const finalMembers = [...members, { name: 'You', phone: 'self', balance: 0 }];
    await addGroup({ name: groupName, members: finalMembers });
    setCreating(false);
    setGroupName('');
    setMembers([]);
  };

  const handleAddExpenseToGroup = async (group) => {
    const targetGroup = group || selectedGroup;
    if (!expTitle || !expAmount) {
      if (!group) return; 
      setSelectedGroup(group);
      setAddExpenseModal(true);
      return;
    }
    const amount = Number(expAmount);
    const updatedExpenses = [...targetGroup.expenses, { 
      id: Date.now().toString(),
      title: expTitle, 
      amount, 
      payerPhone, 
      date: new Date().toISOString() 
    }];

    const perPerson = amount / targetGroup.members.length;
    const updatedMembers = targetGroup.members.map(m => {
      let newBalance = m.balance || 0;
      if (m.phone === payerPhone) {
        newBalance += (amount - perPerson);
      } else {
        newBalance -= perPerson;
      }
      return { ...m, balance: newBalance };
    });

    await updateGroup(targetGroup.id, { expenses: updatedExpenses, members: updatedMembers });
    if (selectedGroup?.id === targetGroup.id) {
      setSelectedGroup({ ...targetGroup, expenses: updatedExpenses, members: updatedMembers });
    }
    setAddExpenseModal(false);
    setExpTitle('');
    setExpAmount('');
  };

  const handleSettle = async () => {
    if (!settleAmount || !selectedGroup) return;
    const amount = Number(settleAmount);
    const idx = settleModal.memberIdx;
    const updatedMembers = [...selectedGroup.members];
    updatedMembers[idx].balance += amount; 
    await updateGroup(selectedGroup.id, { members: updatedMembers });
    setSelectedGroup({ ...selectedGroup, members: updatedMembers });
    setSettleModal(null);
    setSettleAmount('');
  };

  const handleShareDebt = async (member) => {
    if (member.balance >= 0) {
      Alert.alert('All Settled', `${member.name} doesn't owe anything!`);
      return;
    }
    const message = `Hey ${member.name}, you owe ${formatCurrency(Math.abs(member.balance))} in our group "${selectedGroup.name}".\n\nPlease settle up when you can! 🏘️⚡`;
    try {
      await Share.share({ message });
    } catch (error) {
      console.log(error);
    }
  };

  const handleDeleteGroup = (id) => {
    Alert.alert('Delete Group', 'Remove this group permanently?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteGroup(id) },
    ]);
  };

  if (creating) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>New Group</Text>
          <Text style={styles.label}>Group Name</Text>
          <TextInput style={styles.input} placeholder="Flatmates, Trip, etc." placeholderTextColor={COLORS.textMuted} value={groupName} onChangeText={setGroupName} />
          <Text style={styles.label}>Members</Text>
          <View style={styles.memberRow}>
             <View style={styles.memberAvatar}><Text style={styles.memberAvatarText}>👤</Text></View>
             <Text style={styles.memberName}>You (Organizer)</Text>
          </View>
          {members.map((m, i) => (
            <View key={i} style={styles.memberRow}>
               <View style={styles.memberAvatar}><Text style={styles.memberAvatarText}>{m.name[0]}</Text></View>
               <Text style={styles.memberName}>{m.name}</Text>
               <TouchableOpacity onPress={() => setMembers(members.filter((_, idx) => idx !== i))}>
                 <Text style={{ color: COLORS.red, fontWeight: '700' }}>Remove</Text>
               </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowContacts(true)}>
            <Text style={styles.addBtnText}>+ Add Member from Contacts</Text>
          </TouchableOpacity>
          <View style={styles.actionRow}>
             <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreating(false)}>
               <Text style={styles.cancelBtnText}>Cancel</Text>
             </TouchableOpacity>
             <TouchableOpacity style={styles.saveBtn} onPress={handleCreateGroup}>
               <Text style={styles.saveBtnText}>Create Group</Text>
             </TouchableOpacity>
          </View>
        </ScrollView>
        <ContactPicker visible={showContacts} onClose={() => setShowContacts(false)} onSelect={handleAddMember} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Groups</Text>
          <TouchableOpacity style={styles.newBtn} onPress={() => setCreating(true)}>
            <Text style={styles.newBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>

        {groups.map(group => (
          <TouchableOpacity key={group.id} style={styles.groupCard} activeOpacity={0.9} onPress={() => setSelectedGroup(group)} onLongPress={() => handleDeleteGroup(group.id)}>
             <View style={styles.groupHeader}>
               <Text style={styles.groupName}>{group.name}</Text>
               <TouchableOpacity style={styles.quickAddBtn} onPress={() => { setSelectedGroup(group); setAddExpenseModal(true); }}>
                  <Text style={styles.quickAddText}>+ Add Expense</Text>
               </TouchableOpacity>
             </View>
             <Text style={styles.groupMeta}>{group.members.length} members • {group.expenses.length} expenses</Text>
             <View style={styles.balanceRow}>
                <View style={styles.avatarStack}>
                  {group.members.slice(0, 4).map((m, i) => (
                    <View key={i} style={[styles.miniAvatar, { marginLeft: i > 0 ? -10 : 0 }]}><Text style={styles.miniAvatarText}>{m.name[0]}</Text></View>
                  ))}
                </View>
                {group.members.length > 4 && <Text style={styles.moreText}>+{group.members.length - 4} more</Text>}
                <View style={{ flex: 1 }} />
                <Text style={styles.viewDetails}>View Details →</Text>
             </View>
          </TouchableOpacity>
        ))}

        {groups.length === 0 && (
          <View style={styles.empty}>
             <Text style={{ fontSize: 64, marginBottom: 16 }}>🏘️</Text>
             <Text style={styles.emptyTitle}>Your Groups</Text>
             <Text style={styles.emptySub}>Shared expenses made easy. Create a group for trips, rent, or dining out.</Text>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal visible={!!selectedGroup} animationType="slide">
         <View style={styles.modalContainer}>
            {selectedGroup && (
              <>
                <View style={styles.modalHeader}>
                   <TouchableOpacity onPress={() => setSelectedGroup(null)} style={styles.modalCloseBtn}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
                   <Text style={styles.modalTitle}>{selectedGroup.name}</Text>
                   <TouchableOpacity onPress={() => setAddExpenseModal(true)} style={styles.modalAddBtn}><Text style={styles.addExpBtnText}>+ Expense</Text></TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={{ padding: 24 }}>
                   <Text style={styles.sectionTitle}>Balances & Settlement</Text>
                   <View style={styles.balanceCard}>
                      {selectedGroup.members.map((m, i) => (
                        <View key={i} style={styles.memberBalanceItem}>
                           <View style={{ flex: 1 }}>
                             <Text style={styles.mName}>{m.name}</Text>
                             <Text style={[styles.mBalance, { color: m.balance >= 0 ? COLORS.green : COLORS.red }]}>
                               {m.balance >= 0 ? 'is owed ' : 'owes you '}
                               {formatCurrency(Math.abs(m.balance))}
                             </Text>
                           </View>
                           <View style={styles.mActions}>
                             <TouchableOpacity style={styles.settleBtn} onPress={() => { setSettleModal({ memberIdx: i, memberName: m.name }); setSettleAmount(''); }}>
                                <Text style={styles.settleText}>Settle</Text>
                             </TouchableOpacity>
                             <TouchableOpacity style={styles.shareIconBtn} onPress={() => handleShareDebt(m)}>
                                <Text style={styles.shareIcon}>📤</Text>
                             </TouchableOpacity>
                           </View>
                        </View>
                      ))}
                   </View>

                   <Text style={styles.sectionTitle}>History</Text>
                   {selectedGroup.expenses.length === 0 ? (
                     <View style={styles.emptyHistory}>
                        <Text style={styles.emptyHistoryText}>No expenses logged yet.</Text>
                     </View>
                   ) : (
                     selectedGroup.expenses.map((exp, i) => (
                        <View key={i} style={styles.expItem}>
                           <View style={styles.expIcon}><Text>🧾</Text></View>
                           <View style={{ flex: 1, marginLeft: 12 }}>
                             <Text style={styles.expTitle}>{exp.title}</Text>
                             <Text style={styles.expSub}>Paid by {selectedGroup.members.find(m => m.phone === exp.payerPhone)?.name || 'Someone'}</Text>
                           </View>
                           <Text style={styles.expAmount}>{formatCurrency(exp.amount)}</Text>
                        </View>
                     ))
                   )}
                   <View style={{ height: 60 }} />
                </ScrollView>

                <Modal visible={!!settleModal} transparent animationType="fade">
                   <View style={styles.overlay}>
                      <View style={styles.settleCard}>
                         <Text style={styles.formTitle}>Record Payment</Text>
                         <Text style={styles.settleLabel}>How much did {settleModal?.memberName} pay?</Text>
                         <TextInput 
                           style={styles.settleInput} 
                           placeholder="0" 
                           placeholderTextColor={COLORS.textMuted} 
                           value={settleAmount} 
                           onChangeText={setSettleAmount} 
                           keyboardType="numeric" 
                           autoFocus 
                         />
                         <View style={styles.row}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setSettleModal(null)}>
                               <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={handleSettle}>
                               <Text style={styles.saveBtnText}>Record</Text>
                            </TouchableOpacity>
                         </View>
                      </View>
                   </View>
                </Modal>

                <Modal visible={addExpenseModal} transparent animationType="fade">
                   <View style={styles.overlay}>
                      <View style={styles.formCard}>
                         <Text style={styles.formTitle}>Add Group Expense</Text>
                         <TextInput style={styles.input} placeholder="What for? (e.g. Dinner)" placeholderTextColor={COLORS.textMuted} value={expTitle} onChangeText={setExpTitle} />
                         <TextInput style={styles.input} placeholder="Amount (₹)" placeholderTextColor={COLORS.textMuted} value={expAmount} onChangeText={setExpAmount} keyboardType="numeric" />
                         <Text style={styles.label}>Who paid?</Text>
                         <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                            {selectedGroup.members.map(m => (
                               <TouchableOpacity 
                                 key={m.phone} 
                                 style={[styles.payerChip, payerPhone === m.phone && styles.payerChipActive]}
                                 onPress={() => setPayerPhone(m.phone)}
                               >
                                 <Text style={[styles.payerText, payerPhone === m.phone && { color: '#fff' }]}>{m.name}</Text>
                               </TouchableOpacity>
                            ))}
                         </ScrollView>
                         <View style={styles.row}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddExpenseModal(false)}>
                               <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={() => handleAddExpenseToGroup()}>
                               <Text style={styles.saveBtnText}>Add</Text>
                            </TouchableOpacity>
                         </View>
                      </View>
                   </View>
                </Modal>
              </>
            )}
         </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  content: { paddingTop: 60, paddingHorizontal: 24 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  title: { color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  newBtn: { backgroundColor: '#6366F1', borderRadius: 999, paddingHorizontal: 22, paddingVertical: 10 },
  newBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  label: { color: '#A1A1AA', fontSize: 14, fontWeight: '600', marginBottom: 12, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#18181B', borderRadius: 16, padding: 16, color: '#fff', fontSize: 18, marginBottom: 16, borderWidth: 1, borderColor: '#27272A' },
  memberRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181B', padding: 16, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#27272A' },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#6366F120', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  memberAvatarText: { color: '#6366F1', fontWeight: '700', fontSize: 18 },
  memberName: { color: '#fff', flex: 1, fontWeight: '700', fontSize: 18 },
  addBtn: { backgroundColor: '#18181B', padding: 18, borderRadius: 16, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#6366F160', marginTop: 16 },
  addBtnText: { color: '#6366F1', fontWeight: '700', fontSize: 16 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 40 },
  cancelBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, backgroundColor: '#27272A' },
  cancelBtnText: { color: '#A1A1AA', fontWeight: '700', fontSize: 16 },
  saveBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16, backgroundColor: '#6366F1' },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  groupCard: { backgroundColor: '#18181B', padding: 24, borderRadius: 28, marginBottom: 24, borderWidth: 1, borderColor: '#27272A', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  groupName: { color: '#fff', fontSize: 28, fontWeight: '800', flex: 1, marginRight: 12 },
  quickAddBtn: { backgroundColor: '#6366F120', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#6366F140' },
  quickAddText: { color: '#6366F1', fontWeight: '800', fontSize: 12 },
  groupMeta: { color: '#A1A1AA', fontSize: 16, fontWeight: '500', marginBottom: 24 },
  balanceRow: { flexDirection: 'row', alignItems: 'center' },
  avatarStack: { flexDirection: 'row' },
  miniAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#27272A', borderWidth: 2, borderColor: '#18181B', alignItems: 'center', justifyContent: 'center' },
  miniAvatarText: { fontSize: 14, color: '#fff', fontWeight: '700' },
  moreText: { color: '#71717A', fontSize: 16, marginLeft: 12, fontWeight: '600' },
  viewDetails: { color: '#6366F1', fontSize: 16, fontWeight: '800' },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyTitle: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 12 },
  emptySub: { color: '#71717A', fontSize: 18, marginTop: 12, textAlign: 'center', lineHeight: 26 },
  modalContainer: { flex: 1, backgroundColor: '#0A0A0F' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#27272A', backgroundColor: '#18181B' },
  modalCloseBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: '#27272A' },
  closeBtn: { color: '#fff', fontSize: 24, fontWeight: '700' },
  modalTitle: { color: '#fff', fontSize: 24, fontWeight: '800', flex: 1, textAlign: 'center' },
  modalAddBtn: { backgroundColor: '#6366F1', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 },
  addExpBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  sectionTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 32, marginBottom: 16, letterSpacing: -0.5 },
  balanceCard: { backgroundColor: '#18181B', padding: 20, borderRadius: 28, borderWidth: 1, borderColor: '#27272A' },
  memberBalanceItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#27272A50' },
  mName: { color: '#fff', fontSize: 20, fontWeight: '700' },
  mBalance: { fontWeight: '600', fontSize: 16, marginTop: 6 },
  mActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  settleBtn: { backgroundColor: '#10B98120', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#10B98140' },
  settleText: { color: '#10B981', fontWeight: '800', fontSize: 14 },
  shareIconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#27272A', borderWidth: 1, borderColor: '#3F3F46' },
  shareIcon: { fontSize: 20 },
  expItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderRadius: 20, backgroundColor: '#18181B', marginBottom: 12, borderWidth: 1, borderColor: '#27272A' },
  expIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#27272A', alignItems: 'center', justifyContent: 'center' },
  expTitle: { color: '#fff', fontWeight: '700', fontSize: 18 },
  expSub: { color: '#71717A', fontSize: 14, marginTop: 4 },
  expAmount: { color: '#fff', fontWeight: '800', fontSize: 20 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 24 },
  formCard: { backgroundColor: '#18181B', padding: 32, borderRadius: 32, borderWidth: 1, borderColor: '#6366F140' },
  formTitle: { color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 24 },
  payerChip: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, backgroundColor: '#27272A', marginRight: 10, borderWidth: 1, borderColor: '#3F3F46' },
  payerChipActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  payerText: { color: '#D4D4D8', fontWeight: '700', fontSize: 14 },
  settleCard: { backgroundColor: '#18181B', padding: 32, borderRadius: 32, borderWidth: 1, borderColor: '#10B98140', alignItems: 'center' },
  settleLabel: { color: '#A1A1AA', fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 24 },
  settleInput: { width: '100%', backgroundColor: '#27272A', borderRadius: 20, padding: 24, color: '#10B981', fontSize: 48, fontWeight: '800', textAlign: 'center', marginBottom: 32, borderWidth: 1, borderColor: '#3F3F46' },
  emptyHistory: { alignItems: 'center', paddingVertical: 50, borderStyle: 'dashed', borderWidth: 1, borderColor: '#27272A', borderRadius: 24 },
  emptyHistoryText: { color: '#71717A', fontWeight: '600', fontSize: 16 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 16, width: '100%' },
});
