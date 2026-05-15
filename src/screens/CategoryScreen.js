import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  SectionList, SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, formatCurrency, formatDate } from '../utils/theme';
import { useExpenses } from '../hooks/useExpenses';

export default function CategoryScreen({ route, navigation }) {
  const { categoryId, categoryName, categoryEmoji, categoryColor } = route.params || {};
  const { expenses, monthTotal, refresh } = useExpenses();

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  // Filter expenses for this category (current month only for stats, all-time for list)
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const allCatExpenses = expenses.filter(e => e.category === categoryId);
  const monthCatExpenses = allCatExpenses.filter(e => e.date?.startsWith(currentMonthKey.replace('-', '-').substring(0, 7)));

  // Intentionally use all matching expenses for the list (show history)
  const catExpenses = allCatExpenses;

  const totalSpent = catExpenses.reduce((s, e) => s + e.amount, 0);
  const txnCount = catExpenses.length;
  const avgPerTxn = txnCount > 0 ? Math.round(totalSpent / txnCount) : 0;
  const monthName = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  // Group by date for SectionList
  const grouped = catExpenses.reduce((acc, exp) => {
    const d = new Date(exp.date);
    const key = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    if (!acc[key]) acc[key] = [];
    acc[key].push(exp);
    return acc;
  }, {});

  const sections = Object.keys(grouped).map(date => ({
    title: date,
    data: grouped[date],
  }));

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.categoryTitle}>{categoryName}</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      {/* Category icon banner */}
      <View style={[styles.banner, { backgroundColor: categoryColor + '18' }]}>
        <View style={[styles.bannerIcon, { backgroundColor: categoryColor + '30' }]}>
          <Text style={styles.bannerEmoji}>{categoryEmoji}</Text>
        </View>
        <Text style={[styles.bannerName, { color: categoryColor }]}>{categoryName}</Text>
        <Text style={styles.bannerMonth}>{monthName}</Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatCurrency(totalSpent)}</Text>
          <Text style={styles.statLabel}>Total Spent</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{txnCount}</Text>
          <Text style={styles.statLabel}>Transactions</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatCurrency(avgPerTxn)}</Text>
          <Text style={styles.statLabel}>Avg / txn</Text>
        </View>
      </View>

      {/* Transaction list grouped by date */}
      {sections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>{categoryEmoji}</Text>
          <Text style={styles.emptyTitle}>No {categoryName} expenses</Text>
          <Text style={styles.emptySub}>Transactions in this category will appear here.</Text>
        </View>
      ) : (
        <SectionList
          keyboardShouldPersistTaps="always"
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionDate}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={styles.txnCard}>
              <View style={[styles.txnIconWrap, { backgroundColor: categoryColor + '20' }]}>
                <Text style={styles.txnEmoji}>{categoryEmoji}</Text>
              </View>
              <View style={styles.txnMid}>
                <Text style={styles.txnNote} numberOfLines={1}>
                  {item.note || item.payeeName || categoryName}
                </Text>
                <View style={styles.txnSubRow}>
                  <Text style={styles.txnTime}>
                    {new Date(item.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {item.upiApp ? (
                    <View style={styles.upiTag}>
                      <Text style={styles.upiTagText}>{item.upiApp}</Text>
                    </View>
                  ) : item.upiId ? (
                    <Text style={styles.upiId} numberOfLines={1}>{item.upiId}</Text>
                  ) : null}
                </View>
              </View>
              <Text style={[styles.txnAmount, { color: categoryColor }]}>
                -{formatCurrency(item.amount)}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  doneBtn: { width: 60 },
  doneBtnText: { color: COLORS.accent, fontSize: FONT_SIZE.md, fontWeight: '700' },
  headerCenter: { flex: 1, alignItems: 'center' },
  categoryTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },

  banner: { alignItems: 'center', paddingVertical: 24, marginHorizontal: 20, borderRadius: 20, marginTop: 16, marginBottom: 4 },
  bannerIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  bannerEmoji: { fontSize: 30 },
  bannerName: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  bannerMonth: { color: COLORS.textMuted, fontSize: 13 },

  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#18181B', marginHorizontal: 20, borderRadius: 16,
    marginVertical: 12, borderWidth: 1, borderColor: '#27272A', paddingVertical: 16,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { color: '#fff', fontSize: FONT_SIZE.lg, fontWeight: '800', marginBottom: 4 },
  statLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },
  statDivider: { width: 1, height: 32, backgroundColor: '#27272A' },

  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  sectionHeader: { paddingVertical: 10 },
  sectionDate: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  txnCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181B',
    borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#27272A',
  },
  txnIconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  txnEmoji: { fontSize: 20 },
  txnMid: { flex: 1, marginRight: 8 },
  txnNote: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  txnSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  txnTime: { color: COLORS.textMuted, fontSize: 11 },
  upiTag: { backgroundColor: '#27272A', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  upiTagText: { color: COLORS.textMuted, fontSize: 9, fontWeight: '700' },
  upiId: { color: COLORS.textMuted, fontSize: 10, maxWidth: 100 },
  txnAmount: { fontSize: 15, fontWeight: '800' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptySub: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center' },
});
