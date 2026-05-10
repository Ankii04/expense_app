import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, UPI_APPS } from '../utils/theme';

export default function UPIAppChooser({ upiId, payeeName, amount, note, onAppSelected }) {
  const handlePress = async (app) => {
    const params = new URLSearchParams({
      pa: upiId,
      pn: payeeName || '',
      am: String(amount || 0),
      cu: 'INR',
      tn: note || '',
    });

    const url = `${app.scheme}?${params.toString()}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        // Fallback to generic upi:// intent
        const fallback = `upi://pay?${params.toString()}`;
        await Linking.openURL(fallback);
      }
    } catch (e) {
      // Fallback to generic upi:// intent
      try {
        const fallback = `upi://pay?${params.toString()}`;
        await Linking.openURL(fallback);
      } catch {
        console.warn('Cannot open UPI app:', e);
      }
    }

    if (onAppSelected) onAppSelected(app);
  };

  return (
    <View style={styles.grid}>
      {UPI_APPS.map((app) => (
        <TouchableOpacity
          key={app.id}
          activeOpacity={0.7}
          onPress={() => handlePress(app)}
          style={styles.appBtn}
        >
          <View style={styles.iconWrap}>
            <Text style={styles.emoji}>{app.emoji}</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {app.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },
  appBtn: {
    width: '30%',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
    // subtle glow
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emoji: {
    fontSize: 26,
  },
  name: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: '500',
    textAlign: 'center',
  },
});
