// ============================================================================
// FILE: src/components/ui.tsx
// CONTEXT: Shared concierge UI primitives for interactive hubs
// ============================================================================

import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  Platform,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

export const Screen: React.FC<{
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
}> = ({ title, subtitle, children, rightSlot }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.screenHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>IHS CONCIERGE</Text>
          <Text style={styles.screenTitle}>{title}</Text>
          {subtitle ? <Text style={styles.screenSubtitle}>{subtitle}</Text> : null}
        </View>
        {rightSlot}
      </View>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
};

export const Card: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({
  children,
  style,
}) => <View style={[styles.card, style]}>{children}</View>;

export const SectionLabel: React.FC<{ children: string }> = ({ children }) => (
  <Text style={styles.sectionLabel}>{children}</Text>
);

export const PrimaryButton: React.FC<{
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'accent' | 'danger' | 'slate';
}> = ({ label, onPress, disabled, tone = 'primary' }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [
      styles.primaryBtn,
      tone === 'accent' && styles.btnAccent,
      tone === 'danger' && styles.btnDanger,
      tone === 'slate' && styles.btnSlate,
      disabled && styles.btnDisabled,
      pressed && !disabled && styles.iosPress,
    ]}
  >
    <Text
      style={[
        styles.primaryBtnText,
        tone === 'slate' && { color: colors.textPrimary },
      ]}
    >
      {label}
    </Text>
  </Pressable>
);

export const GhostButton: React.FC<{
  label: string;
  onPress: () => void;
  danger?: boolean;
}> = ({ label, onPress, danger }) => (
  <Pressable onPress={onPress} style={styles.ghostBtn}>
    <Text style={[styles.ghostBtnText, danger && { color: colors.danger }]}>{label}</Text>
  </Pressable>
);

export const ChipRow: React.FC<{
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}> = ({ options, value, onChange }) => (
  <View style={styles.chipRow}>
    {options.map((opt) => {
      const active = opt.id === value;
      return (
        <Pressable
          key={opt.id}
          onPress={() => onChange(opt.id)}
          style={[styles.chip, active && styles.chipActive]}
        >
          <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
        </Pressable>
      );
    })}
  </View>
);

export const Field: React.FC<{
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}> = ({ label, value, onChangeText, placeholder, multiline }) => (
  <View style={styles.fieldWrap}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textSecondary}
      multiline={multiline}
      style={[styles.fieldInput, multiline && styles.fieldMultiline]}
    />
  </View>
);

export const StatusPill: React.FC<{ label: string; tone?: 'ok' | 'warn' | 'muted' | 'danger' }> = ({
  label,
  tone = 'ok',
}) => (
  <View
    style={[
      styles.pill,
      tone === 'warn' && styles.pillWarn,
      tone === 'muted' && styles.pillMuted,
      tone === 'danger' && styles.pillDanger,
    ]}
  >
    <Text
      style={[
        styles.pillText,
        tone === 'warn' && { color: colors.warning },
        tone === 'muted' && { color: colors.textSecondary },
        tone === 'danger' && { color: colors.danger },
      ]}
    >
      {label}
    </Text>
  </View>
);

export const EmptyState: React.FC<{ title: string; body: string; actionLabel?: string; onAction?: () => void }> = ({
  title,
  body,
  actionLabel,
  onAction,
}) => (
  <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyBody}>{body}</Text>
    {actionLabel && onAction ? (
      <PrimaryButton label={actionLabel} onPress={onAction} tone="accent" />
    ) : null}
  </Card>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    marginBottom: 6,
  },
  screenTitle: {
    color: colors.darkSlate,
    fontSize: 26,
    fontWeight: '400',
    fontFamily: Platform.select({
      web: '"Playfair Display", Georgia, serif',
      default: 'Georgia',
    }),
  },
  screenSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 8,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  btnAccent: { backgroundColor: colors.accent, shadowColor: colors.accent },
  btnDanger: { backgroundColor: colors.danger, shadowColor: colors.danger },
  btnSlate: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    shadowOpacity: 0,
  },
  btnDisabled: { opacity: 0.5 },
  iosPress: {
    transform: [{ scale: 0.96 }],
  },
  primaryBtnText: {
    color: colors.textInverse,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  ghostBtn: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  ghostBtnText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 12,
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  fieldWrap: { marginBottom: 12 },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.darkSlate,
    fontSize: 15,
  },
  fieldMultiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillWarn: { backgroundColor: 'rgba(217,119,6,0.12)' },
  pillMuted: { backgroundColor: colors.surfaceMuted },
  pillDanger: { backgroundColor: colors.dangerSoft },
  pillText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  emptyTitle: {
    color: colors.darkSlate,
    fontWeight: '800',
    fontSize: 16,
    marginBottom: 6,
  },
  emptyBody: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
});

export type { TextStyle, ViewStyle };
