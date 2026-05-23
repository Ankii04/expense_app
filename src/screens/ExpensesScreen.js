import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, TouchableOpacity, Modal, TextInput, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, formatCurrency, CATEGORIES } from '../utils/theme';
import { useExpenses, useGroups } from '../hooks/useExpenses';
import ExpenseCard from '../components/ExpenseCard';
import CategoryPicker from '../components/CategoryPicker';

export default function ExpensesScreen() {
  const { expenses, loading, refresh, deleteExpense, addExpense, updateExpense } = useExpenses();
  const { groups, updateGroup, refresh: refreshGroups } = useGroups();
  const [filter, setFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingExpense, setEditingExpense] = useState(null);

  // Form state
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState('other');
  
  // Group split state
  const [splitGroupId, setSplitGroupId] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]); // Array of phones
  const [splitType, setSplitType] = useState('equal'); // 'equal' or 'custom'
  const [customShares, setCustomShares] = useState({}); // phone -> amount string

  useFocusEffect(useCallback(() => { refresh(); refreshGroups(); }, [refresh, refreshGroups]));

  const filtered = expenses.filter((e) => {
    const matchesFilter = filter === 'all' || e.category === filter;
    const matchesSearch = searchQuery === '' || 
      (e.note && e.note.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (e.payeeName && e.payeeName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const handleDelete = (exp) => {
    Alert.alert('Delete Expense', `Remove ${formatCurrency(exp.amount)}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteExpense(exp.id) },
    ]);
  };

  const handleEdit = (exp) => {
    setEditingExpense(exp);
    setAmount(exp.amount.toString());
    setNote(exp.note || exp.payeeName);
    setCategory(exp.category);
    setShowAddModal(true);
  };

  const recalculateBalances = (members, expenses) => {
    const newMembers = members.map(m => ({ ...m, balance: 0, totalSpent: 0 }));
    expenses.forEach(exp => {
      const amount = Number(exp.amount);
      
      if (exp.shares) {
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

  const handleSaveExpense = async () => {
    if (!amount || Number(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    const expAmount = Number(amount);
    const expNote = note || 'Manual Entry';

    if (splitGroupId && splitType === 'custom' && selfShare < 0) {
      Alert.alert('Invalid Splits', 'Sum of custom shares exceeds total amount!');
      return;
    }

    if (editingExpense) {
      // Update existing
      await updateExpense(editingExpense.id, {
        amount: expAmount,
        note: expNote,
        category: category,
        payeeName: expNote,
      });
    } else {
      // 1. Add to main expenses
      await addExpense({
        amount: expAmount,
        note: expNote,
        category: category,
        payeeName: expNote,
        date: new Date().toISOString(),
      });

      // 2. If splitting with group, update group balances
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
    }

    resetForm();
  };

  const resetForm = () => {
    setShowAddModal(false);
    setEditingExpense(null);
    setAmount('');
    setNote('');
    setCategory('other');
    setSplitGroupId(null);
    setSelectedMembers([]);
    setSplitType('equal');
    setCustomShares({});
  };

  const handleToggleGroup = (groupId) => {
    if (splitGroupId === groupId) {
      setSplitGroupId(null);
      setSelectedMembers([]);
      setSplitType('equal');
      setCustomShares({});
    } else {
      setSplitGroupId(groupId);
      setSplitType('equal');
      setCustomShares({});
      const group = groups.find(g => g.id === groupId);
      if (group) {
        // Select all members except 'self' by default
        setSelectedMembers(group.members.filter(m => m.phone !== 'self').map(m => m.phone));
      }
    }
  };

  const toggleMember = (phone) => {
    if (selectedMembers.includes(phone)) {
      setSelectedMembers(selectedMembers.filter(p => p !== phone));
      setCustomShares(prev => {
        const copy = { ...prev };
        delete copy[phone];
        return copy;
      });
    } else {
      setSelectedMembers([...selectedMembers, phone]);
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
    ? (Number(amount) || 0) - totalCustomSplitAmount
    : (Number(amount) || 0) / (selectedMembers.length + 1);

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>History</Text>
          <Text style={styles.subtitle}>Track your spending</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity 
            style={[styles.addBtn, { backgroundColor: COLORS.redDim, borderColor: COLORS.red + '30' }]} 
            onPress={() => {
              Alert.alert('Clear History', 'Are you sure you want to delete ALL expenses?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear All', style: 'destructive', onPress: async () => {
                  for (const exp of expenses) {
                    await deleteExpense(exp.id);
                  }
                  Alert.alert('Success', 'History cleared');
                }},
              ]);
            }}
          >
            <Text style={[styles.addBtnText, { color: COLORS.red }]}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
            <Text style={styles.addBtnText}>+ Add Cash</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by note or payee..."
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery !== '' && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearch}>
            <Text style={styles.clearSearchText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.summaryCard}>
        <View>
          <Text style={styles.summaryLabel}>{filter === 'all' ? 'Total Spent' : `${filter} Spending`}</Text>
          <Text style={styles.summaryAmount}>{formatCurrency(total)}</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{filtered.length} items</Text>
        </View>
      </View>

      <View style={styles.filterContainer}>
        <CategoryPicker selected={filter} onSelect={setFilter} showAll />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={refresh}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <ExpenseCard 
            expense={item} 
            onPress={() => {
              Alert.alert(
                'Expense Actions',
                `What would you like to do with ${item.note || item.payeeName || 'this expense'}?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => handleDelete(item) },
                  { text: 'Edit', onPress: () => handleEdit(item) },
                ]
              );
            }}
            onDelete={() => handleDelete(item)} 
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 64, marginBottom: 20 }}>💸</Text>
            <Text style={styles.emptyTitle}>No expenses found</Text>
            <Text style={styles.emptySub}>
              {filter !== 'all' ? 'Try a different category' : 'Manual entry or scan to start'}
            </Text>
            {filter === 'all' && (
              <TouchableOpacity style={styles.emptyAddBtn} onPress={() => setShowAddModal(true)}>
                <Text style={styles.emptyAddBtnText}>Add your first expense</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Manual Add Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingExpense ? 'Edit Expense' : 'Manual Expense'}</Text>
              <TouchableOpacity onPress={resetForm}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Amount (₹)</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                autoFocus
              />

              <Text style={styles.label}>Note / Payee</Text>
              <TextInput
                style={styles.input}
                placeholder="What did you buy?"
                placeholderTextColor={COLORS.textMuted}
                value={note}
                onChangeText={setNote}
              />

              <Text style={styles.label}>Category</Text>
              <View style={styles.catGrid}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.catItem, category === c.id && { borderColor: c.color, backgroundColor: c.color + '15' }]}
                    onPress={() => setCategory(c.id)}
                  >
                    <Text style={styles.catEmoji}>{c.emoji}</Text>
                    <Text style={[styles.catName, category === c.id && { color: c.color }]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

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
                       <Text style={styles.memberSelectTitle}>Split Type:</Text>
                       <View style={styles.typeRow}>
                         {['equal', 'custom'].map((t) => (
                           <TouchableOpacity key={t} style={[styles.typeBtn, splitType === t && styles.typeBtnActive]} onPress={() => setSplitType(t)}>
                             <Text style={[styles.typeBtnText, splitType === t && { color: COLORS.accent }]}>{t === 'equal' ? '⚖️ Equal' : '✏️ Custom'}</Text>
                           </TouchableOpacity>
                         ))}
                       </View>

                       <Text style={[styles.memberSelectTitle, { marginTop: 12 }]}>Select members to include:</Text>
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

                       {splitType === 'custom' && selectedMembers.length > 0 && (
                         <View style={{ marginTop: 16, gap: 10 }}>
                           <Text style={styles.memberSelectTitle}>Enter Custom Shares (₹):</Text>
                           {selectedMembers.map(phone => {
                             const mObj = groups.find(g => g.id === splitGroupId)?.members.find(m => m.phone === phone);
                             if (!mObj) return null;
                             return (
                               <View key={phone} style={styles.customShareRow}>
                                 <Text style={styles.customShareName}>{mObj.name}</Text>
                                 <TextInput
                                   style={styles.customShareInput}
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

                       {amount ? (
                         <Text style={[styles.perShareText, { marginTop: 12 }]}>
                           {splitType === 'custom'
                             ? (selfShare < 0 ? '⚠️ Invalid custom shares sum' : `Your share: ${formatCurrency(selfShare)}`)
                             : `Your share: ${formatCurrency(selfShare)} each`}
                         </Text>
                       ) : null}
                    </View>
                  )}
                </>
              )}

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveExpense}>
                <Text style={styles.saveBtnText}>{editingExpense ? 'Update Expense' : 'Save Expense'}</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md
  },
  title: { color: COLORS.textPrimary, fontSize: FONT_SIZE.xxxl, fontWeight: '800' },
  subtitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, marginTop: 2 },
  addBtn: {
    backgroundColor: COLORS.accentDim,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.accent + '30'
  },
  addBtnText: { color: COLORS.accent, fontWeight: '700', fontSize: FONT_SIZE.sm },
  summaryCard: {
    marginHorizontal: SPACING.xl,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  summaryLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  summaryAmount: { color: COLORS.textPrimary, fontSize: FONT_SIZE.hero, fontWeight: '800', marginTop: 4 },
  countBadge: { backgroundColor: COLORS.elevated, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  countText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, fontWeight: '700' },
  filterContainer: { marginBottom: SPACING.md },
  list: { paddingHorizontal: SPACING.xl, paddingBottom: 120 },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.xl, fontWeight: '700' },
  emptySub: { color: COLORS.textMuted, fontSize: FONT_SIZE.md, marginTop: 8, textAlign: 'center' },
  emptyAddBtn: { marginTop: 24, backgroundColor: COLORS.accent, paddingHorizontal: 24, paddingVertical: 14, borderRadius: BORDER_RADIUS.lg },
  emptyAddBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md },

  // Search
  searchContainer: {
    marginHorizontal: SPACING.xl,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: 16,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.md,
    height: 44,
  },
  clearSearch: {
    padding: 8,
  },
  clearSearchText: {
    color: COLORS.textMuted,
    fontSize: 16,
    fontWeight: '700',
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.xl, fontWeight: '800' },
  closeText: { color: COLORS.textMuted, fontSize: 24 },
  label: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: '600', marginBottom: 12, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  amountInput: {
    color: COLORS.accent,
    fontSize: 48,
    fontWeight: '800',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.accent + '40',
    marginBottom: 20
  },
  input: {
    backgroundColor: COLORS.elevated,
    borderRadius: BORDER_RADIUS.md,
    padding: 16,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10
  },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  catItem: {
    width: '31%',
    backgroundColor: COLORS.elevated,
    borderRadius: BORDER_RADIUS.md,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border
  },
  catEmoji: { fontSize: 24, marginBottom: 4 },
  catName: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, fontWeight: '600' },
  saveBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 32,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5
  },
  saveBtnText: { color: '#fff', fontSize: FONT_SIZE.md, fontWeight: '800' },
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
  typeRow: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  typeBtn: { flex: 1, backgroundColor: COLORS.card, borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  typeBtnActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accent + '20' },
  typeBtnText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },
  customShareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.card, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  customShareName: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  customShareInput: { backgroundColor: COLORS.elevated, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', minWidth: 70, textAlign: 'right', borderWidth: 1, borderColor: COLORS.border },
  perShareText: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center' },
});
