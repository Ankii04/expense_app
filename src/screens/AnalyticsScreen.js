import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path, G, Rect } from 'react-native-svg';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, CATEGORIES, formatCurrency } from '../utils/theme';
import { useExpenses } from '../hooks/useExpenses';
import { getExpensesByMonth } from '../store/expenseStore';

const SCREEN_W  = Dimensions.get('window').width;
// Pie chart must fit inside card (screen - 40 outer padding - 40 card padding)
const PIE_SIZE  = Math.min(200, SCREEN_W - 80);
const RADIUS    = PIE_SIZE / 2;
const CHART_H   = 150;
// card padding=16 each side (32 total) + yAxis width 36 = 68
const CHART_W   = SCREEN_W - 40 - 68; // screen - outer padding - (card padding + y-axis)

export default function AnalyticsScreen({ navigation }) {
  const { expenses, monthTotal, categorySpend, refresh } = useExpenses();
  const [monthlyData, setMonthlyData] = useState([]);

  useFocusEffect(useCallback(() => {
    refresh();
    loadSixMonths();
  }, [refresh]));

  const loadSixMonths = async () => {
    const now = new Date();
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-IN', { month: 'short' });
      try {
        const exps = await getExpensesByMonth(key);
        const total = exps.reduce((s, e) => s + e.amount, 0);
        data.push({ key, label, total });
      } catch {
        data.push({ key, label, total: 0 });
      }
    }
    setMonthlyData(data);
  };

  const chartData = CATEGORIES.map(cat => ({
    ...cat,
    amount: categorySpend[cat.id] || 0,
  })).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);

  // Pie chart helpers
  let cumulativeAngle = 0;
  const polarToCartesian = (cx, cy, r, deg) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const describeArc = (x, y, r, start, end) => {
    const s = polarToCartesian(x, y, r, end);
    const e = polarToCartesian(x, y, r, start);
    const large = end - start <= 180 ? '0' : '1';
    return ['M', x, y, 'L', s.x, s.y, 'A', r, r, 0, large, 0, e.x, e.y, 'L', x, y].join(' ');
  };

  // Bar chart calculations
  const maxMonthly = Math.max(...monthlyData.map(d => d.total), 1);
  const BAR_W = Math.floor((CHART_W - (5 * 8)) / 6); // 6 bars with gap of 8

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Analytics</Text>
      <Text style={styles.subtitle}>Last 6 Months</Text>

      {/* ─── 6-Month Bar Chart ─────────────────── */}
      <View style={styles.barChartCard}>
        <View style={styles.barChart}>
          {/* Y-axis labels */}
          <View style={styles.yAxis}>
            {[maxMonthly, maxMonthly * 0.75, maxMonthly * 0.5, maxMonthly * 0.25, 0].map((v, i) => (
              <Text key={i} style={styles.yLabel}>
                {v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)}
              </Text>
            ))}
          </View>

          {/* Bars */}
          <View style={{ flex: 1, overflow: 'hidden' }}>
            <Svg width={CHART_W} height={CHART_H}>
              {monthlyData.map((d, i) => {
                const barH = maxMonthly > 0 ? (d.total / maxMonthly) * CHART_H : 0;
                const x = i * (BAR_W + 8);
                const y = CHART_H - barH;
                const isCurrentMonth = i === monthlyData.length - 1;
                return (
                  <G key={d.key}>
                    <Rect
                      x={x}
                      y={y}
                      width={BAR_W}
                      height={barH}
                      rx={4}
                      fill={isCurrentMonth ? COLORS.red : COLORS.elevated}
                    />
                  </G>
                );
              })}
            </Svg>
            {/* X-axis month labels */}
            <View style={styles.xAxis}>
              {monthlyData.map((d, i) => (
                <Text key={d.key} style={[styles.xLabel, i === monthlyData.length - 1 && { color: COLORS.red }]}>
                  {d.label}
                </Text>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* ─── Donut Chart ───────────────────────── */}
      {chartData.length > 0 && (
        <View style={styles.pieCard}>
          <View style={styles.pieContainer}>
            <Svg width={PIE_SIZE} height={PIE_SIZE}>
              <G>
                {(() => { cumulativeAngle = 0; return null; })()}
                {chartData.map(slice => {
                  const pct = slice.amount / monthTotal;
                  const angle = pct * 360;
                  const start = cumulativeAngle;
                  cumulativeAngle += angle;
                  return (
                    <Path
                      key={slice.id}
                      d={describeArc(RADIUS, RADIUS, RADIUS, start, start + angle)}
                      fill={slice.color}
                    />
                  );
                })}
                <Path d={describeArc(RADIUS, RADIUS, RADIUS * 0.6, 0, 359.9)} fill={COLORS.card} />
              </G>
            </Svg>
            <View style={styles.centerText}>
              <Text style={styles.centerLabel}>Spent</Text>
              <Text style={styles.centerValue}>{formatCurrency(monthTotal)}</Text>
            </View>
          </View>

          {/* Category legend */}
          <View style={styles.legendContainer}>
            {chartData.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={styles.legendItem}
                onPress={() => navigation.navigate('Category', { categoryId: cat.id, categoryName: cat.name, categoryEmoji: cat.emoji, categoryColor: cat.color })}
                activeOpacity={0.75}
              >
                <View style={[styles.legendDot, { backgroundColor: cat.color }]} />
                <Text style={styles.legendName}>{cat.name}</Text>
                <View style={{ flex: 1 }}>
                  <View style={styles.progressBg}>
                    <View style={[styles.progressFill, { width: `${(cat.amount / monthTotal) * 100}%`, backgroundColor: cat.color }]} />
                  </View>
                </View>
                <Text style={styles.legendAmount}>{formatCurrency(cat.amount)}</Text>
                <Text style={styles.legendPct}>{Math.round((cat.amount / monthTotal) * 100)}%</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {chartData.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📊</Text>
          <Text style={styles.emptyTitle}>No data yet</Text>
          <Text style={styles.emptySub}>Add some expenses to see analytics.</Text>
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingTop: 56, paddingHorizontal: 20 },
  title: { color: COLORS.textPrimary, fontSize: FONT_SIZE.xxxl, fontWeight: '800' },
  subtitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md, marginTop: 4, marginBottom: 20 },

  // Bar chart
  barChartCard: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.xl, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border },
  barChart: { flexDirection: 'row', alignItems: 'flex-start' },
  yAxis: { width: 36, height: CHART_H, justifyContent: 'space-between', paddingRight: 4, marginTop: 0 },
  yLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: '600', textAlign: 'right' },
  xAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  xLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '600', flex: 1, textAlign: 'center' },

  // Pie / donut
  pieCard: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.xl, padding: 20, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  pieContainer: { width: PIE_SIZE, height: PIE_SIZE, alignItems: 'center', justifyContent: 'center', marginBottom: 20, alignSelf: 'center' },
  centerText: { position: 'absolute', alignItems: 'center' },
  centerLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  centerValue: { color: COLORS.textPrimary, fontSize: FONT_SIZE.lg, fontWeight: '800', marginTop: 2 },

  legendContainer: { width: '100%', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendName: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, width: 70 },
  progressBg: { height: 6, backgroundColor: COLORS.elevated, borderRadius: 3, overflow: 'hidden', flex: 1 },
  progressFill: { height: '100%', borderRadius: 3 },
  legendAmount: { color: COLORS.textPrimary, fontSize: FONT_SIZE.sm, fontWeight: '700', width: 60, textAlign: 'right' },
  legendPct: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, width: 30, textAlign: 'right' },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.xl, fontWeight: '800' },
  emptySub: { color: COLORS.textMuted, fontSize: FONT_SIZE.md, marginTop: 8, textAlign: 'center' },
});
