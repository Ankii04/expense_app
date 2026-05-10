import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Dimensions,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Rect, Text as SvgText, G, Path } from 'react-native-svg';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, CATEGORIES, formatCurrency, getCategoryById } from '../utils/theme';
import { useExpenses } from '../hooks/useExpenses';
import ExpenseCard from '../components/ExpenseCard';

const SCREEN_W = Dimensions.get('window').width;
const CHART_W = SCREEN_W - (SPACING.xl * 2) - (SPACING.lg * 2) - 4; // Screen padding + Card padding
const CHART_H = 180;
const BAR_GAP = 6;

export default function HomeScreen({ navigation }) {
  const { expenses, monthTotal, categorySpend, loading, refresh, addExpense } = useExpenses();
  const [quickText, setQuickText] = React.useState('');

  // Refresh data when screen is focused
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const handleQuickAdd = async () => {
    if (!quickText.trim()) return;

    // NLP Parsing Logic
    // Matches "Amount for Note" or "Amount on Category"
    const amountMatch = quickText.match(/(\d+)/);
    if (!amountMatch) {
      Alert.alert('Try again', 'Include an amount, e.g., "500 for pizza"');
      return;
    }

    const amount = Number(amountMatch[1]);
    let note = quickText.replace(amountMatch[1], '').replace(/for|on|at/g, '').trim();
    if (!note) note = 'Quick Entry';

    // Guess category from note
    let category = 'other';
    const noteLower = note.toLowerCase();
    if (noteLower.includes('food') || noteLower.includes('pizza') || noteLower.includes('lunch') || noteLower.includes('dinner')) category = 'food';
    else if (noteLower.includes('uber') || noteLower.includes('petrol') || noteLower.includes('fuel') || noteLower.includes('cab')) category = 'transport';
    else if (noteLower.includes('shopping') || noteLower.includes('clothes')) category = 'shopping';
    else if (noteLower.includes('bill') || noteLower.includes('recharge')) category = 'bills';

    await addExpense({
      amount,
      note,
      category,
      payeeName: note,
      date: new Date().toISOString()
    });

    setQuickText('');
    Alert.alert('Success', `Added ${formatCurrency(amount)} to ${category}`);
  };

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

      {/* ─── NLP Quick Add ───────────────────────── */}
      <View style={styles.quickAddContainer}>
        <TextInput
          style={styles.quickInput}
          placeholder='Quick Add: "500 for coffee"'
          placeholderTextColor={COLORS.textMuted}
          value={quickText}
          onChangeText={setQuickText}
        />
        <TouchableOpacity 
          style={[styles.quickBtn, !quickText.trim() && { opacity: 0.5 }]} 
          onPress={handleQuickAdd}
          disabled={!quickText.trim()}
        >
          <Text style={styles.quickBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Category Breakdown Chart ─────────────── */}
      {chartData.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spend by Category</Text>
          <View style={styles.chartCard}>
            <View style={styles.chartRow}>
              <View style={styles.pieContainer}>
                <Svg width={140} height={140}>
                  <G transform="translate(0, 0)">
                    {(() => {
                      let cumulativeAngle = 0;
                      const RADIUS = 70;
                      const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
                        const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
                        return {
                          x: centerX + radius * Math.cos(angleInRadians),
                          y: centerY + radius * Math.sin(angleInRadians),
                        };
                      };
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

                      return chartData.map((cat, i) => {
                        const percentage = cat.amount / monthTotal;
                        const angle = percentage * 360;
                        const startAngle = cumulativeAngle;
                        cumulativeAngle += angle;
                        return (
                          <Path
                            key={i}
                            d={describeArc(RADIUS, RADIUS, RADIUS, startAngle, startAngle + angle)}
                            fill={cat.color}
                          />
                        );
                      });
                    })()}
                    {/* Inner hole for donut */}
                    <Path
                      d={(() => {
                        const RADIUS = 70;
                        const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
                          const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
                          return {
                            x: centerX + radius * Math.cos(angleInRadians),
                            y: centerY + radius * Math.sin(angleInRadians),
                          };
                        };
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
                        return describeArc(RADIUS, RADIUS, RADIUS * 0.65, 0, 359.9);
                      })()}
                      fill={COLORS.card}
                    />
                  </G>
                </Svg>
                <View style={styles.chartCenter}>
                   <Text style={styles.chartCenterEmoji}>📊</Text>
                </View>
              </View>

              <View style={styles.legendCol}>
                {chartData.slice(0, 4).map((cat) => (
                  <View key={cat.id} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: cat.color }]} />
                    <View>
                      <Text style={styles.legendName}>{cat.name}</Text>
                      <Text style={styles.legendAmount}>{formatCurrency(cat.amount)}</Text>
                    </View>
                  </View>
                ))}
                {chartData.length > 4 && (
                   <Text style={styles.moreText}>+ {chartData.length - 4} more</Text>
                )}
              </View>
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

  chartCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pieContainer: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartCenter: {
    position: 'absolute',
  },
  chartCenterEmoji: {
    fontSize: 24,
  },
  legendCol: {
    flex: 1,
    marginLeft: 20,
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  legendName: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  legendAmount: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    marginTop: 2,
  },
  moreText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    marginTop: 4,
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
  quickAddContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: 8,
    marginBottom: SPACING.xxl,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  quickInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZE.md,
    paddingHorizontal: 12,
    height: 44,
  },
  quickBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.md,
  },
  quickBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FONT_SIZE.sm,
  },
});
