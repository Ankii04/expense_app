import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, BORDER_RADIUS, FONT_SIZE, formatCurrency, formatDate, getCategoryById } from '../utils/theme';

const UPI_APP_COLORS = {
  gpay: '#4285F4',
  phonepe: '#5F259F',
  paytm: '#00BAF2',
  bhim: '#00694A',
  cred: '#1C1C1E',
  amazonpay: '#FF9900',
};

export default function ExpenseCard({ expense, onPress, onLongPress }) {
  const cat = getCategoryById(expense.category);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
    >
      {/* Category icon */}
      <View style={[styles.iconWrap, { backgroundColor: cat.color + '20' }]}>
        <Text style={styles.emoji}>{cat.emoji}</Text>
      </View>

      {/* Middle info */}
      <View style={styles.mid}>
        <Text style={styles.note} numberOfLines={1}>
          {expense.note || expense.payeeName || cat.name}
        </Text>
        <View style={styles.subRow}>
          <Text style={styles.subText}>{formatDate(expense.date)}</Text>
          {/* UPI App Badge — Feature 4 */}
          {expense.upiApp ? (
            <View style={[styles.upiAppBadge, { backgroundColor: UPI_APP_COLORS[expense.upiApp?.toLowerCase()?.replace(/\s/g, '')] || COLORS.elevated }]}>
              <Text style={styles.upiAppText}>
                {expense.upiApp.replace('Google Pay', 'GPay').replace('PhonePe', 'PhonePe').replace('Amazon Pay', 'AmazonPay')}
              </Text>
            </View>
          ) : null}
          {expense.upiId ? (
            <Text style={styles.upiIdText} numberOfLines={1}>{expense.upiId}</Text>
          ) : null}
        </View>
      </View>

      {/* Amount */}
      <Text style={styles.amount}>-{formatCurrency(expense.amount)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emoji: { fontSize: 20 },
  mid: { flex: 1, marginRight: 8 },
  note: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    marginBottom: 4,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  subText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
  },
  upiAppBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  upiAppText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  upiIdText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    maxWidth: 100,
  },
  amount: {
    color: COLORS.red,
    fontSize: FONT_SIZE.md,
    fontWeight: '800',
  },
});
