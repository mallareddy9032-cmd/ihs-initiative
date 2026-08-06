// ============================================================================
// FILE: src/screens/SettingsScreen.tsx
// CONTEXT: Session preferences / explicit logout only
// ============================================================================

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SecureStorage } from '../utils/secureStorage';
import type { RootStackParamList } from '../types/navigation';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export const SettingsScreen: React.FC<Props> = () => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'End Session?',
      'You will need to re-authenticate before SOS dispatch is available.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setIsLoggingOut(true);
              try {
                await SecureStorage.clearSession();
                const bridge = (globalThis as { __IHS_SET_AUTH__?: (uid: string | null) => void })
                  .__IHS_SET_AUTH__;
                bridge?.(null);
              } finally {
                setIsLoggingOut(false);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>IHS CONCIERGE</Text>
      <Text style={styles.title}>System Preferences</Text>
      <Text style={styles.body}>
        Logout is the only path back to the login screen. During an active session the hardware Back
        button cannot return you to authentication.
      </Text>

      <Pressable style={styles.button} onPress={handleLogout} disabled={isLoggingOut}>
        {isLoggingOut ? (
          <ActivityIndicator color={colors.textInverse} />
        ) : (
          <Text style={styles.buttonText}>LOG OUT</Text>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  title: {
    color: colors.darkSlate,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
  },
  body: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 28,
  },
  button: {
    backgroundColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.textInverse,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
