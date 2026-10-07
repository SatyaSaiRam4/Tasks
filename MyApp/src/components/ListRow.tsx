import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing, type as t } from '../theme';
import { Icon, type IconName } from './Icon';

/** A settings-style row: icon medallion, title/subtitle, and a chevron, value, or custom control. */
export function ListRow({
  icon,
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
        <View style={[styles.iconWrap, destructive && styles.iconDanger]}>
          <Icon name={icon} size={17} color={destructive ? colors.danger : iconColor} strokeWidth={1.8} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text style={[t.bodyStrong, destructive && { color: colors.danger }]}>{title}</Text>
        {subtitle ? <Text style={[t.caption, styles.subtitle]}>{subtitle}</Text> : null}
      </View>
      {value ? (
<Text style={styles.value}>{value}</Text>
      ) : null}
      {right}
      {onPress && !right ? <Icon name="chevron-right" size={17} color={colors.textTertiary} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

/** Groups ListRows into one glass pane with a warm hairline edge. */
export function ListGroup({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <View style={styles.sheen} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.glass,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: '18%',
    right: '18%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(241,221,175,0.3)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    paddingVertical: spacing.md,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(217,188,130,0.22)',
  },
  iconDanger: {
    backgroundColor: colors.dangerSoft,
    borderColor: 'rgba(236,135,150,0.25)',
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
  },
  pressed: {
    opacity: 0.6,
  },
});
