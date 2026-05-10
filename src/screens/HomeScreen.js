import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, CATEGORIES, formatCurrency, getCategoryById } from '../utils/theme';
import { useExpenses } from '../hooks/useExpenses';
import ExpenseCard from '../components/ExpenseCard';

const SCREEN_W = Dimensions.get('window').width;
const CHART_W = SCREEN_W - 40;
const CHART_H = 180;
const BAR_GAP = 6;

export default function HomeScreen({ navigation }) {
  const { expenses, monthTotal, categorySpend, loading, refresh } = useExpenses();

  // Refresh data when screen is focused
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const recentExpenses = expenses.slice(0, 5);

  // Build bar chart data
  const chartData = CATEGORIES.map((cat) => ({
    ...cat,
    amount: categorySpend[cat.id] || 0,
  })).filter((c) => c.amount > 0);

  const maxAmount = Math.max(...chartData.map((c) => c.amount), 1);

  const now = new Date();
  const monthName = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={COLORS.accent} />}
    >
      {/* ─── Header ───────────────────────────────── */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.greeting}>Antigravity</Text>
          <Text style={styles.month}>{monthName}</Text>
        </View>
        <View style={styles.logoWrap}>
          <Text style={styles.logo}>⚡</Text>
        </View>
      </View>

      {/* ─── Total Spent Card ─────────────────────── */}
      <View style={styles.totalCard}>
        <View style={styles.totalGlow} />
        <Text style={styles.totalLabel}>Total Spent</Text>
        <Text style={styles.totalAmount}>{formatCurrency(monthTotal)}</Text>
        <Text style={styles.totalSub}>{expenses.length} transactions this month</Text>
      </View>

      {/* ─── Category Breakdown Chart ─────────────── */}
      {chartData.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spend by Category</Text>
          <View style={styles.chartCard}>
            <Svg width={CHART_W} height={CHART_H}>
              {chartData.map((cat, i) => {
                const barW = Math.max(
                  (CHART_W - chartData.length * BAR_GAP) / chartData.length,
                  20,
                );
                const barH = (cat.amount / maxAmount) * (CHART_H - 40);
                const x = i * (barW + BAR_GAP);
                const y = CHART_H - 24 - barH;

                return (
                  <React.Fragment key={cat.id}>
                    {/* Bar background */}
                    <Rect
                      x={x}
                      y={CHART_H - 24 - (CHART_H - 40)}
                      width={barW}
                      height={CHART_H - 40}
                      rx={6}
                      fill={COLORS.border}
                    />
                    {/* Bar value */}
                    <Rect
                      x={x}
                      y={y}
                      width={barW}
                      height={barH}
                      rx={6}
                      fill={cat.color}
                      opacity={0.85}
                    />
                    {/* Emoji label */}
                    <SvgText
                      x={x + barW / 2}
                      y={CHART_H - 6}
                      fontSize={12}
                      fill={COLORS.textSecondary}
                      textAnchor="middle"
                    >
                      {cat.emoji}
                    </SvgText>
                  </React.Fragment>
                );
              })}
            </Svg>
            {/* Legend */}
            <View style={styles.legendRow}>
              {chartData.map((cat) => (
                <View key={cat.id} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: cat.color }]} />
                  <Text style={styles.legendText}>{formatCurrency(cat.amount)}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* ─── Recent Expenses ──────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Expenses</Text>
          {expenses.length > 5 && (
            <Text
              style={styles.seeAll}
              onPress={() => navigation.navigate('ExpensesTab')}
            >
              See all →
            </Text>
          )}
        </View>

        {recentExpenses.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>💸</Text>
            <Text style={styles.emptyTitle}>No expenses yet</Text>
            <Text style={styles.emptySub}>
              Scan a QR code to make your first payment
            </Text>
          </View>
        ) : (
          recentExpenses.map((exp) => (
            <ExpenseCard
              key={exp.id}
              expense={exp}
              onPress={() => {}}
            />
          ))
        )}
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: SPACING.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  greeting: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.xxxl,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  month: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
    marginTop: 4,
  },
  logoWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.accent + '40',
  },
  logo: {
    fontSize: 22,
  },

  // Total card
  totalCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xxl,
    marginBottom: SPACING.xxl,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    position: 'relative',
  },
  totalGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.accentGlow,
  },
  totalLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  totalAmount: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.hero,
    fontWeight: '800',
    marginTop: SPACING.sm,
    letterSpacing: -1,
  },
  totalSub: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.xs,
  },

  // Sections
  section: {
    marginBottom: SPACING.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  seeAll: {
    color: COLORS.accent,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    marginBottom: SPACING.md,
  },

  // Chart
  chartCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.md,
    gap: SPACING.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
  },

  // Empty
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xxxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
  emptySub: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
});
