import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Input from '@ant-design/react-native/lib/input';
import type { InputProps } from '@ant-design/react-native/lib/input/PropsType';
import { border, colors, fontSize, radius, spacing, typography } from '../theme';

interface LabeledInputProps extends InputProps {
  label: string;
  style?: ViewStyle;
}

/** A labeled text field with Rememberly's thick ink-outlined styling, wrapping antd-mobile-rn's Input. */
export function LabeledInput({ label, style, ...inputProps }: LabeledInputProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <Input
          style={styles.input}
          inputStyle={styles.inputText}
          placeholderTextColor={colors.textFaint}
          {...inputProps}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.eyebrow,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  inputWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: border.thick,
    borderColor: colors.ink,
    paddingHorizontal: spacing.md,
  },
  input: {
    height: 48,
  },
  inputText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
});
