import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, formatCurrency } from '../utils/theme';
import { useExpenses } from '../hooks/useExpenses';
import ExpenseCard from '../components/ExpenseCard';
import CategoryPicker from '../components/CategoryPicker';

export default function ExpensesScreen() {
  const { expenses, loading, refresh, deleteExpense } = useExpenses();
  const [filter, setFilter] = useState('all');

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const filtered = filter === 'all' ? expenses : expenses.filter((e) => e.category === filter);

  const handleDelete = (exp) => {
    Alert.alert('Delete Expense', `Remove ${formatCurrency(exp.amount)}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteExpense(exp.id) },
    ]);
  };

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Expenses</Text>
        <Text style={styles.totalBadge}>{formatCurrency(total)}</Text>
      </View>

      <CategoryPicker selected={filter} onSelect={setFilter} showAll />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={refresh}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ExpenseCard expense={item} onDelete={() => handleDelete(item)} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🧾</Text>
            <Text style={styles.emptyTitle}>No expenses found</Text>
            <Text style={styles.emptySub}>
              {filter !== 'all' ? 'Try a different category' : 'Start tracking your spending'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingHorizontal: SPACING.xl, paddingBottom: SPACING.md },
  title: { color: COLORS.textPrimary, fontSize: FONT_SIZE.xxxl, fontWeight: '800' },
  totalBadge: { backgroundColor: COLORS.accentDim, color: COLORS.accent, fontSize: FONT_SIZE.md, fontWeight: '700', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, overflow: 'hidden' },
  list: { paddingHorizontal: SPACING.xl, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.lg, fontWeight: '700' },
  emptySub: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginTop: 4 },
});
