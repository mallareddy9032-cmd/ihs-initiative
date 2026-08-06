/**
 * Minimal react-native-screens stub for web (native-stack unused on web).
 */
import React from 'react';
import { View } from 'react-native';

export function enableScreens(_enabled?: boolean): void {
  // no-op
}

export function enableFreeze(_enabled?: boolean): void {
  // no-op
}

export function screensEnabled(): boolean {
  return false;
}

export const Screen = View;
export const ScreenContainer = View;
export const ScreenStack = View;
export const ScreenStackHeaderConfig = () => null;
export const NativeScreen = View;
export const NativeScreenContainer = View;

export default {
  enableScreens,
  enableFreeze,
  screensEnabled,
  Screen,
  ScreenContainer,
  ScreenStack,
  ScreenStackHeaderConfig,
  NativeScreen,
  NativeScreenContainer,
};
