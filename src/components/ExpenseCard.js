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
      <View style={styles.left}>
        <View style={[styles.iconWrap, { backgroundColor: cat.color + '18' }]}>
          <Text style={styles.emoji}>{cat.emoji}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {expense.payeeName || expense.note || cat.name}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {expense.upiId ? expense.upiId : cat.name}
            {expense.contactName ? ` • ${expense.contactName}` : ''}
          </Text>
        </View>
      </View>

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
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  emoji: {
    fontSize: 22,
  },
  info: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  sub: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    marginTop: 4,
    fontWeight: '500',
  },
  right: {
    alignItems: 'flex-end',
    marginLeft: SPACING.sm,
  },
  amount: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
  },
  date: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 6,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
