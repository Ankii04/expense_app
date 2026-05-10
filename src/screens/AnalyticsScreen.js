import React, { useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path, G, Text as SvgText } from 'react-native-svg';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, CATEGORIES, formatCurrency } from '../utils/theme';
import { useExpenses } from '../hooks/useExpenses';

const SCREEN_W = Dimensions.get('window').width;
const PIE_SIZE = 220;
const RADIUS = PIE_SIZE / 2;

export default function AnalyticsScreen() {
  const { expenses, monthTotal, categorySpend, refresh } = useExpenses();

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const chartData = CATEGORIES.map((cat) => ({
    ...cat,
    amount: categorySpend[cat.id] || 0,
  })).filter((c) => c.amount > 0);

  // Pie Chart Logic
  let cumulativeAngle = 0;
  const pieSlices = chartData.map((slice) => {
    const percentage = slice.amount / monthTotal;
    const angle = percentage * 360;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;
    return { ...slice, startAngle, angle };
  });

  const describeArc = (x, y, radius, startAngle, endAngle) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return [
      'M', x, y,
      'L', start.x, start.y,
      'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
      'L', x, y,
    ].join(' ');
  };

  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Analytics</Text>
      <Text style={styles.subtitle}>Insights into your spending habits</Text>

      <View style={styles.pieCard}>
        <View style={styles.pieContainer}>
          <Svg width={PIE_SIZE} height={PIE_SIZE}>
            <G transform={`translate(0, 0)`}>
              {pieSlices.map((slice, i) => (
                <Path
                  key={i}
                  d={describeArc(RADIUS, RADIUS, RADIUS, slice.startAngle, slice.startAngle + slice.angle)}
                  fill={slice.color}
                />
              ))}
              {/* Inner hole for donut feel */}
              <Path
                d={describeArc(RADIUS, RADIUS, RADIUS * 0.6, 0, 359.9)}
                fill={COLORS.card}
              />
            </G>
          </Svg>
          <View style={styles.centerText}>
             <Text style={styles.centerLabel}>Total</Text>
             <Text style={styles.centerValue}>{formatCurrency(monthTotal)}</Text>
          </View>
        </View>

        <View style={styles.legendContainer}>
          {chartData.map((cat) => (
            <View key={cat.id} style={styles.legendItem}>
               <View style={[styles.legendDot, { backgroundColor: cat.color }]} />
               <Text style={styles.legendName}>{cat.name}</Text>
               <Text style={styles.legendAmount}>{formatCurrency(cat.amount)}</Text>
               <Text style={styles.legendPct}>{Math.round((cat.amount / monthTotal) * 100)}%</Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Spending Breakdown</Text>
      {chartData.sort((a,b) => b.amount - a.amount).map((cat) => (
        <View key={cat.id} style={styles.breakdownItem}>
           <View style={[styles.catIcon, { backgroundColor: cat.color + '20' }]}>
              <Text style={{fontSize: 20}}>{cat.emoji}</Text>
           </View>
           <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={styles.row}>
                <Text style={styles.catName}>{cat.name}</Text>
                <Text style={styles.catAmount}>{formatCurrency(cat.amount)}</Text>
              </View>
              <View style={styles.progressBg}>
                 <View style={[styles.progressFill, { width: `${(cat.amount / monthTotal) * 100}%`, backgroundColor: cat.color }]} />
              </View>
           </View>
        </View>
      ))}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingTop: 60, paddingHorizontal: SPACING.xl },
  title: { color: COLORS.textPrimary, fontSize: FONT_SIZE.xxxl, fontWeight: '800' },
  subtitle: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md, marginTop: 4, marginBottom: 24 },
  pieCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pieContainer: {
    width: PIE_SIZE,
    height: PIE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  centerText: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, fontWeight: '700', textTransform: 'uppercase' },
  centerValue: { color: COLORS.textPrimary, fontSize: FONT_SIZE.lg, fontWeight: '800', marginTop: 2 },
  legendContainer: { width: '100%', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  legendName: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, flex: 1 },
  legendAmount: { color: COLORS.textPrimary, fontSize: FONT_SIZE.sm, fontWeight: '600', marginRight: 12 },
  legendPct: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, width: 30, textAlign: 'right' },
  sectionTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.lg, fontWeight: '700', marginBottom: 16 },
  breakdownItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  catIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  catName: { color: COLORS.textPrimary, fontSize: FONT_SIZE.md, fontWeight: '600' },
  catAmount: { color: COLORS.textPrimary, fontSize: FONT_SIZE.md, fontWeight: '700' },
  progressBg: { height: 6, backgroundColor: COLORS.elevated, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
});
