import { useState, useEffect, useCallback } from 'react';
import expenseService from '../services/expenseService';
import budgetService from '../services/budgetService';
import groupService from '../services/groupService';
import authService from '../services/authService';
import lendService from '../services/lendService';
import recurringService from '../services/recurringService';

export function useExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    expenseService.getPersonalExpenses()
      .then(data => {
        setExpenses(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return {
    expenses,
    loading,
    refresh,
    addExpense:    async (e)     => { await expenseService.addPersonalExpense(e); refresh(); },
    updateExpense: async (id, u) => { await expenseService.updateExpense(id, u);  refresh(); },
    deleteExpense: async (id)    => { await expenseService.deleteExpense(id);     refresh(); },
    monthTotal: expenses
      .filter(e => new Date(e.date).getMonth() === new Date().getMonth()
               && new Date(e.date).getFullYear() === new Date().getFullYear())
      .reduce((sum, e) => sum + e.amount, 0),
  };
}

export function useBudgets() {
  const [budgets, setBudgets] = useState({});
  const [loading, setLoading] = useState(true);
  
  const refresh = useCallback(() => {
    setLoading(true);
    budgetService.getBudgets()
      .then(data => {
        setBudgets(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);
  
  useEffect(() => { refresh(); }, [refresh]);

  return {
    budgets,
    loading,
    setBudget: async (id, amt) => { await budgetService.setBudget(id, amt); refresh(); },
    refresh,
  };
}

export function useGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    groupService.getGroups()
      .then(data => {
        setGroups(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);
  
  useEffect(() => { refresh(); }, [refresh]);

  return {
    groups,
    loading,
    refresh,
    addGroup:    async (g)     => { await groupService.addGroup(g);       refresh(); },
    updateGroup: async (id, u) => { await groupService.updateGroup(id, u); refresh(); },
    deleteGroup: async (id)    => { await groupService.deleteGroup(id);   refresh(); },
    addGroupExpense:    async (gId, e)     => { await expenseService.addGroupExpense(gId, e);           refresh(); },
    updateGroupExpense: async (gId, eId, u) => { await expenseService.updateExpense(eId, u); refresh(); },
    deleteGroupExpense: async (gId, eId)   => { await expenseService.deleteExpense(eId);     refresh(); },
  };
}

export function useProfile() {
  const [profile, setProfile] = useState({ name: 'User' });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    authService.getMe()
      .then(user => {
        setProfile({ name: user.name });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);
  
  useEffect(() => { refresh(); }, [refresh]);

  return {
    profile,
    loading,
    saveProfile: async (p) => {
      await authService.updateProfile(p.name);
      refresh();
    },
  };
}

export function useLends() {
  const [lends, setLends] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    lendService.getLends()
      .then(data => {
        setLends(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);
  
  useEffect(() => { refresh(); }, [refresh]);

  return {
    lends,
    loading,
    refresh,
    addLend:    async (l)     => { await lendService.addLend(l);           refresh(); },
    updateLend: async (id, u) => { await lendService.updateLend(id, u);   refresh(); },
    deleteLend: async (id)    => { await lendService.deleteLend(id);       refresh(); },
    contactSummaries: lends.reduce((acc, l) => {
      const key = l.contactPhone || l.contactName;
      if (!acc[key]) acc[key] = { contactName: l.contactName, lent: 0, borrowed: 0, records: [] };
      if (l.type === 'lend')   acc[key].lent     += l.paid ? 0 : l.amount;
      else                     acc[key].borrowed += l.paid ? 0 : l.amount;
      acc[key].records.push(l);
      return acc;
    }, {}),
  };
}

export function useRecurring() {
  const [recurring, setRecurring] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    recurringService.getRecurring()
      .then(data => {
        setRecurring(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);
  
  useEffect(() => { refresh(); }, [refresh]);

  return {
    recurring,
    loading,
    refresh,
    addRecurring:    async (r)     => { await recurringService.addRecurring(r);       refresh(); },
    updateRecurring: async (id, u) => { await recurringService.updateRecurring(id, u); refresh(); },
    deleteRecurring: async (id)    => { await recurringService.deleteRecurring(id);   refresh(); },
  };
}
