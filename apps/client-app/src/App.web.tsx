// ============================================================================
// FILE: src/App.web.tsx
// CONTEXT: Web Navigation Controller — Concierge shell (Chrome / Vite)
// ============================================================================

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import type { StackScreenProps } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LoginScreen } from './screens/LoginScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AmbulanceTrackingScreen } from './screens/AmbulanceTrackingScreen';
import { BottomTabs } from './navigation/BottomTabs';
import { SecureStorage } from './utils/secureStorage';
import { colors } from './theme/colors';
import type { RootStackParamList } from './types/navigation';

export type { RootStackParamList };

const Stack = createStackNavigator<RootStackParamList>();

function MainTabsScreen({ route }: StackScreenProps<RootStackParamList, 'MainTabs'>) {
  return <BottomTabs ihsUid={route.params.ihsUid} />;
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [userUid, setUserUid] = useState<string | null>(null);

  useEffect(() => {
    (globalThis as { __IHS_SET_AUTH__?: (uid: string | null) => void }).__IHS_SET_AUTH__ =
      setUserUid;

    let cancelled = false;
    const bootstrapAsync = async () => {
      try {
        const storedUid = await Promise.race([
          SecureStorage.getItem('ihs_uid'),
          new Promise<null>((resolve) => {
            setTimeout(() => resolve(null), 1500);
          }),
        ]);
        if (!cancelled && storedUid) {
          setUserUid(storedUid);
        }
      } catch (e) {
        console.error('Failed to restore session', e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void bootstrapAsync();

    return () => {
      cancelled = true;
      delete (globalThis as { __IHS_SET_AUTH__?: (uid: string | null) => void }).__IHS_SET_AUTH__;
    };
  }, []);

  if (isLoading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {userUid == null ? (
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              initialParams={{ setAuth: setUserUid }}
            />
          ) : (
            <>
              <Stack.Screen
                name="MainTabs"
                component={MainTabsScreen}
                initialParams={{ ihsUid: userUid }}
              />
              <Stack.Screen
                name="Settings"
                component={SettingsScreen}
                options={{
                  headerShown: true,
                  title: 'System Preferences',
                  headerStyle: { backgroundColor: colors.surface },
                  headerTintColor: colors.darkSlate,
                }}
              />
              <Stack.Screen
                name="AmbulanceTracking"
                component={AmbulanceTrackingScreen}
                options={{ presentation: 'card' }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
