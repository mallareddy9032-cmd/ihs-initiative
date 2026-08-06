/**
 * react-native → react-native-web bridge with Android-only stubs for Chrome.
 */
export * from 'react-native-web';

// RNW ships Alert.alert as a no-op — override so service tiles / SOS feedback work in Chrome.
export { Alert } from './Alert';

export const PermissionsAndroid = {
  PERMISSIONS: {
    ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
    ACCESS_COARSE_LOCATION: 'android.permission.ACCESS_COARSE_LOCATION',
    SEND_SMS: 'android.permission.SEND_SMS',
    READ_SMS: 'android.permission.READ_SMS',
    CAMERA: 'android.permission.CAMERA',
    RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
    READ_EXTERNAL_STORAGE: 'android.permission.READ_EXTERNAL_STORAGE',
    WRITE_EXTERNAL_STORAGE: 'android.permission.WRITE_EXTERNAL_STORAGE',
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    NEVER_ASK_AGAIN: 'never_ask_again',
  },
  async check(): Promise<boolean> {
    return true;
  },
  async checkMultiple(
    permissions: string[],
  ): Promise<Record<string, boolean>> {
    return Object.fromEntries(permissions.map((p) => [p, true]));
  },
  async request(): Promise<string> {
    return 'granted';
  },
  async requestMultiple(
    permissions: string[],
  ): Promise<Record<string, string>> {
    return Object.fromEntries(permissions.map((p) => [p, 'granted']));
  },
};

type BackHandlerSubscription = { remove: () => void };

export const BackHandler = {
  exitApp(): void {
    // no-op on web
  },
  addEventListener(
    _eventName: string,
    _handler: () => boolean | null | undefined,
  ): BackHandlerSubscription {
    return { remove() {} };
  },
  removeEventListener(): void {
    // no-op (deprecated API)
  },
};
