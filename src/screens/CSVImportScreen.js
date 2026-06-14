import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import { parseCSV } from '../utils/csvParser';
import { getGroups, updateGroup, addExpense, getExpenses } from '../store/expenseStore';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, formatCurrency } from '../utils/theme';

const DEMO_SCENARIO_1 = `date,amount,note,payer,currency,split_type
14/06/2026,₹1500,Dinner at Bistro,You,INR,equal
15-06-2026,$20,Uber Ride,Aisha,USD,equal
15-06-2026,$20,Uber Ride,Aisha,USD,equal
16-06-2026,₹400,Groceries,Sam,INR,equal`;

const DEMO_SCENARIO_2 = `date,amount,note,payer,currency,split_type
01/03/2026,₹2000,March Electricity,You,INR,equal
20/06/2026,₹500,Late Coffee,You,INR,equal
18/06/2026,₹0,Zero Expense,You,INR,equal
,₹800,Missing fields,Aisha,INR,equal
14/06/2026,₹1200,Settlement Record,Aisha,INR,equal`;

export default function CSVImportScreen({ navigation }) {
  const [csvText, setCsvText] = useState('');
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('none');
  const [parsedRows, setParsedRows] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState(new Set());
  const [existingExpenses, setExistingExpenses] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      const g = await getGroups();
      const e = await getExpenses();
      setGroups(g);
      setExistingExpenses(e);
    };
    loadData();
  }, []);

  const handleParse = () => {
    if (!csvText.trim()) {
      Alert.alert('Empty Input', 'Please paste CSV data or select a demo scenario.');
      return;
    }

    const group = groups.find(g => g.id === selectedGroupId) || null;
    const { rows, anomalies: parsedAnomalies } = parseCSV(csvText, group, existingExpenses);

    setParsedRows(rows);
    setAnomalies(parsedAnomalies);

    // Default select all non-duplicate approved rows
    const initialSelected = new Set();
    rows.forEach(r => {
      if (!r.isDuplicate) {
        initialSelected.add(r.id);
      }
    });
    setSelectedRowIds(initialSelected);

    if (rows.length === 0 && parsedAnomalies.length > 0) {
      Alert.alert('Parsing Failed', 'No valid rows found. Check the audit report below.');
    } else {
      setShowConfirmModal(true);
    }
  };

  const toggleRowSelection = (id) => {
    const updated = new Set(selectedRowIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedRowIds(updated);
  };

  const handleImport = async () => {
    const rowsToImport = parsedRows.filter(r => selectedRowIds.has(r.id));
    if (rowsToImport.length === 0) {
      Alert.alert('No Rows Selected', 'Please approve at least one row to import.');
      return;
    }

    const group = groups.find(g => g.id === selectedGroupId);

    try {
      if (group) {
        // Import as group expenses
        const newGroupExpenses = [...group.expenses];
        rowsToImport.forEach(r => {
          newGroupExpenses.push({
            id: r.id,
            title: r.title,
            amount: r.amount,
            payerPhone: r.payerPhone === 'self' ? 'self' : r.payerPhone,
            date: r.date,
            is_settlement: r.is_settlement,
            splitMembers: group.members.map(m => m.phone) // split equally
          });
        });

        // Recalculate group balances dynamically
        const recalculateBalancesLocal = (members, expenses) => {
          const newMembers = members.map(m => ({ ...m, balance: 0, totalSpent: 0 }));
          expenses.forEach(exp => {
            const amount = Number(exp.amount);
            const expDate = new Date(exp.date);

            const isMemberActive = (m) => {
              if (!m.joined_at) return true;
              const join = new Date(m.joined_at);
              const leave = m.left_at ? new Date(m.left_at) : null;
              return expDate >= join && (!leave || expDate <= leave);
            };

            if (exp.is_settlement) {
              newMembers.forEach(m => {
                if (m.phone === exp.payerPhone) m.balance += amount;
                if (exp.payerPhone !== 'self' && m.phone === 'self') m.balance -= amount;
                const recipientPhone = exp.splitMembers && exp.splitMembers.length > 0 ? exp.splitMembers[0] : null;
                if (exp.payerPhone === 'self' && recipientPhone && m.phone === recipientPhone) m.balance -= amount;
              });
              return;
            }

            const activeMembers = newMembers.filter(isMemberActive);
            if (activeMembers.length === 0) return;

            const divisor = activeMembers.length;
            const perPerson = divisor > 0 ? (amount / divisor) : 0;

            newMembers.forEach(m => {
              const isActive = isMemberActive(m);
              if (isActive) {
                if (m.phone === exp.payerPhone) {
                  m.balance += (amount - perPerson);
                  m.totalSpent += amount;
                } else {
                  m.balance -= perPerson;
                }
              }
            });
          });
          return newMembers;
        };

        const updatedMembers = recalculateBalancesLocal(group.members, newGroupExpenses);
        await updateGroup(group.id, { expenses: newGroupExpenses, members: updatedMembers });
      } else {
        // Import as personal expenses
        for (const r of rowsToImport) {
          await addExpense({
            amount: r.amount,
            category: 'other',
            note: r.title,
            payeeName: r.payerName,
            date: r.date,
          });
        }
      }

      Alert.alert('Import Success', `${rowsToImport.length} expenses imported successfully!`);
      setShowConfirmModal(false);
      setCsvText('');
      setParsedRows([]);
      setAnomalies([]);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Import Error', 'Could not save imported expenses.');
    }
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>CSV Import Auditor</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.label}>1. Select Target Destination</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.groupScroll}>
          <TouchableOpacity
            style={[s.groupChip, selectedGroupId === 'none' && s.groupChipActive]}
            onPress={() => setSelectedGroupId('none')}
          >
            <Text style={[s.groupChipText, selectedGroupId === 'none' && { color: '#fff' }]}>Personal Log</Text>
          </TouchableOpacity>
          {groups.map(g => (
            <TouchableOpacity
              key={g.id}
              style={[s.groupChip, selectedGroupId === g.id && s.groupChipActive]}
              onPress={() => setSelectedGroupId(g.id)}
            >
              <Text style={[s.groupChipText, selectedGroupId === g.id && { color: '#fff' }]}>{g.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={s.label}>2. Preloaded Scenarios (Click to Load)</Text>
        <View style={s.scenarioRow}>
          <TouchableOpacity
            style={s.scenarioBtn}
            onPress={() => setCsvText(DEMO_SCENARIO_1)}
          >
            <Text style={s.scenarioBtnText}>Scenario 1: Conversions & Duplicates</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.scenarioBtn}
            onPress={() => setCsvText(DEMO_SCENARIO_2)}
          >
            <Text style={s.scenarioBtnText}>Scenario 2: Dynamic Dates & Settlement</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.label}>3. Paste CSV Data</Text>
        <TextInput
          style={s.csvInput}
          multiline
          placeholder="date,amount,note,payer,currency,split_type&#10;14/06/2026,1500,Dinner,You,INR,equal"
          placeholderTextColor={COLORS.textMuted}
          value={csvText}
          onChangeText={setCsvText}
        />

        <TouchableOpacity style={s.parseBtn} onPress={handleParse}>
          <Text style={s.parseBtnText}>Audit & Parse CSV</Text>
        </TouchableOpacity>

        {anomalies.length > 0 && (
          <View style={s.auditCard}>
            <Text style={s.auditTitle}>🕵️ Audited Anomalies Report ({anomalies.length})</Text>
            {anomalies.map((anom, idx) => (
              <View key={idx} style={s.anomalyRow}>
                <View style={[s.badge, anom.type === 'ERROR' ? s.errBadge : s.warnBadge]}>
                  <Text style={s.badgeText}>{anom.type}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.anomalyDesc}>Row {anom.row}: {anom.description}</Text>
                  <Text style={s.anomalyData}>{anom.data}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Confirmation & duplicate approval modal */}
      <Modal visible={showConfirmModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Approve Rows to Import</Text>
            <Text style={s.modalSub}>Deselect duplicate rows or warnings before importing.</Text>

            <ScrollView style={s.importScroll}>
              {parsedRows.map(r => (
                <TouchableOpacity
                  key={r.id}
                  style={[s.rowCard, selectedRowIds.has(r.id) && s.rowCardActive]}
                  onPress={() => toggleRowSelection(r.id)}
                >
                  <View style={s.rowHeader}>
                    <Text style={s.rowTitle}>{r.title}</Text>
                    <Text style={s.rowAmt}>{formatCurrency(r.amount)}</Text>
                  </View>
                  <View style={s.rowMeta}>
                    <Text style={s.rowMetaText}>Payer: {r.payerName} · {r.date.split('T')[0]}</Text>
                    {r.isConverted && (
                      <Text style={s.convText}>💱 {r.conversionWarning}</Text>
                    )}
                    {r.isDuplicate && (
                      <Text style={s.dupText}>⚠️ Duplicate detected (Unapproved by default)</Text>
                    )}
                    {r.warnings.map((w, idx) => (
                      <Text key={idx} style={s.warnText}>• {w}</Text>
                    ))}
                  </View>
                  <View style={s.checkRow}>
                    <View style={[s.checkbox, selectedRowIds.has(r.id) && s.checkboxActive]}>
                      {selectedRowIds.has(r.id) && <Text style={s.checkTick}>✓</Text>}
                    </View>
                    <Text style={s.checkLabel}>
                      {selectedRowIds.has(r.id) ? 'Approved' : 'Skipped'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowConfirmModal(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmBtn} onPress={handleImport}>
                <Text style={s.confirmBtnText}>Import Approved ({selectedRowIds.size})</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40 },
  backBtnText: { color: COLORS.accent, fontSize: 24, fontWeight: '700' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  content: { padding: SPACING.xl },
  label: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginVertical: 12,
  },
  groupScroll: { flexDirection: 'row', marginBottom: 8 },
  groupChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.elevated,
    marginRight: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  groupChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  groupChipText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 13 },
  scenarioRow: { flexDirection: 'column', gap: 8, marginBottom: 12 },
  scenarioBtn: {
    backgroundColor: COLORS.elevated,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scenarioBtnText: { color: COLORS.accent, fontSize: 13, fontWeight: '700' },
  csvInput: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    padding: 16,
    color: COLORS.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 13,
    height: 180,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  parseBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  parseBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  auditCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 40,
  },
  auditTitle: { color: COLORS.orange, fontSize: 15, fontWeight: '800', marginBottom: 12 },
  anomalyRow: {
    flexDirection: 'row',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 10,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errBadge: { backgroundColor: COLORS.red + '20' },
  warnBadge: { backgroundColor: COLORS.amber + '20' },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  anomalyDesc: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
  anomalyData: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  overlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    padding: 24,
    maxHeight: '85%',
  },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  modalSub: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 16 },
  importScroll: { maxHeight: 380, marginBottom: 20 },
  rowCard: {
    backgroundColor: COLORS.elevated,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  rowCardActive: { borderColor: COLORS.accent },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  rowTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  rowAmt: { color: COLORS.accent, fontSize: 15, fontWeight: '800' },
  rowMeta: { gap: 2, marginBottom: 8 },
  rowMetaText: { color: COLORS.textSecondary, fontSize: 12 },
  convText: { color: COLORS.green, fontSize: 11, fontWeight: '600' },
  dupText: { color: COLORS.red, fontSize: 11, fontWeight: '600' },
  warnText: { color: COLORS.amber, fontSize: 11 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  checkTick: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  checkLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  modalBtns: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#27272A', alignItems: 'center' },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '700' },
  confirmBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.accent, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '800' },
});
