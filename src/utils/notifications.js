import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const NOTIF_SCHEDULED_KEY = '@spendify_notif_scheduled';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const requestNotificationPermissions = async () => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
};

export const scheduleMonthlySummaryNotification = async (monthTotal = 0, topCategory = '') => {
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return;

    // Cancel any previously scheduled monthly notifs
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Schedule for 1st of next month at 9 AM
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 9, 0, 0);

    const body = monthTotal > 0
      ? `You spent ₹${monthTotal.toLocaleString('en-IN')} this month${topCategory ? `. Top: ${topCategory}` : ''}. Check your Spendify summary!`
      : 'A new month begins! Track your spending with Spendify.';

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📊 Monthly Spending Summary',
        body,
        sound: true,
        data: { type: 'monthly_summary' },
      },
      trigger: nextMonth, // Shorthand for date trigger
    });

    await AsyncStorage.setItem(NOTIF_SCHEDULED_KEY, nextMonth.toISOString());
  } catch (e) {
    console.warn('Notification schedule error:', e);
  }
};

export const sendImmediateSummary = async (monthTotal = 0, topCategory = '') => {
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return;

    const body = monthTotal > 0
      ? `You spent ₹${monthTotal.toLocaleString('en-IN')} this month${topCategory ? `. Top: ${topCategory}` : ''}.`
      : 'Start tracking your expenses with Spendify!';

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📊 Spendify Summary',
        body,
        sound: true,
      },
      trigger: null, // immediate
    });
  } catch (e) {
    console.warn('Immediate notification error:', e);
  }
};
