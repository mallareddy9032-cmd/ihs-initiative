// ============================================================================
// FILE: src/screens/LoginScreen.tsx
// CONTEXT: Concierge member access
// ============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SecureStorage } from '../utils/secureStorage';
import type { RootStackParamList } from '../types/navigation';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export const LoginScreen: React.FC<Props> = ({ route }) => {
  const setAuth = route.params?.setAuth;
  const [uid, setUid] = useState('');
  const [aesKey, setAesKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sanitizeUid = (raw: string) =>
    raw
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 20);

  const handleLogin = async () => {
    setError(null);
    if (uid.length < 4) {
      setError('Enter a valid IHS UID (e.g., IHS-ANTP-00001).');
      return;
    }

    setIsLoading(true);
    try {
      const provisionedKey = aesKey.trim() || `ihs-aes-${uid}`;
      await SecureStorage.saveSession(uid, provisionedKey);
      setAuth?.(uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to persist session.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.brand}>IHS</Text>
      <Text style={styles.title}>Healthcare Concierge</Text>
      <Text style={styles.subtitle}>Secure member access for doorstep care</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.label}>IHS UID</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="IHS-ANTP-00001"
        placeholderTextColor={colors.textSecondary}
        value={uid}
        onChangeText={(value) => setUid(sanitizeUid(value))}
      />

      <Text style={styles.label}>AES Provisioning Key (optional)</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        placeholder="Provisioned at enrollment"
        placeholderTextColor={colors.textSecondary}
        value={aesKey}
        onChangeText={setAesKey}
      />

      <Pressable
        style={[styles.button, (isLoading || uid.length < 4) && styles.buttonDisabled]}
        disabled={isLoading || uid.length < 4}
        onPress={() => {
          void handleLogin();
        }}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.darkSlate} />
        ) : (
          <Text style={styles.buttonText}>ENTER CONCIERGE</Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  brand: {
    color: colors.primary,
    fontWeight: '900',
    fontSize: 36,
    letterSpacing: 4,
    marginBottom: 8,
  },
  title: {
    color: colors.darkSlate,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 28,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.darkSlate,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 18,
    fontSize: 16,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: colors.border,
  },
  buttonText: {
    color: colors.darkSlate,
    fontWeight: '900',
    letterSpacing: 1,
  },
  error: {
    color: colors.danger,
    marginBottom: 16,
    fontWeight: '600',
  },
});
