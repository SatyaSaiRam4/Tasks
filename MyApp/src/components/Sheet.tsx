import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, type as t } from '../theme';
import { useMotion } from '../hooks/useMotion';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  dismissable?: boolean;
}

/** A bottom sheet with a dimmed backdrop; slides up, or fades under reduced motion. */
export function Sheet({ visible, onClose, title, subtitle, children, dismissable = true }: SheetProps) {
  const insets = useSafeAreaInsets();
  const { reduced } = useMotion();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: reduced ? 0 : 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(progress, { toValue: 0, duration: reduced ? 0 : 200, useNativeDriver: true }).start(() =>
        setMounted(false),
      );
    }
  }, [visible, mounted, progress, reduced]);

  if (!mounted) return null;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [420, 0] });
  return (
    <Modal transparent visible animationType="none" onRequestClose={() => {
      if (dismissable) onClose();
    }} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => dismissable && onClose()}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
        </Animated.View>
        <Animated.View
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY }] }]}
          accessibilityViewIsModal
        >
          <View style={styles.handle} />
          {title ? (
            <Text style={[t.heading, styles.title]} accessibilityRole="header">
              {title}
            </Text>
          ) : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---- ConfirmSheet ---------------------------------------------------------------------

interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  message?: string;
  icon?: IconName;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

/** Every destructive action, and anything that needs deliberate confirmation. */
export function ConfirmSheet({
  visible,
  title,
  message,
  icon,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmSheetProps) {
  return (
    <Sheet visible={visible} onClose={onCancel}>
      {icon ? (
        <View style={[styles.confirmIcon, { backgroundColor: destructive ? colors.dangerSoft : colors.primarySoft }]}>
          <Icon name={icon} size={26} color={destructive ? colors.danger : colors.primary} />
        </View>
      ) : null}
      <Text style={[t.heading, styles.confirmTitle]} accessibilityRole="header">
        {title}
      </Text>
      {message ? <Text style={styles.confirmMessage}>{message}</Text> : null}
      {children}
      <View style={styles.confirmActions}>
        <Button
          label={confirmLabel}
          onPress={onConfirm}
          variant={destructive ? 'danger' : 'primary'}
          loading={loading}
          size="lg"
        />
        <Button label={cancelLabel} onPress={onCancel} variant="ghost" />
      </View>
    </Sheet>
  );
}

// ---- SelectSheet ------------------------------------------------------------------------

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  color?: string;
}

export function SelectSheet<T extends string>({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: SelectOption<T>[];
  value: T | null;
  onSelect: (value: T) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <ScrollView style={styles.options} bounces={false}>
        {options.map(option => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                onSelect(option.value);
                onClose();
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && { opacity: 0.7 }]}
            >
              {option.color ? <View style={[styles.swatch, { backgroundColor: option.color }]} /> : null}
              <View style={styles.flex}>
                <Text style={styles.optionLabel}>{option.label}</Text>
                {option.description ? <Text style={styles.optionDescription}>{option.description}</Text> : null}
              </View>
              {selected ? <Icon name="check" size={18} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.backgroundRaised,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceHigh,
    marginBottom: spacing.lg,
  },
  title: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  confirmIcon: {
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  confirmTitle: {
    textAlign: 'center',
  },
  confirmMessage: {
    ...t.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  confirmActions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  options: {
    maxHeight: 460,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  optionSelected: {
    backgroundColor: colors.primarySoft,
  },
  optionLabel: {
    ...t.bodyStrong,
  },
  optionDescription: {
    ...t.caption,
    marginTop: 2,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
});
