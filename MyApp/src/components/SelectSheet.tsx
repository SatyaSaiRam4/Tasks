import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Modal from '@ant-design/react-native/lib/modal';
import { AppButton } from './AppButton';
import { border, colors, fontSize, radius, spacing } from '../theme';

export interface SelectOption<T extends string> {
  label: string;
  value: T;
  color?: string;
}

interface SelectSheetProps<T extends string> {
  visible: boolean;
  title: string;
  options: SelectOption<T>[];
  selectedValue?: T | null;
  onSelect: (value: T) => void;
  onClose: () => void;
}

/**
 * A bottom-sheet single-select list, built on antd-mobile-rn's popup Modal.
 * Used for the priority / category / task-type pickers instead of the
 * built-in Picker component, for a simpler, fully custom-styled list.
 */
export function SelectSheet<T extends string>({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}: SelectSheetProps<T>) {
  return (
    <Modal visible={visible} transparent animationType="slide-up" popup maskClosable onClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>{title}</Text>
        <ScrollView style={styles.list} bounces={false}>
          {options.map(option => {
            const isSelected = option.value === selectedValue;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.row, isSelected && styles.rowSelected]}
                onPress={() => {
                  onSelect(option.value);
                  onClose();
                }}
                activeOpacity={0.7}
              >
                {option.color ? <View style={[styles.dot, { backgroundColor: option.color }]} /> : null}
                <Text style={[styles.rowLabel, isSelected && styles.rowLabelSelected]}>{option.label}</Text>
                {isSelected ? <Text style={styles.check}>✓</Text> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <AppButton label="Cancel" variant="secondary" onPress={onClose} style={styles.cancelButton} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: border.thick,
    borderColor: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    maxHeight: 460,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    alignSelf: 'center',
    marginBottom: spacing.md,
    opacity: 0.25,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  list: {
    maxHeight: 320,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  rowSelected: {
    backgroundColor: colors.accentYellowSoft,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    borderWidth: border.thin,
    borderColor: colors.ink,
    marginRight: spacing.sm,
  },
  rowLabel: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  rowLabelSelected: {
    color: colors.ink,
    fontWeight: '800',
  },
  check: {
    color: colors.primary,
    fontWeight: '900',
    fontSize: fontSize.md,
  },
  cancelButton: {
    marginTop: spacing.md,
  },
});
