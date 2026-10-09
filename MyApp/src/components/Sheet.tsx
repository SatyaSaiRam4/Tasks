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
import { useLayout } from '../hooks/useLayout';
import { easeOut } from '../animations';
import { Gradient, Sheen } from './Gradient';
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

/**
 * A bottom sheet on a dimmed backdrop; glides up with a soft landing, or
 * fades under reduced motion. On tablets and desktops it floats as a
 * centered dialog instead.
 */
export function Sheet({ visible, onClose, title, subtitle, children, dismissable = true }: SheetProps) {
  const insets = useSafeAreaInsets();
  const { reduced } = useMotion();
  const { isTablet } = useLayout();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: reduced ? 0 : 480,
        easing: easeOut,
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(progress, { toValue: 0, duration: reduced ? 0 : 220, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() =>
        setMounted(false),
      );
    }
  }, [visible, mounted, progress, reduced]);

  if (!mounted) return null;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [isTablet ? 40 : 460, 0] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [isTablet ? 0.96 : 1, 1] });
  return (
    <Modal transparent visible animationType="none" onRequestClose={() => {
      if (dismissable) onClose();
    }} statusBarTranslucent>
      <KeyboardAvoidingView style={[styles.flex, isTablet && styles.center]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => dismissable && onClose()}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            isTablet ? styles.dialog : { paddingBottom: insets.bottom + spacing.xl },
            { opacity: isTablet ? progress : 1, transform: [{ translateY }, { scale }] },
          ]}
          accessibilityViewIsModal
        >
          <Gradient colors={[colors.backgroundRaised, colors.background]} direction="vertical" style={StyleSheet.absoluteFill} />
          <Sheen inset="20%" />
          {isTablet ? <View style={styles.dialogTop} /> : <View style={styles.handle} />}
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
        <View style={[styles.confirmIcon, destructive ? styles.confirmIconDanger : styles.confirmIconGold]}>
          <View style={[styles.confirmIconInner, destructive ? styles.confirmIconDanger : styles.confirmIconGold]}>
            <Icon name={icon} size={24} color={destructive ? colors.danger : colors.gold} strokeWidth={1.6} />
          </View>
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
              {selected ? <Icon name="check" size={18} color={colors.gold} strokeWidth={2.2} /> : null}
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
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
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
    maxHeight: '90%',
    paddingHorizontal: spacing.xl + 4,
    paddingTop: spacing.md,
    backgroundColor: colors.backgroundRaised,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldLine,
    overflow: 'hidden',
  },
  dialog: {
    position: 'relative',
    width: '100%',
    maxWidth: 520,
    maxHeight: '86%',
    borderRadius: radius.xxl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  dialogTop: {
    height: spacing.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.goldLine,
    marginBottom: spacing.xl,
  },
  title: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...t.caption,
    marginBottom: spacing.lg,
  },
  confirmIcon: {
    alignSelf: 'center',
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  confirmIconInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  confirmIconGold: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.goldLine,
  },
  confirmIconDanger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerSoft,
  },
  confirmTitle: {
    textAlign: 'center',
    fontSize: 28,
    lineHeight: 32,
  },
  confirmMessage: {
    ...t.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  confirmActions: {
    marginTop: spacing.xxl,
    gap: spacing.sm,
  },
  options: {
    maxHeight: 460,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md + 4,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  optionSelected: {
    backgroundColor: colors.goldSoft,
    borderColor: colors.goldLine,
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
