import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, Modal, TextInput, FlatList,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, FONT_SIZE, BORDER_RADIUS, formatCurrency, formatDate } from '../utils/theme';
import { useLends } from '../hooks/useExpenses';
import ContactPicker from '../components/ContactPicker';

export default function LendScreen({ navigation }) {
  const { lends, contactSummaries, loading, refresh, addLend, updateLend, deleteLend } = useLends();
  const [selectedContact, setSelectedContact] = useState(null); // view detail
  const [showAddModal, setShowAddModal] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [addContact, setAddContact] = useState(null);
  const [addType, setAddType] = useState('lend'); // lend | borrow
  const [addAmount, setAddAmount] = useState('');
  const [addNote, setAddNote] = useState('');
  const [activeTab, setActiveTab] = useState('lends'); // lends | transfers

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const handleAddRecord = async () => {
    if (!addContact || !addAmount) {
      Alert.alert('Missing Info', 'Select a contact and enter an amount');
      return;
    }
    await addLend({
      contactName: addContact.name,
      contactPhone: addContact.phone,
      type: addType,
      amount: Number(addAmount),
      note: addNote,
    });
    setShowAddModal(false);
    setAddContact(null);
    setAddAmount('');
    setAddNote('');
  };

  const handleMarkPaid = async (id) => {
    await updateLend(id, { paid: true });
  };

  const handleDelete = async (id) => {
    Alert.alert('Delete Record', 'Remove this lend record?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteLend(id) },
    ]);
  };

  // Contact detail view
  if (selectedContact) {
    const contactLends = lends.filter(
      l => l.contactPhone === selectedContact.contactPhone || l.contactName === selectedContact.contactName
    );
    const net = selectedContact.lent - selectedContact.borrowed;
    const initial = (selectedContact.contactName || 'U')[0].toUpperCase();

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedContact(null)} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Done</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{selectedContact.contactName}</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView keyboardShouldPersistTaps="always" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Profile card */}
          <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{selectedContact.contactName}</Text>
              {selectedContact.contactPhone && selectedContact.contactPhone !== 'unknown' && (
                <Text style={styles.profilePhone}>{selectedContact.contactPhone}</Text>
              )}
              <Text style={styles.profileRecords}>{contactLends.length} records</Text>
            </View>
          </View>

          {/* LENT / BORROWED / NET */}
          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceLabel}>LENT</Text>
              <Text style={[styles.balanceValue, { color: COLORS.green }]}>
                {formatCurrency(selectedContact.lent)}
              </Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceItem}>
              <Text style={styles.balanceLabel}>BORROWED</Text>
              <Text style={[styles.balanceValue, { color: COLORS.red }]}>
                {formatCurrency(selectedContact.borrowed)}
              </Text>
            </View>
          </View>
          <View style={styles.netCard}>
            <Text style={styles.netLabel}>NET</Text>
            <Text style={[styles.netValue, { color: net >= 0 ? COLORS.green : COLORS.red }]}>
              {net >= 0 ? '+' : ''}{formatCurrency(net)}
            </Text>
            <Text style={styles.netStatus}>
              {Math.abs(net) < 1 ? '✓ All settled' : net > 0 ? 'They owe you' : 'You owe them'}
            </Text>
          </View>

          {/* Add Record */}
          <TouchableOpacity
            style={styles.addRecordBtn}
            onPress={() => { setAddContact({ name: selectedContact.contactName, phone: selectedContact.contactPhone }); setShowAddModal(true); }}
          >
            <Text style={styles.addRecordBtnText}>+ Add Record</Text>
          </TouchableOpacity>

          {/* Records list */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'lends' && styles.tabActive]}
              onPress={() => setActiveTab('lends')}
            >
              <Text style={[styles.tabText, activeTab === 'lends' && styles.tabTextActive]}>Lends</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'transfers' && styles.tabActive]}
              onPress={() => setActiveTab('transfers')}
            >
              <Text style={[styles.tabText, activeTab === 'transfers' && styles.tabTextActive]}>Transfers</Text>
            </TouchableOpacity>
          </View>

          {contactLends.filter(l => activeTab === 'lends' ? l.type === 'lend' : l.type === 'borrow').map(l => (
            <View key={l.id} style={styles.recordCard}>
              <View style={[styles.recordDot, { backgroundColor: l.type === 'lend' ? COLORS.green : COLORS.red }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.recordNote}>{l.note || (l.type === 'lend' ? 'Lent money' : 'Borrowed money')}</Text>
                <Text style={styles.recordDate}>{formatDate(l.date)}</Text>
              </View>
              <View style={styles.recordRight}>
                <Text style={[styles.recordAmount, { color: l.type === 'lend' ? COLORS.green : COLORS.red }]}>
                  {l.type === 'lend' ? '+' : '-'}{formatCurrency(l.amount)}
                </Text>
                {l.paid ? (
                  <View style={styles.paidBadge}><Text style={styles.paidText}>PAID</Text></View>
                ) : (
                  <TouchableOpacity style={styles.removeBtn} onPress={() => handleMarkPaid(l.id)}>
                    <Text style={styles.removeText}>Mark Paid</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  // Main lend contacts list
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lend & Borrow</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView keyboardShouldPersistTaps="always" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderColor: COLORS.green + '30' }]}>
            <Text style={styles.summaryLabel}>Total Lent</Text>
            <Text style={[styles.summaryValue, { color: COLORS.green }]}>
              {formatCurrency(contactSummaries.reduce((s, c) => s + c.lent, 0))}
            </Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: COLORS.red + '30' }]}>
            <Text style={styles.summaryLabel}>Total Borrowed</Text>
            <Text style={[styles.summaryValue, { color: COLORS.red }]}>
              {formatCurrency(contactSummaries.reduce((s, c) => s + c.borrowed, 0))}
            </Text>
          </View>
        </View>

        {contactSummaries.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 52, marginBottom: 12 }}>🤝</Text>
            <Text style={styles.emptyTitle}>No records yet</Text>
            <Text style={styles.emptySub}>Track money you lend or borrow from friends.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowAddModal(true)}>
              <Text style={styles.emptyBtnText}>+ Add First Record</Text>
            </TouchableOpacity>
          </View>
        ) : (
          contactSummaries.map((c, i) => {
            const net = c.lent - c.borrowed;
            return (
              <TouchableOpacity key={i} style={styles.contactCard} onPress={() => setSelectedContact(c)} activeOpacity={0.85}>
                <View style={styles.contactAvatar}>
                  <Text style={styles.contactAvatarText}>{(c.contactName || 'U')[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.contactName}>{c.contactName}</Text>
                  <Text style={styles.contactRecords}>{c.records.length} records</Text>
                </View>
                <View style={styles.contactNet}>
                  <Text style={[styles.contactNetLabel, { color: net >= 0 ? COLORS.green : COLORS.red }]}>
                    {net >= 0 ? 'Gets' : 'Owes'} {formatCurrency(Math.abs(net))}
                  </Text>
                  {Math.abs(net) < 1 && <Text style={styles.settledText}>✓ Settled</Text>}
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Record Modal */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add Lend Record</Text>

            {/* Type toggle */}
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeBtn, addType === 'lend' && styles.typeBtnActive]}
                onPress={() => setAddType('lend')}
              >
                <Text style={[styles.typeBtnText, addType === 'lend' && { color: '#fff' }]}>I Lent</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, addType === 'borrow' && { backgroundColor: COLORS.red, borderColor: COLORS.red }]}
                onPress={() => setAddType('borrow')}
              >
                <Text style={[styles.typeBtnText, addType === 'borrow' && { color: '#fff' }]}>I Borrowed</Text>
              </TouchableOpacity>
            </View>

            {/* Contact */}
            <TouchableOpacity style={styles.contactPickerBtn} onPress={() => setShowContactPicker(true)}>
              <Text style={addContact ? styles.contactPickerValue : styles.contactPickerPlaceholder}>
                {addContact ? `${addContact.name} · ${addContact.phone}` : 'Select Contact'}
              </Text>
              <Text style={styles.contactPickerArrow}>›</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.modalInput}
              placeholder="Amount"
              placeholderTextColor={COLORS.textMuted}
              value={addAmount}
              onChangeText={setAddAmount}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Note (optional)"
              placeholderTextColor={COLORS.textMuted}
              value={addNote}
              onChangeText={setAddNote}
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowAddModal(false); setAddContact(null); setAddAmount(''); setAddNote(''); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSave, addType === 'borrow' && { backgroundColor: COLORS.red }]} onPress={handleAddRecord}>
                <Text style={styles.modalSaveText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ContactPicker visible={showContactPicker} onClose={() => setShowContactPicker(false)} onSelect={(c) => { setAddContact(c); setShowContactPicker(false); }} />
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
  backBtn: { width: 60 },
  backBtnText: { color: COLORS.accent, fontSize: 22, fontWeight: '700' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  addBtn: { backgroundColor: COLORS.green + '25', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: COLORS.green + '40' },
  addBtnText: { color: COLORS.green, fontWeight: '800', fontSize: 13 },
  content: { paddingHorizontal: 20, paddingTop: 16 },

  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  summaryCard: { flex: 1, backgroundColor: '#18181B', borderRadius: 16, padding: 16, borderWidth: 1 },
  summaryLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 6 },
  summaryValue: { fontSize: FONT_SIZE.xl, fontWeight: '800' },

  contactCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181B',
    borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#27272A',
  },
  contactAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.accent + '25', alignItems: 'center', justifyContent: 'center' },
  contactAvatarText: { color: COLORS.accent, fontWeight: '800', fontSize: 20 },
  contactName: { color: '#fff', fontWeight: '700', fontSize: 16 },
  contactRecords: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  contactNet: { alignItems: 'flex-end' },
  contactNetLabel: { fontWeight: '700', fontSize: 14 },
  settledText: { color: COLORS.green, fontSize: 11, marginTop: 2 },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptySub: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 24 },
  emptyBtn: { backgroundColor: COLORS.green, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  emptyBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  // Profile card
  profileCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181B',
    borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#27272A',
  },
  profileAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.accent + '25', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  profileAvatarText: { color: COLORS.accent, fontWeight: '800', fontSize: 24 },
  profileName: { color: '#fff', fontSize: 20, fontWeight: '800' },
  profilePhone: { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },
  profileRecords: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },

  balanceRow: { flexDirection: 'row', backgroundColor: '#18181B', borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#27272A' },
  balanceItem: { flex: 1, alignItems: 'center', padding: 16 },
  balanceLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  balanceValue: { fontSize: FONT_SIZE.xxl, fontWeight: '800' },
  balanceDivider: { width: 1, backgroundColor: '#27272A', marginVertical: 12 },

  netCard: { backgroundColor: '#18181B', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#27272A', alignItems: 'center' },
  netLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  netValue: { fontSize: FONT_SIZE.xxxl, fontWeight: '800' },
  netStatus: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },

  addRecordBtn: { backgroundColor: COLORS.green, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 20 },
  addRecordBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  tabsRow: { flexDirection: 'row', backgroundColor: '#18181B', borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: '#27272A' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: COLORS.accent },
  tabText: { color: COLORS.textMuted, fontWeight: '700', fontSize: 14 },
  tabTextActive: { color: '#fff' },

  recordCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181B',
    borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#27272A',
  },
  recordDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  recordNote: { color: '#fff', fontWeight: '600', fontSize: 14 },
  recordDate: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  recordRight: { alignItems: 'flex-end' },
  recordAmount: { fontWeight: '800', fontSize: 15, marginBottom: 4 },
  paidBadge: { backgroundColor: COLORS.green + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  paidText: { color: COLORS.green, fontSize: 9, fontWeight: '800' },
  removeBtn: { backgroundColor: '#27272A', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  removeText: { color: COLORS.textMuted, fontSize: 9, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#18181B', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, borderWidth: 1, borderColor: '#3F3F46' },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 20 },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  typeBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#27272A', alignItems: 'center', borderWidth: 1, borderColor: '#3F3F46' },
  typeBtnActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  typeBtnText: { color: COLORS.textMuted, fontWeight: '700', fontSize: 14 },
  contactPickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#27272A', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#3F3F46' },
  contactPickerValue: { flex: 1, color: '#fff', fontWeight: '600' },
  contactPickerPlaceholder: { flex: 1, color: COLORS.textMuted },
  contactPickerArrow: { color: COLORS.accent, fontSize: 20 },
  modalInput: { backgroundColor: '#27272A', borderRadius: 14, padding: 14, color: '#fff', fontSize: 16, marginBottom: 12, borderWidth: 1, borderColor: '#3F3F46' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalCancel: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: '#27272A', alignItems: 'center' },
  modalCancelText: { color: COLORS.textMuted, fontWeight: '700' },
  modalSave: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: COLORS.green, alignItems: 'center' },
  modalSaveText: { color: '#fff', fontWeight: '800' },
});
