import { useState, useEffect, useCallback } from 'react';
import {
  getExpenses,
  addExpense as storeAdd,
  deleteExpense as storeDel,
  updateExpense as storeUpdateExpense,
  getExpensesByMonth,
  getExpensesByCategory,
  getMonthTotal,
  getBudgets,
  setBudget as storeSetBudget,
  deleteBudget as storeDelBudget,
  getSplits,
  addSplit as storeAddSplit,
  updateSplit as storeUpdateSplit,
  deleteSplit as storeDelSplit,
  getRecurring,
  addRecurring as storeAddRecurring,
  updateRecurring as storeUpdateRecurring,
  deleteRecurring as storeDelRecurring,
  getGroups,
  addGroup as storeAddGroup,
  updateGroup as storeUpdateGroup,
  deleteGroup as storeDelGroup,
  getLends,
  addLend as storeAddLend,
  updateLend as storeUpdateLend,
  deleteLend as storeDelLend,
  getProfile,
  setProfile as storeSetProfile,
} from '../store/expenseStore';
import { getMonthKey } from '../utils/theme';

export function useExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [monthTotal, setMonthTotal] = useState(0);
  const [categorySpend, setCategorySpend] = useState({});
  const [loading, setLoading] = useState(true);

  const currentMonth = getMonthKey();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [all, total, catSpend] = await Promise.all([
        getExpenses(),
        getMonthTotal(currentMonth),
        getExpensesByCategory(currentMonth),
      ]);
      setExpenses(all);
      setMonthTotal(total);
      setCategorySpend(catSpend);
    } catch (e) {
      console.warn('useExpenses refresh error:', e);
    }
    setLoading(false);
  }, [currentMonth]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addExpense = useCallback(
    async (expense) => {
      const entry = await storeAdd(expense);
      await refresh();
      return entry;
    },
    [refresh],
  );

  const deleteExpense = useCallback(
    async (id) => {
      await storeDel(id);
      await refresh();
    },
    [refresh],
  );

  return {
    expenses,
    monthTotal,
    categorySpend,
    loading,
    refresh,
    addExpense,
    deleteExpense,
    updateExpense: useCallback(
      async (id, updates) => {
        await storeUpdateExpense(id, updates);
        await refresh();
      },
      [refresh],
    ),
  };
}

export function useGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const g = await getGroups();
    setGroups(g);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addGroup = useCallback(
    async (group) => {
      const entry = await storeAddGroup(group);
      await refresh();
      return entry;
    },
    [refresh],
  );

  const updateGroup = useCallback(
    async (id, updates) => {
      await storeUpdateGroup(id, updates);
      await refresh();
    },
    [refresh],
  );

  const deleteGroup = useCallback(
    async (id) => {
      await storeDelGroup(id);
      await refresh();
    },
    [refresh],
  );

  return { groups, loading, refresh, addGroup, updateGroup, deleteGroup };
}

export function useBudgets() {
  const [budgets, setBudgetsState] = useState({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const b = await getBudgets();
    setBudgetsState(b);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setBudget = useCallback(
    async (catId, amount) => {
      await storeSetBudget(catId, amount);
      await refresh();
    },
    [refresh],
  );

  const deleteBudget = useCallback(
    async (catId) => {
      await storeDelBudget(catId);
      await refresh();
    },
    [refresh],
  );

  return { budgets, loading, refresh, setBudget, deleteBudget };
}

export function useSplits() {
  const [splits, setSplits] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const s = await getSplits();
    setSplits(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addSplit = useCallback(
    async (split) => {
      const entry = await storeAddSplit(split);
      await refresh();
      return entry;
    },
    [refresh],
  );

  const updateSplit = useCallback(
    async (id, updates) => {
      await storeUpdateSplit(id, updates);
      await refresh();
    },
    [refresh],
  );

  const deleteSplit = useCallback(
    async (id) => {
      await storeDelSplit(id);
      await refresh();
    },
    [refresh],
  );

  return { splits, loading, refresh, addSplit, updateSplit, deleteSplit };
}

export function useRecurring() {
  const [recurring, setRecurring] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const r = await getRecurring();
    setRecurring(r);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addRecurring = useCallback(
    async (item) => {
      const entry = await storeAddRecurring(item);
      await refresh();
      return entry;
    },
    [refresh],
  );

  const updateRecurring = useCallback(
    async (id, updates) => {
      await storeUpdateRecurring(id, updates);
      await refresh();
    },
    [refresh],
  );

  const deleteRecurring = useCallback(
    async (id) => {
      await storeDelRecurring(id);
      await refresh();
    },
    [refresh],
  );

  return { recurring, loading, refresh, addRecurring, updateRecurring, deleteRecurring };
}

export function useLends() {
  const [lends, setLends] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const l = await getLends();
    setLends(l);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addLend = useCallback(
    async (lend) => {
      const entry = await storeAddLend(lend);
      await refresh();
      return entry;
    },
    [refresh],
  );

  const updateLend = useCallback(
    async (id, updates) => {
      await storeUpdateLend(id, updates);
      await refresh();
    },
    [refresh],
  );

  const deleteLend = useCallback(
    async (id) => {
      await storeDelLend(id);
      await refresh();
    },
    [refresh],
  );

  // Aggregate: per-contact lent/borrowed totals
  const contactSummaries = lends.reduce((acc, l) => {
    const key = l.contactPhone || l.contactName;
    if (!acc[key]) {
      acc[key] = {
        contactName: l.contactName,
        contactPhone: l.contactPhone,
        lent: 0,
        borrowed: 0,
        records: [],
      };
    }
    if (l.type === 'lend') acc[key].lent += l.paid ? 0 : l.amount;
    else acc[key].borrowed += l.paid ? 0 : l.amount;
    acc[key].records.push(l);
    return acc;
  }, {});

  return {
    lends,
    contactSummaries: Object.values(contactSummaries),
    loading,
    refresh,
    addLend,
    updateLend,
    deleteLend,
  };
}

export function useProfile() {
  const [profile, setProfileState] = useState({ name: 'User' });

  const refresh = useCallback(async () => {
    const p = await getProfile();
    if (p && !Array.isArray(p)) {
      setProfileState(p);
    } else {
      setProfileState({ name: 'User' });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveProfile = useCallback(async (data) => {
    await storeSetProfile(data);
    setProfileState(data);
  }, []);

  return { profile, saveProfile, refresh };
}
