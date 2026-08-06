// ============================================================================
// FILE: src/components/Phase3HealthSchemeBanner.tsx
// CONTEXT: Upcoming Aarogyasri / PM-JAY auto-eligibility roadmap indicator
// ============================================================================

import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

export const Phase3HealthSchemeBanner: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable style={styles.banner} onPress={() => setOpen(true)}>
        <View style={styles.row}>
          <Text style={styles.title}>Aarogyasri / PM-JAY Auto-Eligibility Check</Text>
          <View style={styles.tag}>
            <Text style={styles.tagText}>PHASE 3</Text>
          </View>
        </View>
        <Text style={styles.hint}>Tap for roadmap details · government scheme verification</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.modal}>
            <Text style={styles.modalKicker}>PHASE 3 ROADMAP</Text>
            <Text style={styles.modalTitle}>Aarogyasri / PM-JAY Auto-Eligibility</Text>
            <Text style={styles.modalBody}>
              Future release will automatically verify government health scheme eligibility
              (Aarogyasri, Ayushman Bharat PM-JAY) against your IHS UID and ABHA linkage at
              intake and pharmacy fulfilment — reducing manual insurance desk checks.
            </Text>
            <Pressable style={styles.closeBtn} onPress={() => setOpen(false)}>
              <Text style={styles.closeText}>Got it</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
    flexShrink: 1,
  },
  tag: {
    backgroundColor: colors.warningSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagText: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  hint: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: colors.surface,
    padding: 22,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
  },
  modalKicker: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 6,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 10,
  },
  modalBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },
  closeBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 14,
  },
  closeText: {
    color: '#fff',
    fontWeight: '700',
  },
});
