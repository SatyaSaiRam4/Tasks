import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, fontSize, gradients, hitSlop, radius, shadow, spacing, TAB_BAR_HEIGHT, TOUCH_TARGET, type as t } from '../theme';
import { useMotion } from '../hooks/useMotion';
import { useLayout } from '../hooks/useLayout';
import { easeOut, usePressScale } from '../animations';
import { Glow, Gradient } from './Gradient';
import { Icon, type IconName } from './Icon';

// ---- IconButton ---------------------------------------------------------------

/** A round glass button with a hairline champagne edge. */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  color = colors.text,
  size = 19,
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
  const press = usePressScale(0.9);
  return (
    <Animated.View style={{ transform: [{ scale: press.scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [
          styles.iconButton,
          variant === 'surface' && styles.iconButtonSurface,
          pressed && variant === 'surface' && styles.iconButtonPressed,
          style,
        ]}
      >
        <Icon name={icon} size={size} color={color} strokeWidth={1.8} />
      </Pressable>
    </Animated.View>
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
      {icon ? <Icon name={icon} size={14} color={selected ? colors.onPrimary : colors.textSecondary} /> : null}
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

// ---- Segmented ---------------------------------------------------------------------

/** A glass segmented control with a champagne pill that glides to the selected option. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { reduced } = useMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex(o => o.value === value));
  const x = useRef(new Animated.Value(index)).current;
  useEffect(() => {
    Animated.timing(x, { toValue: index, duration: reduced ? 0 : 380, easing: easeOut, useNativeDriver: true }).start();
  }, [index, reduced, x]);
  const segment = width ? (width - 8) / options.length : 0;

  return (
    <View style={[styles.segmented, style]} onLayout={e => setWidth(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      {segment ? (
        <Animated.View
          style={[styles.segmentPill, { width: segment, transform: [{ translateX: Animated.multiply(x, segment) }] }]}
        >
          <Gradient colors={gradients.primary} direction="horizontal" borderRadius={radius.pill} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
      {options.map(o => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={styles.segment}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextOn]}>{o.label}</Text>
            {o.count !== undefined ? (
              <Text style={[styles.segmentCount, selected && styles.segmentCountOn]}>{o.count}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
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
    Animated.timing(anim, { toValue: value ? 1 : 0, duration: reduced ? 0 : 240, easing: easeOut, useNativeDriver: false }).start();
  }, [value, anim, reduced]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [3, 23] });
  const bg = anim.interpolate({ inputRange: [0, 1], outputRange: [colors.surfaceHigh, colors.primary] });
  const thumb = anim.interpolate({ inputRange: [0, 1], outputRange: [colors.textSecondary, colors.onPrimary] });

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
        <Animated.View style={[styles.thumb, { backgroundColor: thumb, transform: [{ translateX }] }]} />
      </Animated.View>
    </Pressable>
  );
}

// ---- Section header -----------------------------------------------------------------

/** An editorial section label: a champagne rule, spaced caps, optional action link. */
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
      <View style={styles.sectionLeft}>
        <View style={styles.sectionRule} />
        <Text style={t.micro} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={hitSlop} accessibilityRole="button" style={styles.sectionActionWrap}>
          <Text style={styles.sectionAction}>{action}</Text>
          <Icon name="arrow-right" size={13} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** A hairline that fades out at both ends; separates editorial blocks. */
export function GoldRule({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.rule, style]}>
      <Gradient colors={['rgba(217,188,130,0)', 'rgba(217,188,130,0.4)']} direction="horizontal" style={styles.flex} />
      <Gradient colors={['rgba(217,188,130,0.4)', 'rgba(217,188,130,0)']} direction="horizontal" style={styles.flex} />
    </View>
  );
}

// ---- Avatar -------------------------------------------------------------------------

/** Serif initials (or an emoji) on midnight, inside a thin champagne ring. */
export function Avatar({ name, emoji, size = 44 }: { name: string; emoji?: string | null; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join('');
  const ring = Math.max(1.5, size * 0.035);
  return (
    <Gradient colors={gradients.gold} borderRadius={size / 2} style={{ width: size, height: size, padding: ring }}>
      <Gradient colors={gradients.moonlight} borderRadius={size / 2} style={styles.avatarInner}>
        <Text
          style={{
            ...(emoji ? font.regular : font.serif),
            fontSize: emoji ? size * 0.46 : size * 0.42,
            color: colors.goldBright,
            includeFontPadding: false,
          }}
        >
          {emoji || initials || '•'}
        </Text>
      </Gradient>
    </Gradient>
  );
}

// ---- FAB ----------------------------------------------------------------------------

/** The floating add button: a champagne orb with a soft halo, above the tab bar. */
export function Fab({ onPress, accessibilityLabel, icon = 'plus' }: { onPress: () => void; accessibilityLabel: string; icon?: IconName }) {
  // Float above the tab bar, which sits on top of the screen content.
  const insets = useSafeAreaInsets();
  const { gutter } = useLayout();
  const press = usePressScale(0.92);
  const bottom = Math.max(insets.bottom, spacing.md) + TAB_BAR_HEIGHT + spacing.lg;
  return (
    <Animated.View style={[styles.fabWrap, { bottom, right: gutter, transform: [{ scale: press.scale }] }]}>
      <Glow color={colors.primary} size={120} intensity={0.35} style={styles.fabGlow} />
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={shadow.float}
      >
        <Gradient colors={gradients.primary} borderRadius={radius.pill} style={styles.fab}>
          <Icon name={icon} size={26} color={colors.onPrimary} strokeWidth={2.2} />
        </Gradient>
      </Pressable>
    </Animated.View>
  );
}

// ---- Stat pill ------------------------------------------------------------------------

export function Pill({
  label,
  color = colors.textSecondary,
  background = colors.surfaceAlt,
  icon,
  style,
}: {
  label: string;
  color?: string;
  background?: string;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: background }, style]}>
      {icon ? <Icon name={icon} size={12} color={color} strokeWidth={2.2} /> : null}
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
    borderRadius: TOUCH_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonSurface: {
    backgroundColor: colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  iconButtonPressed: {
    backgroundColor: colors.surfaceHigh,
  },
  chipRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...font.semibold,
    color: colors.textSecondary,
    fontSize: fontSize.caption,
  },
  chipTextSelected: {
    color: colors.onPrimary,
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
    backgroundColor: 'rgba(10,11,16,0.16)',
  },
  chipCountText: {
    ...font.bold,
    color: colors.textSecondary,
    fontSize: 11,
  },
  segmented: {
    flexDirection: 'row',
    padding: 4,
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  segmentPill: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segmentText: {
    ...font.semibold,
    fontSize: 14,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  segmentTextOn: {
    color: colors.onPrimary,
  },
  segmentCount: {
    ...font.serif,
    fontSize: 14,
    color: colors.textTertiary,
  },
  segmentCountOn: {
    color: 'rgba(10,11,16,0.6)',
  },
  track: {
    width: 50,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  thumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xxxl,
    marginBottom: spacing.lg,
  },
  sectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionRule: {
    width: 18,
    height: 1,
    backgroundColor: colors.goldLine,
  },
  sectionActionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionAction: {
    ...font.bold,
    color: colors.primary,
    fontSize: 12.5,
    letterSpacing: 0.4,
  },
  rule: {
    flexDirection: 'row',
    height: StyleSheet.hairlineWidth * 2,
    marginVertical: spacing.xl,
  },
  avatarInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabGlow: {
    position: 'absolute',
  },
  fab: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pillText: {
    ...font.bold,
    fontSize: 11,
    letterSpacing: 0.4,
  },
});
