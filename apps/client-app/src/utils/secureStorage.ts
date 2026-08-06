// ============================================================================
// FILE: src/utils/secureStorage.ts
// CONTEXT: Local session persistence for ihs_uid + AES key
// ============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  IHS_UID: 'ihs_uid',
  AES_KEY: 'ihs_aes_key',
  HOME_LAT: 'home_lat',
  HOME_LNG: 'home_lng',
  IS_PROXY: 'is_proxy_sponsor',
} as const;

export const SecureStorage = {
  async getItem(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
  },

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },

  async saveSession(ihsUid: string, aesKey: string): Promise<void> {
    await AsyncStorage.multiSet([
      [KEYS.IHS_UID, ihsUid],
      [KEYS.AES_KEY, aesKey],
    ]);
  },

  async clearSession(): Promise<void> {
    await AsyncStorage.multiRemove([KEYS.IHS_UID, KEYS.AES_KEY]);
  },

  async getAesKey(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.AES_KEY);
  },

  keys: KEYS,
};
