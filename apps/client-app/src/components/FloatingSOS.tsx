// ============================================================================
// FILE: src/components/FloatingSOS.tsx
// CONTEXT: Persistent long-press emergency dispatch FAB — multi-ring pulse
// ============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  PermissionsAndroid,
  Platform,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import Geolocation from '@react-native-community/geolocation';
import { EmergencyTriggerEngine } from '../services/EmergencyTriggerEngine';
import { SecureStorage } from '../utils/secureStorage';
import { ActionOverlay } from './ActionOverlay';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../types/navigation';

interface FloatingSOSProps {
  ihsUid: string;
}

async function ensureDispatchPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const permissions = [
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    PermissionsAndroid.PERMISSIONS.SEND_SMS,
  ];

  const results = await PermissionsAndroid.requestMultiple(permissions);
  return permissions.every(
    (permission) => results[permission] === PermissionsAndroid.RESULTS.GRANTED,
  );
}

export const FloatingSOS: React.FC<FloatingSOSProps> = ({ ihsUid }) => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [isDispatching, setIsDispatching] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const holdAnim = useRef(new Animated.Value(1)).current;
  const ringA = useRef(new Animated.Value(0)).current;
  const ringB = useRef(new Animated.Value(0)).current;
  const ringC = useRef(new Animated.Value(0)).current;
  const lock = useRef(false);

  useEffect(() => {
    const breathe = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 1600,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 0,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]),
      );
    const a = breathe(ringA, 0);
    const b = breathe(ringB, 450);
    const c = breathe(ringC, 900);
    a.start();
    b.start();
    c.start();
    return () => {
      a.stop();
      b.stop();
      c.stop();
    };
  }, [ringA, ringB, ringC]);

  const openTracking = useCallback(
    (lat: number, lng: number, dispatchStatus: string) => {
      const params = {
        ihsUid,
        patientLat: lat,
        patientLng: lng,
        dispatchStatus,
      };
      const rootNav = navigation.getParent() as
        | { navigate: (name: string, p: typeof params) => void }
        | undefined;
      if (rootNav?.navigate) {
        rootNav.navigate('AmbulanceTracking', params);
      }
    },
    [ihsUid, navigation],
  );

  const pulseHold = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(holdAnim, {
          toValue: 1.1,
          duration: 320,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(holdAnim, {
          toValue: 1,
          duration: 320,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    ).start();
  }, [holdAnim]);

  const stopPulse = useCallback(() => {
    holdAnim.stopAnimation();
    holdAnim.setValue(1);
  }, [holdAnim]);

  const firePanic = useCallback(async () => {
    if (lock.current || isDispatching) {
      return;
    }
    lock.current = true;
    setIsDispatching(true);
    setIsHolding(false);
    stopPulse();

    try {
      const permitted = await ensureDispatchPermissions();
      if (!permitted) {
        Alert.alert(
          'Permissions Required',
          'Location and SMS are required for emergency fallback dispatch.',
        );
        return;
      }

      const aesKey = (await SecureStorage.getAesKey()) || `ihs-aes-${ihsUid}`;
      const engine = new EmergencyTriggerEngine(ihsUid, aesKey);

      await new Promise<void>((resolve) => {
        Geolocation.getCurrentPosition(
          async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            let status = 'DISPATCH_PENDING';

            try {
              status = await engine.firePanic({ lat, lng });
            } catch (error) {
              status =
                error instanceof Error ? `SIGNAL_RETRY · ${error.message}` : 'SIGNAL_RETRY';
            }

            openTracking(lat, lng, status);
            Alert.alert(
              'Emergency Signal Sent',
              'Ambulance tracking is live. IHS Command is mobilizing care.',
            );
            resolve();
          },
          (error) => {
            if (Platform.OS === 'web') {
              const lat = 14.6819;
              const lng = 77.6006;
              openTracking(lat, lng, 'DEMO_GPS_FALLBACK');
              Alert.alert(
                'Using pilot demo location',
                'Location permission unavailable — tracking opened with Ananthapur Urban grid coordinates.',
              );
              resolve();
              return;
            }
            Alert.alert('GPS Error', error.message || 'Enable location services to dispatch.');
            resolve();
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
        );
      });
    } finally {
      setIsDispatching(false);
      lock.current = false;
    }
  }, [ihsUid, isDispatching, openTracking, stopPulse]);

  const ringStyle = (anim: Animated.Value, size: number) => ({
    position: 'absolute' as const,
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 2,
    borderColor: 'rgba(255, 45, 85, 0.4)',
    alignSelf: 'center' as const,
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.65, 0] }),
    transform: [
      {
        scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.7] }),
      },
    ],
  });

  return (
    <>
      <ActionOverlay
        isVisible={isDispatching}
        message={'TRANSMITTING EMERGENCY SIGNAL…\nDo not leave this screen.'}
      />

      <View pointerEvents="box-none" style={styles.anchor}>
        <View style={styles.ringStack}>
          <Animated.View style={ringStyle(ringA, 72)} />
          <Animated.View style={ringStyle(ringB, 72)} />
          <Animated.View style={ringStyle(ringC, 72)} />
          <Animated.View style={{ transform: [{ scale: holdAnim }] }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Emergency SOS. Hold for one and a half seconds."
              onPressIn={() => {
                setIsHolding(true);
                pulseHold();
              }}
              onPressOut={() => {
                if (!isDispatching) {
                  setIsHolding(false);
                  stopPulse();
                }
              }}
              onLongPress={() => {
                void firePanic();
              }}
              delayLongPress={1500}
              disabled={isDispatching}
              style={({ pressed }) => [
                styles.fab,
                isHolding && styles.fabHolding,
                pressed && styles.fabPressed,
              ]}
            >
              <Text style={styles.fabLabel}>{isHolding ? 'HOLD' : 'SOS'}</Text>
            </Pressable>
          </Animated.View>
        </View>
        <Text style={styles.hint}>Hold 1.5s</Text>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    right: 18,
    bottom: 88,
    alignItems: 'center',
    zIndex: 50,
  },
  ringStack: {
    width: 120,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    minWidth: 96,
    height: 40,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF2D55',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
    borderWidth: 0,
  },
  fabHolding: {
    backgroundColor: '#E11D48',
  },
  fabPressed: {
    transform: [{ scale: 0.96 }],
  },
  fabLabel: {
    color: colors.textInverse,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1.2,
  },
  hint: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
