import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, StyleSheet } from 'react-native';

import HomeScreen from './src/screens/HomeScreen';
import ScanScreen from './src/screens/ScanScreen';
import PayScreen from './src/screens/PayScreen';
import ExpensesScreen from './src/screens/ExpensesScreen';
import BudgetScreen from './src/screens/BudgetScreen';
import SplitScreen from './src/screens/SplitScreen';
import RecurringScreen from './src/screens/RecurringScreen';

const COLORS = {
  background: '#0A0A0F',
  card: '#13131A',
  accent: '#7C6AFF',
  textPrimary: '#F0F0FF',
  textSecondary: '#8888AA',
  textMuted: '#4A4A6A',
  border: 'rgba(255,255,255,0.06)',
};

const AppTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORS.accent,
    background: COLORS.background,
    card: COLORS.card,
    text: COLORS.textPrimary,
    border: COLORS.border,
    notification: COLORS.accent,
  },
};

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// ─── Tab icon component ──────────────────────────────────────
function TabIcon({ emoji, label, focused }) {
  return (
    <View style={styles.tabIcon}>
      <Text style={[styles.tabEmoji, focused && styles.tabEmojiActive]}>{emoji}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
      {focused && <View style={styles.tabDot} />}
    </View>
  );
}

// ─── More Stack (Split + Recurring) ──────────────────────────
function MoreScreen({ navigation }) {
  return (
    <View style={styles.moreContainer}>
      <Text style={styles.moreTitle}>More</Text>

      <View style={styles.moreBtn} >
        <Text
          style={styles.moreBtnText}
          onPress={() => navigation.navigate('Split')}
        >
          🤝  Split Expenses
        </Text>
      </View>

      <View style={styles.moreBtn}>
        <Text
          style={styles.moreBtnText}
          onPress={() => navigation.navigate('Recurring')}
        >
          🔄  Recurring Payments
        </Text>
      </View>

      <View style={[styles.moreBtn, { marginTop: 24 }]}>
        <Text style={[styles.moreBtnText, { color: COLORS.textMuted }]}>
          ⚡  Antigravity v1.0
        </Text>
      </View>
    </View>
  );
}

function MoreStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MoreHome" component={MoreScreen} />
      <Stack.Screen name="Split" component={SplitScreen} />
      <Stack.Screen name="Recurring" component={RecurringScreen} />
    </Stack.Navigator>
  );
}

// ─── Main Stack (wraps tabs + Pay screen) ────────────────────
function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Home" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="ScanTab"
        component={ScanScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="📷" label="Scan" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="ExpensesTab"
        component={ExpensesScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="📊" label="Expenses" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="BudgetTab"
        component={BudgetScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎯" label="Budget" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="MoreTab"
        component={MoreStack}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" label="More" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <NavigationContainer theme={AppTheme}>
        <StatusBar style="light" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={TabNavigator} />
          <Stack.Screen
            name="Pay"
            component={PayScreen}
            options={{
              presentation: 'modal',
              gestureEnabled: true,
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    height: 80,
    paddingBottom: 16,
    paddingTop: 8,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
  },
  tabEmoji: {
    fontSize: 20,
    opacity: 0.5,
  },
  tabEmojiActive: {
    opacity: 1,
    fontSize: 22,
  },
  tabLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 4,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.accent,
    marginTop: 4,
  },

  // More screen
  moreContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  moreTitle: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 24,
  },
  moreBtn: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  moreBtnText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
