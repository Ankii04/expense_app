import { useState, useEffect, useCallback } from 'react';
import * as store from '../store/expenseStore';

export function useExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    setExpenses(store.getExpenses());
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return {
    expenses,
    loading,
    refresh,
    addExpense: (e) => { store.addExpense(e); refresh(); },
    deleteExpense: (id) => { store.deleteExpense(id); refresh(); },
    monthTotal: expenses
      .filter(e => new Date(e.date).getMonth() === new Date().getMonth())
      .reduce((sum, e) => sum + e.amount, 0),
  };
}

export function useBudgets() {
  const [budgets, setBudgets] = useState({});
  const refresh = useCallback(() => setBudgets(store.getBudgets()), []);
  useEffect(() => { refresh(); }, [refresh]);

  return {
    budgets,
    setBudget: (id, amt) => { store.setBudget(id, amt); refresh(); },
    refresh,
  };
}

export function useGroups() {
  const [groups, setGroups] = useState([]);
  const refresh = useCallback(() => setGroups(store.getGroups()), []);
  useEffect(() => { refresh(); }, [refresh]);

  return {
    groups,
    refresh,
    addGroup: (g) => { store.addGroup(g); refresh(); },
    updateGroup: (id, u) => { store.updateGroup(id, u); refresh(); },
  };
}

export function useProfile() {
  const [profile, setProfile] = useState({ name: 'User' });
  const refresh = useCallback(() => setProfile(store.getProfile()), []);
  useEffect(() => { refresh(); }, [refresh]);

  return {
    profile,
    saveProfile: (p) => { store.saveProfile(p); refresh(); },
  };
}

export function useLends() {
  const [lends, setLends] = useState([]);
  const refresh = useCallback(() => setLends(store.getLends()), []);
  useEffect(() => { refresh(); }, [refresh]);

  return {
    lends,
    refresh,
    addLend: (l) => { store.addLend(l); refresh(); },
    contactSummaries: lends.reduce((acc, l) => {
      const key = l.contactPhone || l.contactName;
      if (!acc[key]) acc[key] = { contactName: l.contactName, lent: 0, borrowed: 0, records: [] };
      if (l.type === 'lend') acc[key].lent += l.paid ? 0 : l.amount;
      else acc[key].borrowed += l.paid ? 0 : l.amount;
      acc[key].records.push(l);
      return acc;
    }, {}),
  };
}
