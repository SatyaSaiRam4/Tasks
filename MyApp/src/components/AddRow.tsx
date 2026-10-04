import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Input from '@ant-design/react-native/lib/input';
import { AppButton } from './AppButton';
import { border, colors, fontSize, radius, spacing } from '../theme';

interface AddRowProps {
  placeholder: string;
  onAdd: (value: string) => void;
  disabled?: boolean;
}

/** Inline "add item" row: a text field plus an add button, used by checklists. */
export function AddRow({ placeholder, onAdd, disabled }: AddRowProps) {
  const [value, setValue] = useState('');

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue('');
  };

  return (
    <View style={styles.row}>
      <View style={styles.inputWrap}>
        <Input
          value={value}
          onChangeText={setValue}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          onSubmitEditing={submit}
          returnKeyType="done"
          style={styles.input}
          inputStyle={styles.inputText}
        />
      </View>
      <AppButton label="Add" size="sm" onPress={submit} disabled={disabled || !value.trim()} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: border.thin,
    borderColor: colors.ink,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
  },
  input: {
    height: 42,
  },
  inputText: {
    fontSize: fontSize.md,
    color: colors.text,
  },
});
