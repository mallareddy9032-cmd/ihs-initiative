// ============================================================================
// FILE: src/navigation/BottomTabs.tsx
// CONTEXT: 5-hub concierge bottom navigation dock
// ============================================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CareProvider } from '../context/CareContext';
import { HomeScreen } from '../screens/HomeScreen';
import { VisitsScreen } from '../screens/VisitsScreen';
import { DoctorVisitScreen } from '../screens/DoctorVisitScreen';
import { HealthVaultScreen } from '../screens/HealthVaultScreen';
import { MyCareScreen } from '../screens/MyCareScreen';
import { FloatingSOS } from '../components/FloatingSOS';
import { colors } from '../theme/colors';

export type MainTabParamList = {
  Home: { ihsUid: string };
  Visits: undefined;
  DoctorVisit: { mode?: 'home' | 'tele'; service?: string } | undefined;
  HealthVault: { focus?: 'vitals' | 'records' | 'orders' } | undefined;
  MyCare: { focus?: 'plan' | 'family' | 'insurance' } | undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const TabIcon: React.FC<{ label: string; focused: boolean; glyph: string }> = ({
  label,
  focused,
  glyph,
}) => (
  <View style={styles.tabIconWrap}>
    <Text style={[styles.tabGlyph, focused && styles.tabGlyphFocused]}>{glyph}</Text>
    <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

interface BottomTabsProps {
  ihsUid: string;
}

export const BottomTabs: React.FC<BottomTabsProps> = ({ ihsUid }) => {
  return (
    <CareProvider>
      <View style={styles.root}>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarShowLabel: false,
            tabBarStyle: styles.tabBar,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textSecondary,
          }}
        >
          <Tab.Screen
            name="Home"
            component={HomeScreen}
            initialParams={{ ihsUid }}
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon label="Home" glyph="⌂" focused={focused} />
              ),
            }}
          />
          <Tab.Screen
            name="Visits"
            component={VisitsScreen}
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon label="Visits" glyph="◎" focused={focused} />
              ),
            }}
          />
          <Tab.Screen
            name="DoctorVisit"
            component={DoctorVisitScreen}
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon label="Doctor" glyph="✚" focused={focused} />
              ),
            }}
          />
          <Tab.Screen
            name="HealthVault"
            component={HealthVaultScreen}
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon label="Vault" glyph="▣" focused={focused} />
              ),
            }}
          />
          <Tab.Screen
            name="MyCare"
            component={MyCareScreen}
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon label="My Care" glyph="♥" focused={focused} />
              ),
            }}
          />
        </Tab.Navigator>

        <FloatingSOS ihsUid={ihsUid} />
      </View>
    </CareProvider>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBar: {
    height: 68,
    paddingTop: 8,
    paddingBottom: 10,
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    borderTopColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
  },
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 58,
    paddingVertical: 2,
  },
  tabGlyph: {
    fontSize: 17,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  tabGlyphFocused: {
    color: colors.primary,
    transform: [{ scale: 1.08 }],
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabLabelFocused: {
    color: colors.primary,
    fontWeight: '800',
  },
});
