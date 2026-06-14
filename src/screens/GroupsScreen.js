import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert, Modal, Share, BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { COLORS, SPACING, BORDER_RADIUS, formatCurrency, formatCurrencyHTML, escapeHtml } from '../utils/theme';
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
  const [editingExpense, setEditingExpense] = useState(null);

  // Group Edit state
  const [editingGroup, setEditingGroup] = useState(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editMembers, setEditMembers] = useState([]);
  const [showEditContacts, setShowEditContacts] = useState(false);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  // Handle hardware back button
  useEffect(() => {
    const backAction = () => {
      if (editingGroup) {
        setEditingGroup(null);
        return true;
      }
      if (selectedGroup) {
        setSelectedGroup(null);
        return true;
      }
      if (creating) {
        setCreating(false);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [editingGroup, selectedGroup, creating]);

  const handleAddMember = (contact) => {
    if (members.find(m => m.phone === contact.phone)) return;
    setMembers([...members, { name: contact.name, phone: contact.phone, balance: 0, totalSpent: 0, joined_at: new Date().toISOString(), left_at: null }]);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }
    const finalMembers = [...members, { name: 'You', phone: 'self', balance: 0, totalSpent: 0, joined_at: new Date().toISOString(), left_at: null }];
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
    let updatedExpenses;
    
    if (editingExpense) {
      updatedExpenses = targetGroup.expenses.map(e => 
        e.id === editingExpense.id 
          ? { ...e, title: expTitle, amount, payerPhone } 
          : e
      );
    } else {
      updatedExpenses = [...targetGroup.expenses, { 
        id: Date.now().toString(),
        title: expTitle, 
        amount, 
        payerPhone, 
        date: new Date().toISOString() 
      }];
    }

    const updatedMembers = recalculateBalances(targetGroup.members, updatedExpenses);

    await updateGroup(targetGroup.id, { expenses: updatedExpenses, members: updatedMembers });
    if (selectedGroup?.id === targetGroup.id) {
      setSelectedGroup({ ...targetGroup, expenses: updatedExpenses, members: updatedMembers });
    }
    resetExpenseForm();
  };

  const handleDeleteExpense = async (expId) => {
    if (!selectedGroup) return;
    
    const updatedExpenses = selectedGroup.expenses.filter(e => e.id !== expId);
    const updatedMembers = recalculateBalances(selectedGroup.members, updatedExpenses);

    await updateGroup(selectedGroup.id, { expenses: updatedExpenses, members: updatedMembers });
    setSelectedGroup({ ...selectedGroup, expenses: updatedExpenses, members: updatedMembers });
  };

  const recalculateBalances = (members, expenses) => {
    const newMembers = members.map(m => ({ ...m, balance: 0, totalSpent: 0 }));
    expenses.forEach(exp => {
      const amount = Number(exp.amount);
      const expDate = new Date(exp.date);

      // Helper to check if a member is active at this expense's date
      const isMemberActive = (m) => {
        if (!m.joined_at) return true;
        const join = new Date(m.joined_at);
        const leave = m.left_at ? new Date(m.left_at) : null;
        return expDate >= join && (!leave || expDate <= leave);
      };

      // Handle Settlements
      if (exp.is_settlement) {
        newMembers.forEach(m => {
          if (m.phone === exp.payerPhone) {
            m.balance += amount;
          }
          
          // Organizer is 'self'
          if (exp.payerPhone !== 'self' && m.phone === 'self') {
            m.balance -= amount;
          }
          
          // If organizer is payer, recipientPhone is the one receiving money
          const recipientPhone = exp.splitMembers && exp.splitMembers.length > 0 ? exp.splitMembers[0] : null;
          if (exp.payerPhone === 'self' && recipientPhone && m.phone === recipientPhone) {
            m.balance -= amount;
          }
        });
        return;
      }

      // Find active members for this expense
      const activeMembers = newMembers.filter(isMemberActive);
      if (activeMembers.length === 0) return; // safety check

      const isPayerActive = activeMembers.some(m => m.phone === exp.payerPhone);

      if (exp.shares) {
        // Custom split: use explicit shares map
        newMembers.forEach(m => {
          const isActive = isMemberActive(m);
          const share = isActive ? (exp.shares[m.phone] || 0) : 0;
          if (m.phone === exp.payerPhone) {
            m.balance += (amount - share);
            m.totalSpent += amount;
          } else {
            m.balance -= share;
          }
        });
      } else if (exp.splitMembers && exp.splitMembers.length > 0) {
        // Partial split: divide equally among active splitMembers
        const activeSplitPhones = exp.splitMembers.filter(phone => {
          const m = newMembers.find(member => member.phone === phone);
          return m && isMemberActive(m);
        });
        const payerInSplit = activeSplitPhones.includes(exp.payerPhone);
        const divisor = activeSplitPhones.length + (payerInSplit ? 0 : (isPayerActive ? 1 : 0));
        const perPerson = divisor > 0 ? (amount / divisor) : 0;

        newMembers.forEach(m => {
          const isInSplit = activeSplitPhones.includes(m.phone);
          const isPayer = m.phone === exp.payerPhone;
          const isActive = isMemberActive(m);

          if (isActive) {
            if (isPayer) {
              const payerShare = payerInSplit ? perPerson : 0;
              m.balance += (amount - payerShare);
              m.totalSpent += amount;
            } else if (isInSplit) {
              m.balance -= perPerson;
            }
          }
        });
      } else {
        // Traditional fallback: split equally among active members
        const divisor = activeMembers.length;
        const perPerson = divisor > 0 ? (amount / divisor) : 0;
        
        newMembers.forEach(m => {
          const isActive = isMemberActive(m);
          if (isActive) {
            if (m.phone === exp.payerPhone) {
              m.balance += (amount - perPerson);
              m.totalSpent += amount;
            } else {
              m.balance -= perPerson;
            }
          }
        });
      }
    });
    return newMembers;
  };

  const handleStartEditGroup = (group) => {
    setEditingGroup(group);
    setEditGroupName(group.name);
    setEditMembers(group.members.filter(m => m.phone !== 'self'));
  };

  const handleAddMemberToEdit = (contact) => {
    if (editMembers.find(m => m.phone === contact.phone)) return;
    setEditMembers([...editMembers, { name: contact.name, phone: contact.phone, balance: 0, totalSpent: 0, joined_at: new Date().toISOString(), left_at: null }]);
  };

  const handleRemoveMemberFromEdit = (phone) => {
    setEditMembers(editMembers.filter(m => m.phone !== phone));
  };

  const handleSaveEditGroup = async () => {
    if (!editGroupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }
    const organizer = editingGroup.members.find(m => m.phone === 'self') || { name: 'You', phone: 'self', balance: 0, totalSpent: 0, joined_at: editingGroup.date || new Date().toISOString(), left_at: null };
    const finalMembers = [...editMembers, organizer];
    const updatedMembers = recalculateBalances(finalMembers, editingGroup.expenses);

    await updateGroup(editingGroup.id, { name: editGroupName.trim(), members: updatedMembers });
    const updatedGroupObj = { ...editingGroup, name: editGroupName.trim(), members: updatedMembers };
    setSelectedGroup(updatedGroupObj);
    setEditingGroup(null);
    setEditGroupName('');
    setEditMembers([]);
  };

  const resetExpenseForm = () => {
    setAddExpenseModal(false);
    setEditingExpense(null);
    setExpTitle('');
    setExpAmount('');
    setPayerPhone('self');
  };

  const handleEditExpense = (exp) => {
    setEditingExpense(exp);
    setExpTitle(exp.title);
    setExpAmount(exp.amount.toString());
    setPayerPhone(exp.payerPhone);
    setAddExpenseModal(true);
  };

  const handleSettle = async () => {
    if (!settleAmount || !selectedGroup) return;
    const amount = Number(settleAmount);
    const idx = settleModal.memberIdx;
    
    const targetMember = selectedGroup.members[idx];
    
    const newSettlement = {
      id: Date.now().toString(),
      title: `Settlement: ${targetMember.name}`,
      amount,
      payerPhone: targetMember.balance >= 0 ? 'self' : targetMember.phone,
      date: new Date().toISOString(),
      is_settlement: true,
      splitMembers: targetMember.balance >= 0 ? [targetMember.phone] : ['self']
    };

    const updatedExpenses = [...selectedGroup.expenses, newSettlement];
    const updatedMembers = recalculateBalances(selectedGroup.members, updatedExpenses);

    await updateGroup(selectedGroup.id, { expenses: updatedExpenses, members: updatedMembers });
    setSelectedGroup({ ...selectedGroup, expenses: updatedExpenses, members: updatedMembers });
    setSettleModal(null);
    setSettleAmount('');
  };

  const generatePDFReport = async () => {
    if (!selectedGroup) return;

    try {
      // Use escapeHtml for all user data and formatCurrencyHTML (no rupee sign) to avoid WebView encoding issues
      const groupName = escapeHtml(selectedGroup.name);
      const reportDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

      const memberRows = (selectedGroup.members || []).map(m => {
        const name = escapeHtml(m.name || '');
        const spent = formatCurrencyHTML(m.totalSpent || 0);
        const balance = m.balance || 0;
        const balStr = (balance >= 0 ? '+' : '') + formatCurrencyHTML(balance);
        const balClass = balance >= 0 ? 'positive' : 'negative';
        const youBadge = m.phone === 'self' ? '<span class="chip">YOU</span>' : '';
        return `<tr><td><strong>${name}</strong>${youBadge}</td><td>${spent}</td><td class="amount ${balClass}">${balStr}</td></tr>`;
      }).join('');

      const expenseRows = (selectedGroup.expenses || []).map(exp => {
        const title = escapeHtml(exp.title || '');
        const payer = escapeHtml(selectedGroup.members.find(m => m.phone === exp.payerPhone)?.name || 'Someone');
        const date = exp.date ? new Date(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '';
        const amount = formatCurrencyHTML(exp.amount || 0);
        return `<tr><td>${title}</td><td>${payer}</td><td>${date}</td><td class="amount">${amount}</td></tr>`;
      }).join('');

      const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no">
<style>
body{font-family:Arial,sans-serif;padding:30px;color:#1F2937;line-height:1.5;}
.header{border-bottom:3px solid #6366F1;padding-bottom:20px;margin-bottom:30px;}
h1{color:#6366F1;margin:0;font-size:28px;}
.date{color:#6B7280;font-size:14px;margin-top:5px;}
.section{margin-bottom:40px;}
.section-title{font-size:18px;font-weight:800;color:#111827;margin-bottom:16px;text-transform:uppercase;letter-spacing:0.5px;}
table{width:100%;border-collapse:collapse;}
th{text-align:left;padding:10px 12px;background:#F9FAFB;color:#4B5563;font-size:11px;font-weight:700;text-transform:uppercase;border-bottom:2px solid #E5E7EB;}
td{padding:12px;border-bottom:1px solid #F3F4F6;font-size:13px;}
.amount{font-weight:700;text-align:right;font-family:monospace;font-size:14px;}
.positive{color:#059669;}
.negative{color:#DC2626;}
.footer{margin-top:40px;padding-top:20px;border-top:1px solid #E5E7EB;font-size:11px;color:#9CA3AF;text-align:center;}
.chip{display:inline-block;padding:2px 7px;border-radius:4px;background:#EEF2FF;color:#6366F1;font-size:10px;font-weight:700;margin-left:5px;}
</style>
</head>
<body>
<div class="header"><h1>${groupName}</h1><div class="date">Expense Report - Generated on ${reportDate}</div></div>
<div class="section"><div class="section-title">Settlement Summary</div>
<table><thead><tr><th>Member</th><th>Total Spent</th><th style="text-align:right">Net Balance</th></tr></thead>
<tbody>${memberRows}</tbody></table></div>
<div class="section"><div class="section-title">Transactions</div>
<table><thead><tr><th>Expense</th><th>Paid By</th><th>Date</th><th style="text-align:right">Amount</th></tr></thead>
<tbody>${expenseRows || '<tr><td colspan="4" style="text-align:center;color:#9CA3AF">No transactions yet</td></tr>'}</tbody></table></div>
<div class="footer">Generated by Spendify App</div>
</body></html>`;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Report - ${selectedGroup.name}`,
      });
    } catch (error) {
      console.error('PDF Generation Error:', error);
      Alert.alert('Report Error', `Could not generate PDF: ${error.message || 'Unknown error'}`);
    }
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
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="always">
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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="always">
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

      <Modal visible={!!selectedGroup} animationType="slide" onRequestClose={() => setSelectedGroup(null)}>
         <View style={styles.modalContainer}>
            {selectedGroup && (
              <>
                <View style={styles.modalHeader}>
                   <TouchableOpacity onPress={() => setSelectedGroup(null)} style={styles.modalCloseBtn}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
                   <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, marginHorizontal: 12 }}>
                      <Text style={styles.modalTitle} numberOfLines={1}>{selectedGroup.name}</Text>
                      <TouchableOpacity onPress={() => handleStartEditGroup(selectedGroup)} style={styles.editIconBtn}>
                         <Text style={{ fontSize: 18 }}>✏️</Text>
                      </TouchableOpacity>
                   </View>
                   <TouchableOpacity onPress={() => setAddExpenseModal(true)} style={styles.modalAddBtn}><Text style={styles.addExpBtnText}>+ Expense</Text></TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 80 }} keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>
                   <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionTitle}>Balances & Settlement</Text>
                      <TouchableOpacity style={styles.reportBtn} onPress={generatePDFReport}>
                        <Text style={styles.reportBtnText}>📄 Report</Text>
                      </TouchableOpacity>
                   </View>
                   <View style={styles.balanceCard}>
                      {selectedGroup.members.map((m, i) => (
                        <View key={i} style={styles.memberBalanceItem}>
                           <View style={{ flex: 1 }}>
                             <Text style={styles.mName}>{m.name} {m.phone === 'self' ? '(You)' : ''}</Text>
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

                   <Text style={[styles.sectionTitle, { marginTop: 32, marginBottom: 16 }]}>History</Text>
                   {selectedGroup.expenses.length === 0 ? (
                      <View style={styles.emptyHistory}>
                         <Text style={styles.emptyHistoryText}>No expenses logged yet.</Text>
                      </View>
                    ) : (
                      selectedGroup.expenses.map((exp, i) => (
                        <TouchableOpacity 
                          key={exp.id || i} 
                          style={styles.expItem}
                          onPress={() => {
                            Alert.alert(
                              'Group Expense',
                              `Manage "${exp.title}"`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Delete', style: 'destructive', onPress: () => handleDeleteExpense(exp.id) },
                                { text: 'Edit', onPress: () => handleEditExpense(exp) },
                              ]
                            );
                          }}
                        >
                           <View style={styles.expIcon}><Text>🧾</Text></View>
                           <View style={{ flex: 1, marginLeft: 12 }}>
                             <Text style={styles.expTitle}>{exp.title}</Text>
                             <Text style={styles.expSub}>Paid by {selectedGroup.members.find(m => m.phone === exp.payerPhone)?.name || 'Someone'}</Text>
                           </View>
                           <Text style={styles.expAmount}>{formatCurrency(exp.amount)}</Text>
                        </TouchableOpacity>
                      ))
                    )}
                   <View style={{ height: 60 }} />
                </ScrollView>

                <Modal visible={!!settleModal} transparent animationType="fade" onRequestClose={() => setSettleModal(null)}>
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

                <Modal visible={addExpenseModal} transparent animationType="fade" onRequestClose={resetExpenseForm}>
                   <View style={styles.overlay}>
                      <View style={styles.formCard}>
                         <Text style={styles.formTitle}>{editingExpense ? 'Edit Group Expense' : 'Add Group Expense'}</Text>
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
                            <TouchableOpacity style={styles.cancelBtn} onPress={resetExpenseForm}>
                               <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={() => handleAddExpenseToGroup()}>
                               <Text style={styles.saveBtnText}>{editingExpense ? 'Update' : 'Add'}</Text>
                            </TouchableOpacity>
                         </View>
                      </View>
                   </View>
                </Modal>

                {/* Edit Group Modal */}
                 <Modal visible={!!editingGroup} transparent animationType="slide" onRequestClose={() => setEditingGroup(null)}>
                    <View style={styles.overlay}>
                       <View style={styles.editGroupCard}>
                          <Text style={styles.formTitle}>Edit Group</Text>
                          
                          <Text style={styles.label}>Group Name</Text>
                          <TextInput 
                            style={styles.input} 
                            placeholder="Group Name" 
                            placeholderTextColor={COLORS.textMuted} 
                            value={editGroupName} 
                            onChangeText={setEditGroupName} 
                          />
                          
                          <Text style={styles.label}>Members</Text>
                          <ScrollView style={{ maxHeight: 200, marginBottom: 12 }}>
                             {editMembers.map((m, i) => (
                               <View key={i} style={[styles.editMemberRow, { flexDirection: 'column', alignItems: 'stretch', gap: 6, padding: 12 }]}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                     <View style={styles.memberAvatar}><Text style={styles.memberAvatarText}>{m.name[0]}</Text></View>
                                     <Text style={styles.memberName}>{m.name}</Text>
                                     <TouchableOpacity onPress={() => handleRemoveMemberFromEdit(m.phone)}>
                                       <Text style={{ color: COLORS.red, fontWeight: '700' }}>Remove</Text>
                                     </TouchableOpacity>
                                  </View>
                                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                                     <View style={{ flex: 1 }}>
                                        <Text style={{ color: COLORS.textSecondary, fontSize: 10 }}>JOIN (YYYY-MM-DD)</Text>
                                        <TextInput
                                           style={[styles.input, { padding: 8, fontSize: 12, marginBottom: 0, marginTop: 4, height: 36 }]}
                                           value={m.joined_at ? m.joined_at.split('T')[0] : ''}
                                           placeholder="e.g. 2026-04-15"
                                           placeholderTextColor={COLORS.textMuted}
                                           onChangeText={(val) => {
                                              const updated = [...editMembers];
                                              try {
                                                updated[i].joined_at = val ? new Date(val).toISOString() : new Date().toISOString();
                                              } catch (e) {}
                                              setEditMembers(updated);
                                           }}
                                        />
                                     </View>
                                     <View style={{ flex: 1 }}>
                                        <Text style={{ color: COLORS.textSecondary, fontSize: 10 }}>LEAVE (YYYY-MM-DD)</Text>
                                        <TextInput
                                           style={[styles.input, { padding: 8, fontSize: 12, marginBottom: 0, marginTop: 4, height: 36 }]}
                                           value={m.left_at ? m.left_at.split('T')[0] : ''}
                                           placeholder="Active"
                                           placeholderTextColor={COLORS.textMuted}
                                           onChangeText={(val) => {
                                              const updated = [...editMembers];
                                              try {
                                                updated[i].left_at = val ? new Date(val).toISOString() : null;
                                              } catch (e) {}
                                              setEditMembers(updated);
                                           }}
                                        />
                                     </View>
                                  </View>
                               </View>
                             ))}
                           </ScrollView>

                          <TouchableOpacity style={styles.addBtn} onPress={() => setShowEditContacts(true)}>
                            <Text style={styles.addBtnText}>+ Add Member</Text>
                          </TouchableOpacity>

                          <View style={[styles.row, { marginTop: 24 }]}>
                             <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditingGroup(null); setEditMembers([]); }}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                             </TouchableOpacity>
                             <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEditGroup}>
                                <Text style={styles.saveBtnText}>Save</Text>
                             </TouchableOpacity>
                          </View>
                       </View>
                    </View>
                 </Modal>

                 <ContactPicker visible={showEditContacts} onClose={() => setShowEditContacts(false)} onSelect={handleAddMemberToEdit} />
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
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, marginBottom: 16 },
  sectionTitle: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  reportBtn: { backgroundColor: '#6366F120', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#6366F140' },
  reportBtnText: { color: '#6366F1', fontWeight: '700', fontSize: 14 },
  balanceCard: { backgroundColor: '#18181B', padding: 20, borderRadius: 28, borderWidth: 1, borderColor: '#27272A' },
  memberBalanceItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#27272A50' },
  mName: { color: '#fff', fontSize: 20, fontWeight: '700' },
  mSpent: { color: '#71717A', fontSize: 12, marginTop: 2, fontWeight: '600' },
  mBalance: { fontWeight: '600', fontSize: 18, marginTop: 6 },
  mBalanceLabel: { fontSize: 12, fontWeight: '500' },
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
  editIconBtn: { padding: 4, marginLeft: 6 },
  editGroupCard: { backgroundColor: '#18181B', padding: 24, borderRadius: 28, borderWidth: 1, borderColor: '#6366F140', width: '100%', maxHeight: '85%' },
  editMemberRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#27272A', padding: 12, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: '#3F3F46' },
});
