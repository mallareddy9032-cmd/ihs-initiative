// ============================================================================
// FILE: src/components/ActionOverlay.tsx
// CONTEXT: React Native - Redundant Input Prevention
// ============================================================================

import React, { useEffect } from 'react';
import {
  Modal,
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  BackHandler,
} from 'react-native';

import { colors } from '../theme/colors';

interface ActionOverlayProps {
  isVisible: boolean;
  message: string;
}

export const ActionOverlay: React.FC<ActionOverlayProps> = ({ isVisible, message }) => {
  useEffect(() => {
    if (!isVisible) {
      return;
    }

    // Hard-block Android hardware back while panic engine is racing WSS/SMS.
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [isVisible]);

  return (
    <Modal
      transparent={true}
      animationType="fade"
      visible={isVisible}
      onRequestClose={() => {}} // Disables Android hardware back button dismiss
    >
      <View style={styles.overlayContainer}>
        <View style={styles.dialogBox}>
          <ActivityIndicator size="large" color={colors.danger} style={styles.spinner} />
          <Text style={styles.messageText}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogBox: {
    backgroundColor: colors.surface,
    padding: 30,
    borderRadius: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 250,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  spinner: {
    transform: [{ scale: 1.5 }],
    marginBottom: 20,
  },
  messageText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});
