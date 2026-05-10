import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, CATEGORIES } from '../utils/theme';

export default function CategoryPicker({ selected, onSelect, showAll = false }) {
  const cats = showAll ? [{ id: 'all', name: 'All', emoji: '📊', color: COLORS.accent }, ...CATEGORIES] : CATEGORIES;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {cats.map((cat) => {
        const active = selected === cat.id;
        return (
          <TouchableOpacity
            key={cat.id}
            activeOpacity={0.7}
            onPress={() => onSelect(cat.id)}
            style={[
              styles.chip,
              active && { backgroundColor: cat.color + '30', borderColor: cat.color },
            ]}
          >
            <Text style={styles.emoji}>{cat.emoji}</Text>
            <Text
              style={[
                styles.label,
                active && { color: cat.color },
              ]}
            >
              {cat.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SPACING.sm,
  },
  emoji: {
    fontSize: 14,
    marginRight: 6,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
  },
});
