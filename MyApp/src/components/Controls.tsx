import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, gradients, hitSlop, radius, shadow, spacing, TAB_BAR_HEIGHT, TOUCH_TARGET, type as t } from '../theme';
import { useMotion } from '../hooks/useMotion';
import { Gradient } from './Gradient';
import { Icon, type IconName } from './Icon';

// ---- IconButton ---------------------------------------------------------------

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  color = colors.text,
  size = 20,
  variant = 'surface',
  style,
}: {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  color?: string;
  size?: number;
  variant?: 'surface' | 'plain';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.iconButton,
        variant === 'surface' && styles.iconButtonSurface,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Icon name={icon} size={size} color={color} />
    </Pressable>
  );
}

// ---- Chips ----------------------------------------------------------------------

export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  count,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  count?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
    >
      {icon ? <Icon name={icon} size={14} color={selected ? colors.white : colors.textSecondary} /> : null}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
      {count !== undefined ? (
        <View style={[styles.chipCount, selected && styles.chipCountSelected]}>
          <Text style={[styles.chipCountText, selected && styles.chipTextSelected]}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function ChipRow({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.noGrow} // ScrollView defaults to flexGrow: 1 and would eat the screen's spare height
      contentContainerStyle={[styles.chipRow, style]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

// ---- Toggle -----------------------------------------------------------------------

export function Toggle({
  value,
  onChange,
  accessibilityLabel,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}) {
  const { reduced } = useMotion();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value ? 1 : 0, duration: reduced ? 0 : 180, useNativeDriver: false }).start();
  }, [value, anim, reduced]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });
  const bg = anim.interpolate({ inputRange: [0, 1], outputRange: [colors.surfaceHigh, colors.primary] });

  return (
    <Pressable
      onPress={() => !disabled && onChange(!value)}
      hitSlop={hitSlop}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      style={disabled ? styles.disabled : undefined}
    >
      <Animated.View style={[styles.track, { backgroundColor: bg }]}>
        <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
      </Animated.View>
    </Pressable>
  );
}

// ---- Section header -----------------------------------------------------------------

export function SectionHeader({
  title,
  action,
  onAction,
  style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text style={t.micro} accessibilityRole="header">
        {title}
      </Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={hitSlop} accessibilityRole="button">
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---- Avatar -------------------------------------------------------------------------

export function Avatar({ name, emoji, size = 44 }: { name: string; emoji?: string | null; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join('');
  return (
    <Gradient colors={gradients.primary} borderRadius={size / 2} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: emoji ? size * 0.5 : size * 0.38, fontWeight: '800', color: colors.white }}>
        {emoji || initials || '•'}
      </Text>
    </Gradient>
  );
}

// ---- FAB ----------------------------------------------------------------------------

export function Fab({ onPress, accessibilityLabel, icon = 'plus' }: { onPress: () => void; accessibilityLabel: string; icon?: IconName }) {
  // Float above the tab bar, which sits on top of the screen content.
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, spacing.md) + TAB_BAR_HEIGHT + spacing.lg;
  return (
    <View style={[styles.fabWrap, shadow.float, { bottom }]}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={({ pressed }) => pressed && styles.pressed}>
        <Gradient colors={gradients.primary} borderRadius={radius.pill} style={styles.fab}>
          <Icon name={icon} size={26} color={colors.white} strokeWidth={2.4} />
        </Gradient>
      </Pressable>
    </View>
  );
}

// ---- Stat pill ------------------------------------------------------------------------

export function Pill({ label, color = colors.textSecondary, background = colors.surfaceAlt, icon }: { label: string; color?: string; background?: string; icon?: IconName }) {
  return (
    <View style={[styles.pill, { backgroundColor: background }]}>
      {icon ? <Icon name={icon} size={12} color={color} strokeWidth={2.4} /> : null}
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  noGrow: {
    flexGrow: 0,
  },
  disabled: {
    opacity: 0.4,
  },
  iconButton: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonSurface: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: fontSize.caption,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: colors.white,
  },
  chipCount: {
    minWidth: 20,
    paddingHorizontal: 6,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipCountSelected: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  chipCountText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  track: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  sectionAction: {
    color: colors.primary,
    fontSize: fontSize.caption,
    fontWeight: '700',
  },
  fabWrap: {
    position: 'absolute',
    right: 20,
    borderRadius: radius.pill,
  },
  fab: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
