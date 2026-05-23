import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert, Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Rect } from 'react-native-svg';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, CATEGORIES, formatCurrency, getCategoryById, getMonthKey } from '../utils/theme';
import { useBudgets, useExpenses } from '../hooks/useExpenses';

const SCREEN_W = Dimensions.get('window').width;
const BAR_W = SCREEN_W - 120;

export default function BudgetScreen() {
  const { budgets, setBudget, deleteBudget, refresh: refreshBudgets } = useBudgets();
  const { categorySpend, monthTotal, refresh: refreshExpenses } = useExpenses();
  const [editCat, setEditCat] = useState(null);
  const [editAmt, setEditAmt] = useState('');

  useFocusEffect(useCallback(() => { refreshBudgets(); refreshExpenses(); }, [refreshBudgets, refreshExpenses]));

  const handleSave = async () => {
    if (!editCat || !editAmt) return;
    await setBudget(editCat, Number(editAmt));
    setEditCat(null);
    setEditAmt('');
  };

  const handleDelete = (catId) => {
    Alert.alert('Remove Budget', 'Delete this budget?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteBudget(catId) },
    ]);
  };

  const catsWithBudget = CATEGORIES.filter((c) => budgets[c.id] > 0);
  const catsWithout = CATEGORIES.filter((c) => !budgets[c.id]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Budgets</Text>
      <Text style={styles.subtitle}>Monthly spending limits</Text>

      {/* Total Monthly Budget Card */}
      <TouchableOpacity 
        style={[styles.budgetCard, { borderColor: COLORS.accent + '60', backgroundColor: COLORS.accent + '08' }]} 
        activeOpacity={0.8}
        onPress={() => { setEditCat('total'); setEditAmt(budgets['total'] ? budgets['total'].toString() : ''); }}
      >
        <View style={styles.budgetHeader}>
          <Text style={styles.budgetEmoji}>💰</Text>
          <Text style={[styles.budgetName, { color: COLORS.accent }]}>Total Monthly Budget</Text>
          <Text style={[styles.budgetPct, { color: COLORS.accent }]}>
            {budgets['total'] ? Math.round(Math.min(monthTotal / budgets['total'], 1) * 100) : 0}%
          </Text>
        </View>
        <View style={[styles.barBg, { backgroundColor: COLORS.accent + '20' }]}>
          <View 
            style={[
              styles.barFill, 
              { 
                width: `${budgets['total'] ? Math.min(monthTotal / budgets['total'], 1) * 100 : 0}%`, 
                backgroundColor: COLORS.accent 
              }
            ]} 
          />
        </View>
        <View style={styles.budgetFooter}>
          <Text style={styles.budgetSpent}>{formatCurrency(monthTotal)} spent overall</Text>
          <Text style={styles.budgetLimit}>
            {budgets['total'] ? `Limit: ${formatCurrency(budgets['total'])}` : 'Set limit'}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Category Budgets</Text>

      {/* Active budgets */}
      {catsWithBudget.filter(c => c.id !== 'total').map((cat) => {
        const budget = budgets[cat.id];
        const spent = categorySpend[cat.id] || 0;
        const pct = budget > 0 ? Math.min(spent / budget, 1) : 0;
        const over80 = pct >= 0.8;
        const barColor = over80 ? COLORS.red : cat.color;

        return (
          <TouchableOpacity 
            key={cat.id} 
            style={styles.budgetCard} 
            activeOpacity={0.8} 
            onPress={() => { setEditCat(cat.id); setEditAmt(budget.toString()); }}
            onLongPress={() => handleDelete(cat.id)}
          >
            <View style={styles.budgetHeader}>
              <Text style={styles.budgetEmoji}>{cat.emoji}</Text>
              <Text style={styles.budgetName}>{cat.name}</Text>
              <Text style={[styles.budgetPct, over80 && { color: COLORS.red }]}>{Math.round(pct * 100)}%</Text>
            </View>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
            </View>
            <View style={styles.budgetFooter}>
              <Text style={styles.budgetSpent}>{formatCurrency(spent)} spent</Text>
              <Text style={styles.budgetLimit}>of {formatCurrency(budget)}</Text>
            </View>
            {over80 && <Text style={styles.warningText}>⚠️ Approaching limit!</Text>}
          </TouchableOpacity>
        );
      })}

      {catsWithBudget.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={{ fontSize: 36, marginBottom: 12 }}>📊</Text>
          <Text style={styles.emptyTitle}>No budgets set</Text>
          <Text style={styles.emptySub}>Set spending limits for categories below</Text>
        </View>
      )}

      {/* Add budget */}
      <Text style={styles.addTitle}>Add Budget</Text>
      {editCat ? (
        <View style={styles.editCard}>
          <Text style={styles.editLabel}>
            {editCat === 'total' ? '💰   Total Monthly Budget' : `${getCategoryById(editCat).emoji}   ${getCategoryById(editCat).name}`}
          </Text>
          <TextInput style={styles.editInput} placeholder="Monthly limit (₹)" placeholderTextColor={COLORS.textMuted} value={editAmt} onChangeText={setEditAmt} keyboardType="numeric" autoFocus />
          <View style={styles.editBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditCat(null); setEditAmt(''); }}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.catGrid}>
          {catsWithout.map((cat) => (
            <TouchableOpacity key={cat.id} style={styles.catChip} onPress={() => setEditCat(cat.id)}>
              <Text style={{ fontSize: 18, marginRight: 8 }}>{cat.emoji}</Text>
              <Text style={styles.catChipText}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingTop: 60, paddingHorizontal: SPACING.xl },
  title: { color: COLORS.textPrimary, fontSize: FONT_SIZE.xxxl, fontWeight: '800' },
  subtitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md, marginTop: 4, marginBottom: 24 },
  budgetCard: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  budgetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  budgetEmoji: { fontSize: 20, marginRight: 10 },
  budgetName: { color: COLORS.textPrimary, fontSize: FONT_SIZE.md, fontWeight: '600', flex: 1 },
  budgetPct: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: '700' },
  barBg: { height: 8, backgroundColor: COLORS.elevated, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  budgetFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  budgetSpent: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm },
  budgetLimit: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm },
  warningText: { color: COLORS.red, fontSize: FONT_SIZE.xs, fontWeight: '600', marginTop: 8 },
  emptyCard: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.xl, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, marginBottom: 24 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.lg, fontWeight: '700' },
  emptySub: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginTop: 4 },
  addTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.lg, fontWeight: '700', marginTop: 8, marginBottom: 16 },
  editCard: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.accent + '40' },
  editLabel: { color: COLORS.textPrimary, fontSize: FONT_SIZE.lg, fontWeight: '600', marginBottom: 12 },
  editInput: { backgroundColor: COLORS.elevated, borderRadius: BORDER_RADIUS.md, paddingHorizontal: 16, paddingVertical: 14, color: COLORS.textPrimary, fontSize: FONT_SIZE.xl, fontWeight: '700', borderWidth: 1, borderColor: COLORS.border },
  editBtns: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 12 },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.elevated },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '600' },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.accent },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.full, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border, gap: 6 },
  catChipText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: '500' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 24, opacity: 0.5 },
  sectionTitle: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
});
