import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  Dimensions, TextInput, TouchableOpacity, Alert, Modal, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path, G } from 'react-native-svg';
import {
  COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, CATEGORIES,
  formatCurrency, getCategoryById,
} from '../utils/theme';
import { useExpenses, useBudgets, useLends, useProfile } from '../hooks/useExpenses';
import { useAuth } from '../store/AuthContext';
import ExpenseCard from '../components/ExpenseCard';
import { scheduleMonthlySummaryNotification } from '../utils/notifications';

// ─── Pie Chart Helpers (Stable definitions) ──────────────────────────
const RADIUS = 70;
const polarToCartesian = (cx, cy, r, deg) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};
const describeArc = (x, y, r, start, end) => {
  const s = polarToCartesian(x, y, r, end);
  const e = polarToCartesian(x, y, r, start);
  const large = (end - start) <= 180 ? '0' : '1';
  return ['M', x, y, 'L', s.x, s.y, 'A', r, r, 0, large, 0, e.x, e.y, 'L', x, y].join(' ');
};

const SCREEN_W = Dimensions.get('window').width;

export default function HomeScreen({ navigation }) {
  const { logout } = useAuth();
  const { expenses = [], monthTotal = 0, categorySpend = {}, loading, refresh, addExpense } = useExpenses();
  const { budgets = {} } = useBudgets();
  const { contactSummaries = [] } = useLends();
  const { profile = { name: 'User' }, saveProfile } = useProfile();
  const [quickText, setQuickText] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [nameInput, setNameInput]   = useState('');

  const totalBudget = budgets['total'] || Object.entries(budgets).reduce((sum, [k, v]) => k === 'total' ? sum : sum + Number(v), 0);
  const budgetProgress = totalBudget > 0 ? Math.min(monthTotal / totalBudget, 1) : 0;
  const isOverBudget = monthTotal > totalBudget && totalBudget > 0;
  const budgetUsedPct = totalBudget > 0 ? Math.round(budgetProgress * 100) : 0;

  // Lent out / borrowed summary
  const totalLentOut = contactSummaries.reduce((s, c) => s + c.lent, 0);
  const totalBorrowed = contactSummaries.reduce((s, c) => s + c.borrowed, 0);

  // Stats — today & this week
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());

  const todayTotal = expenses
    .filter(e => e.date?.startsWith(todayKey))
    .reduce((s, e) => s + e.amount, 0);
  const weekTotal = expenses
    .filter(e => new Date(e.date) >= weekStart)
    .reduce((s, e) => s + e.amount, 0);
  const daysInMonth = now.getDate();
  const avgPerDay = daysInMonth > 0 ? Math.round(monthTotal / daysInMonth) : 0;

  // Categories with spend this month
  const chartData = CATEGORIES.map(cat => ({
    ...cat,
    amount: categorySpend[cat.id] || 0,
  })).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);

  // Pie chart
  let cumulativeAngle = 0;

  useFocusEffect(useCallback(() => {
    refresh();
    // Schedule monthly notification whenever screen is focused (idempotent)
    const topCat = chartData[0]?.name;
    scheduleMonthlySummaryNotification(monthTotal, topCat).catch(() => {});
  }, [refresh]));

  const handleQuickAdd = async () => {
    if (!quickText.trim()) return;
    const amountMatch = quickText.match(/(\d+)/);
    if (!amountMatch) { Alert.alert('Try again', 'Include an amount, e.g., "500 for pizza"'); return; }
    const amount = Number(amountMatch[1]);
    let remainingText = quickText.replace(amountMatch[0], '').replace(/for|on|at|bought|spent/gi, '').trim();
    let category = 'other';
    const t = quickText.toLowerCase();
    if (t.match(/food|pizza|lunch|dinner|burger|cafe|swiggy|zomato/)) category = 'food';
    else if (t.match(/uber|petrol|fuel|cab|ola|auto|travel/)) category = 'transport';
    else if (t.match(/shopping|clothes|amazon|flipkart|myntra/)) category = 'shopping';
    else if (t.match(/bill|recharge|electricity|water|wifi/)) category = 'bills';
    else if (t.match(/grocery|milk|market|bigbasket|blinkit/)) category = 'groceries';
    else if (t.match(/movie|netflix|prime|hotstar|game|fun/)) category = 'entertainment';
    else if (t.match(/rent|house|flat|pg/)) category = 'rent';
    const note = remainingText || `Quick ${category}`;
    await addExpense({ amount, note, category, payeeName: note, date: new Date().toISOString() });
    setQuickText('');
    Alert.alert('✓ Added', `${formatCurrency(amount)} in ${category}`);
  };

  const handleAvatarPress = () => {
    setNameInput(profile.name || '');
    setShowProfileModal(true);
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow gallery access to set a profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      await saveProfile({ ...profile, photo: result.assets[0].uri });
    }
  };


  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    await saveProfile({ ...profile, name: nameInput.trim() });
    setShowProfileModal(false);
  };

  const monthName = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const recentExpenses = expenses.slice(0, 5);

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="always"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={COLORS.accent} />}
      >
        {/* ─── Header with Profile ───────────── */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Hello</Text>
            <Text style={styles.greetingName}>{profile.name}</Text>
          </View>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={handleAvatarPress}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {profile.photo ? (
              <Image source={{ uri: profile.photo }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarLetter}>{(profile.name || 'U')[0].toUpperCase()}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ─── Spendings This Month Card ──────── */}
        <View style={styles.totalCard}>
          <View style={styles.totalGlow} />
          <Text style={styles.totalLabel}>SPENDINGS THIS MONTH</Text>
          <Text style={styles.totalAmount}>{formatCurrency(monthTotal)}</Text>

          {totalBudget > 0 && (
            <>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, {
                  width: `${Math.min(budgetProgress * 100, 100)}%`,
                  backgroundColor: isOverBudget ? COLORS.red : COLORS.green,
                }]} />
              </View>
              <Text style={[styles.budgetLabel, isOverBudget && { color: COLORS.red }]}>
                {isOverBudget ? '⚠️ Over Budget!' : `Budget ${formatCurrency(totalBudget)} · ${budgetUsedPct}% used`}
              </Text>
            </>
          )}
        </View>

        {/* ─── Stats Row ─────────────────────── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TODAY</Text>
            <Text style={styles.statValue}>{formatCurrency(todayTotal)}</Text>
            <View style={[styles.statDot, { backgroundColor: COLORS.red }]} />
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>THIS WEEK</Text>
            <Text style={styles.statValue}>{formatCurrency(weekTotal)}</Text>
            <View style={[styles.statDot, { backgroundColor: COLORS.amber }]} />
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>AVG / DAY</Text>
            <Text style={styles.statValue}>{formatCurrency(avgPerDay)}</Text>
            <View style={[styles.statDot, { backgroundColor: COLORS.accent }]} />
          </View>
        </View>

        {/* ─── Lent / Borrowed Row ────────────── */}
        <View style={styles.lendRow}>
          <TouchableOpacity style={styles.lendCard} onPress={() => navigation.navigate('LendMain')} activeOpacity={0.85}>
            <Text style={styles.lendLabel}>LENT OUT</Text>
            <Text style={[styles.lendValue, { color: COLORS.green }]}>{formatCurrency(totalLentOut)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.lendCard} onPress={() => navigation.navigate('LendMain')} activeOpacity={0.85}>
            <Text style={styles.lendLabel}>BORROWED</Text>
            <Text style={[styles.lendValue, { color: COLORS.red }]}>{formatCurrency(totalBorrowed)}</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Quick Add ──────────────────────── */}
        <View style={styles.quickAddContainer}>
          <TextInput
            style={styles.quickInput}
            placeholder='Quick Add: "500 for coffee"'
            placeholderTextColor={COLORS.textMuted}
            value={quickText}
            onChangeText={setQuickText}
            onSubmitEditing={handleQuickAdd}
          />
          <TouchableOpacity
            style={[styles.quickBtn, !quickText.trim() && { opacity: 0.4 }]}
            onPress={handleQuickAdd}
            disabled={!quickText.trim()}
          >
            <Text style={styles.quickBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* ─── This Month — Category Chips ────── */}
        {chartData.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>This Month</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScrollRow}>
              {chartData.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.catChip}
                  onPress={() => navigation.navigate('Category', { categoryId: cat.id, categoryName: cat.name, categoryEmoji: cat.emoji, categoryColor: cat.color })}
                  activeOpacity={0.8}
                >
                  <View style={[styles.catChipIcon, { backgroundColor: cat.color + '25' }]}>
                    <Text style={styles.catChipEmoji}>{cat.emoji}</Text>
                  </View>
                  <Text style={styles.catChipName}>{cat.name}</Text>
                  <Text style={[styles.catChipAmt, { color: cat.color }]}>{formatCurrency(cat.amount)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ─── Pie Chart ──────────────────────── */}
        {chartData.length > 0 && (
          <View style={styles.section}>
            <View style={styles.chartCard}>
              <View style={styles.chartRow}>
                <View style={styles.pieContainer}>
                  <Svg width={140} height={140}>
                    <G>
                      {(() => { cumulativeAngle = 0; return null; })()}
                      {chartData.map((cat) => {
                        const pct = cat.amount / monthTotal;
                        const angle = pct * 360;
                        const start = cumulativeAngle;
                        cumulativeAngle += angle;
                        return (
                          <Path key={cat.id} d={describeArc(RADIUS, RADIUS, RADIUS, start, start + angle)} fill={cat.color} />
                        );
                      })}
                      <Path d={describeArc(RADIUS, RADIUS, RADIUS * 0.65, 0, 359.9)} fill={COLORS.card} />
                    </G>
                  </Svg>
                  <View style={styles.chartCenter}>
                    <Text style={styles.chartCenterLabel}>Spent</Text>
                    <Text style={styles.chartCenterAmt}>{formatCurrency(monthTotal)}</Text>
                  </View>
                </View>
                <View style={styles.legendCol}>
                  {chartData.slice(0, 5).map(cat => (
                    <View key={cat.id} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: cat.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.legendName}>{cat.name}</Text>
                        <Text style={styles.legendAmt}>{formatCurrency(cat.amount)}</Text>
                      </View>
                      <Text style={styles.legendPct}>{Math.round((cat.amount / monthTotal) * 100)}%</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ─── Recent Expenses ────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent</Text>
            {expenses.length > 5 && (
              <Text style={styles.seeAll} onPress={() => navigation.navigate('ExpensesTab')}>See all →</Text>
            )}
          </View>
          {recentExpenses.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>💸</Text>
              <Text style={styles.emptyTitle}>No expenses yet</Text>
              <Text style={styles.emptySub}>Scan a QR code to make your first payment</Text>
            </View>
          ) : (
            recentExpenses.map(exp => (
              <ExpenseCard key={exp.id} expense={exp} onPress={() => {}} />
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ─── Profile Bottom Sheet ─────────────── */}
      <Modal visible={showProfileModal} transparent animationType="slide" onRequestClose={() => setShowProfileModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.profileSheet}>

            {/* Handle */}
            <View style={styles.sheetHandle} />

            <Text style={styles.sheetTitle}>Your Profile</Text>

            {/* Avatar preview */}
            <View style={styles.profileAvatarWrap}>
              {profile.photo ? (
                <Image source={{ uri: profile.photo }} style={styles.profileAvatarImg} />
              ) : (
                <View style={styles.profileAvatarPlaceholder}>
                  <Text style={styles.profileAvatarLetter}>
                    {(nameInput || profile.name || 'U')[0].toUpperCase()}
                  </Text>
                </View>
              )}
              {/* Photo button overlay */}
              <TouchableOpacity
                style={styles.photoOverlay}
                onPress={async () => { await handlePickImage(); }}
                activeOpacity={0.8}
              >
                <Text style={styles.photoOverlayText}>📷</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.photoHint}>Tap avatar to change photo</Text>

            {/* Name input */}
            <Text style={styles.fieldLabel}>Display Name</Text>
            <View style={styles.nameInputWrap}>
              <Text style={styles.nameInputIcon}>✏️</Text>
              <TextInput
                style={styles.nameInputField}
                placeholder="Enter your name"
                placeholderTextColor={COLORS.textMuted}
                value={nameInput}
                onChangeText={setNameInput}
                autoFocus
                maxLength={30}
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
              />
              <Text style={styles.charCount}>{nameInput.length}/30</Text>
            </View>

            {/* Actions */}
            <View style={styles.profileBtns}>
              <TouchableOpacity style={styles.profileCancel} onPress={() => setShowProfileModal(false)} activeOpacity={0.8}>
                <Text style={styles.profileCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.profileSave, !nameInput.trim() && { opacity: 0.4 }]}
                onPress={handleSaveName}
                disabled={!nameInput.trim()}
                activeOpacity={0.8}
              >
                <Text style={styles.profileSaveText}>Save Changes</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.profileCancel, { borderColor: COLORS.red, borderWidth: 1, marginTop: 12, width: '100%', alignItems: 'center' }]} 
              onPress={async () => {
                setShowProfileModal(false);
                await logout();
              }}
              activeOpacity={0.8}
            >
              <Text style={{ color: COLORS.red, fontWeight: '700', fontSize: 15 }}>Log Out</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingTop: 56, paddingHorizontal: SPACING.xl },

  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xl },
  greeting: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  greetingName: { color: COLORS.textPrimary, fontSize: FONT_SIZE.xxxl, fontWeight: '800', letterSpacing: -0.5 },
  avatarWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.accent + '30', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.accent + '60', overflow: 'hidden',
  },
  avatarImage: { width: 52, height: 52, borderRadius: 26 },
  avatarLetter: { color: COLORS.accent, fontSize: FONT_SIZE.xl, fontWeight: '800' },

  // Total card
  totalCard: {
    backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xxl,
    marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', position: 'relative',
  },
  totalGlow: { position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: COLORS.accentGlow },
  totalLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  totalAmount: { color: COLORS.textPrimary, fontSize: FONT_SIZE.hero, fontWeight: '800', marginTop: 4, marginBottom: 16, letterSpacing: -1 },
  progressBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 3 },
  budgetLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs, fontWeight: '600' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: SPACING.lg },
  statCard: {
    flex: 1, backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.lg,
    padding: 14, borderWidth: 1, borderColor: COLORS.border,
  },
  statLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  statValue: { color: COLORS.textPrimary, fontSize: FONT_SIZE.md, fontWeight: '800' },
  statDot: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },

  // Lend row
  lendRow: { flexDirection: 'row', gap: 10, marginBottom: SPACING.lg },
  lendCard: {
    flex: 1, backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.lg,
    padding: 14, borderWidth: 1, borderColor: COLORS.border, alignItems: 'flex-start',
  },
  lendLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  lendValue: { fontSize: FONT_SIZE.xl, fontWeight: '800' },

  // Quick add
  quickAddContainer: {
    flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.lg,
    padding: 8, marginBottom: SPACING.xxl, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center',
  },
  quickInput: { flex: 1, color: COLORS.textPrimary, fontSize: FONT_SIZE.md, paddingHorizontal: 12, height: 44 },
  quickBtn: { backgroundColor: COLORS.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: BORDER_RADIUS.md },
  quickBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.sm },

  // Sections
  section: { marginBottom: SPACING.xxl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  sectionTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.lg, fontWeight: '700', marginBottom: SPACING.md },
  seeAll: { color: COLORS.accent, fontSize: FONT_SIZE.sm, fontWeight: '600', marginBottom: SPACING.md },

  // Category chips (horizontal scroll)
  catScrollRow: { marginBottom: 4 },
  catChip: {
    alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 12, marginRight: 10,
    borderWidth: 1, borderColor: COLORS.border, minWidth: 80,
  },
  catChipIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  catChipEmoji: { fontSize: 20 },
  catChipName: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: 2 },
  catChipAmt: { fontSize: 12, fontWeight: '800' },

  // Chart
  chartCard: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  chartRow: { flexDirection: 'row', alignItems: 'center' },
  pieContainer: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  chartCenter: { position: 'absolute', alignItems: 'center' },
  chartCenterLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  chartCenterAmt: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '800', marginTop: 2 },
  legendCol: { flex: 1, marginLeft: 16, gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendName: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' },
  legendAmt: { color: COLORS.textPrimary, fontSize: 11, fontWeight: '700' },
  legendPct: { color: COLORS.textMuted, fontSize: 10, marginLeft: 'auto' },

  // Empty
  emptyCard: { backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xxxl, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  emptyEmoji: { fontSize: 40, marginBottom: SPACING.md },
  emptyTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZE.lg, fontWeight: '700' },
  emptySub: { color: COLORS.textMuted, fontSize: FONT_SIZE.sm, marginTop: SPACING.xs, textAlign: 'center' },

  // Name modal (legacy, kept for compatibility)
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },

  // ── Profile bottom sheet ──────────────────────────────────────
  profileSheet: {
    backgroundColor: '#13131A',
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 24, paddingBottom: 44, paddingTop: 12,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#3F3F46',
    alignSelf: 'center', marginBottom: 24,
  },
  sheetTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 24, textAlign: 'center' },

  // Avatar preview
  profileAvatarWrap: {
    width: 100, height: 100, borderRadius: 50, alignSelf: 'center',
    marginBottom: 8, position: 'relative',
  },
  profileAvatarImg: { width: 100, height: 100, borderRadius: 50 },
  profileAvatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: COLORS.accent + '30',
    borderWidth: 3, borderColor: COLORS.accent + '60',
    alignItems: 'center', justifyContent: 'center',
  },
  profileAvatarLetter: { color: COLORS.accent, fontSize: 40, fontWeight: '800' },
  photoOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.accent,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#13131A',
  },
  photoOverlayText: { fontSize: 14 },
  photoHint: { color: COLORS.textMuted, fontSize: 11, textAlign: 'center', marginBottom: 24 },

  // Name input
  fieldLabel: {
    color: COLORS.textMuted, fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
  },
  nameInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1C1C28', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 4,
    borderWidth: 1, borderColor: COLORS.accent + '40',
    marginBottom: 28, gap: 10,
  },
  nameInputIcon: { fontSize: 16 },
  nameInputField: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '600', paddingVertical: 14 },
  charCount: { color: COLORS.textMuted, fontSize: 11 },

  // Buttons
  profileBtns: { flexDirection: 'row', gap: 12 },
  profileCancel: {
    flex: 1, paddingVertical: 15, borderRadius: 16,
    backgroundColor: '#27272A', alignItems: 'center',
    borderWidth: 1, borderColor: '#3F3F46',
  },
  profileCancelText: { color: COLORS.textMuted, fontWeight: '700', fontSize: 15 },
  profileSave: {
    flex: 2, paddingVertical: 15, borderRadius: 16,
    backgroundColor: COLORS.accent, alignItems: 'center',
  },
  profileSaveText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
