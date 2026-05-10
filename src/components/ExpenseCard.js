import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, getCategoryById, formatCurrency, formatDate } from '../utils/theme';

export default function ExpenseCard({ expense, onPress, onDelete }) {
  const cat = getCategoryById(expense.category);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      onLongPress={onDelete}
      style={styles.card}
    >
      {/* Category icon */}
      <View style={[styles.iconWrap, { backgroundColor: cat.color + '18' }]}>
        <Text style={styles.emoji}>{cat.emoji}</Text>
      </View>

      {/* Middle */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {expense.payeeName || expense.note || cat.name}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {expense.upiId ? expense.upiId : cat.name}
          {expense.contactName ? ` • ${expense.contactName}` : ''}
        </Text>
      </View>

      {/* Right */}
      <View style={styles.right}>
        <Text style={styles.amount}>{formatCurrency(expense.amount)}</Text>
        <Text style={styles.date}>{formatDate(expense.date)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  emoji: {
    fontSize: 20,
  },
  info: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
  sub: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
  },
  amount: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  date: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    marginTop: 2,
  },
});
