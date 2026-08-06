/// <reference types="react-native" />

import type { NativeModule } from 'react-native';

export interface DirectSmsModuleInterface extends NativeModule {
  sendDirectSms(phoneNumber: string, message: string): Promise<string>;
}

declare module 'react-native' {
  interface NativeModulesStatic {
    DirectSmsModule: DirectSmsModuleInterface;
  }
}

export {};
