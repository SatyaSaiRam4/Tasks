import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type as t } from '../theme';
import { Icon, type IconName } from './Icon';

/** A settings-style row: icon, title/subtitle, and a chevron, value, or custom control. */
export function ListRow({
  icon,
  iconColor = colors.primary,
  title,
  subtitle,
  value,
  right,
  onPress,
  destructive,
  last,
}: {
  icon?: IconName;
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
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: destructive ? colors.dangerSoft : colors.surfaceAlt }]}>
          <Icon name={icon} size={18} color={destructive ? colors.danger : iconColor} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text style={[t.bodyStrong, destructive && { color: colors.danger }]}>{title}</Text>
        {subtitle ? <Text style={[t.caption, styles.subtitle]}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.value}>{value}</Text> : null}
      {right}
      {onPress && !right ? <Icon name="chevron-right" size={18} color={colors.textTertiary} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

/** Groups ListRows into one rounded surface. */
export function ListGroup({ children }: { children: React.ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingVertical: spacing.md,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
  },
  subtitle: {
    marginTop: 2,
  },
  value: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.6,
  },
});
