import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { border, colors, fontSize, radius, spacing } from '../theme';

interface ChecklistRowProps {
  title: string;
  checked: boolean;
  onToggle: () => void;
  onRemove?: () => void;
}

/**
 * A satisfying checkable row: a bold ink-outlined square checkbox that
 * fills in and a strikethrough label when checked — used for both category
 * checklists and task checklists, rather than a plain default list item.
 */
export function ChecklistRow({ title, checked, onToggle, onRemove }: ChecklistRowProps) {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.pressArea}
        onPress={onToggle}
        activeOpacity={0.7}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
      >
        <View style={[styles.checkBox, checked && styles.checkBoxChecked]}>
          {checked ? <Text style={styles.checkMark}>✓</Text> : null}
        </View>
        <Text style={[styles.title, checked && styles.titleChecked]} numberOfLines={2}>
          {title}
        </Text>
      </TouchableOpacity>
      {onRemove ? (
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.remove}>✕</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
  },
  pressArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkBox: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: border.thick,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkBoxChecked: {
    backgroundColor: colors.success,
  },
  checkMark: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '900',
  },
  title: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  titleChecked: {
    color: colors.textFaint,
    textDecorationLine: 'line-through',
  },
  remove: {
    color: colors.danger,
    fontSize: fontSize.md,
    fontWeight: '800',
    paddingHorizontal: spacing.sm,
  },
});
