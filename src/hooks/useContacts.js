import { useState, useEffect, useCallback } from 'react';
import * as Contacts from 'expo-contacts';

export function useContacts() {
  const [contacts, setContacts] = useState([]);
  const [permission, setPermission] = useState(null);
  const [loading, setLoading] = useState(false);

  const requestPermission = useCallback(async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      setPermission(status === 'granted');
      return status === 'granted';
    } catch {
      setPermission(false);
      return false;
    }
  }, []);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const granted = await requestPermission();
      if (!granted) {
        setLoading(false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
        sort: Contacts.SortTypes.FirstName,
      });

      // Normalise – only keep contacts that have a phone number
      const cleaned = data
        .filter((c) => c.phoneNumbers && c.phoneNumbers.length > 0)
        .map((c) => ({
          id: c.id,
          name: c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unknown',
          phone: c.phoneNumbers[0].number || '',
        }));

      setContacts(cleaned);
    } catch (e) {
      console.warn('Contacts load error:', e);
    }
    setLoading(false);
  }, [requestPermission]);

  useEffect(() => {
    // Don't auto-load – call loadContacts() when needed
  }, []);

  const searchContacts = useCallback(
    (query) => {
      if (!query) return contacts;
      const q = query.toLowerCase();
      return contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')),
      );
    },
    [contacts],
  );

  return { contacts, permission, loading, loadContacts, searchContacts };
}
