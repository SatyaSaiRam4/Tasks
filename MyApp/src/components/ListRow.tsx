import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing, type as t } from '../theme';
import { Medallion } from './Controls';
import { Sheen } from './Gradient';
import { Icon, type IconName } from './Icon';

/** A settings-style row: icon medallion, title/subtitle, and a chevron, value, or custom control. */
export function ListRow({
  icon,
  leading,
  iconColor = colors.gold,
  title,
  subtitle,
  value,
  right,
  onPress,
  destructive,
  last,
}: {
  icon?: IconName;
  /** Any picture in place of the icon medallion, e.g. a RealIcon. */
  leading?: React.ReactNode;
  iconColor?: string;
  title: string;
  subtitle?: string;
  value?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  last?: boolean;
}) {
  const content = (
    <View style={[styles.row, !last && styles.divider]}>
      {leading}
      {!leading && icon ? <Medallion icon={icon} size={38} color={destructive ? colors.danger : iconColor} /> : null}
      <View style={styles.text}>
        <Text style={[t.bodyStrong, destructive && { color: colors.danger }]}>{title}</Text>
        {subtitle ? <Text style={[t.caption, styles.subtitle]}>{subtitle}</Text> : null}
      </View>
      {value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {right}
      {onPress && !right ? <Icon name="chevron-right" size={17} color={colors.textTertiary} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      android_ripple={{ color: colors.goldSoft }}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {content}
    </Pressable>
  );
}

/** Groups ListRows into one pane with a fine edge. */
export function ListGroup({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Sheen />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 2,
    minHeight: 66,
    paddingVertical: spacing.md,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  text: {
    flex: 1,
  },
  subtitle: {
    marginTop: 2,
  },
  value: {
    ...font.medium,
    color: colors.textSecondary,
    fontSize: 14,
    maxWidth: '45%',
  },
  pressed: {
    opacity: 0.6,
  },
});
