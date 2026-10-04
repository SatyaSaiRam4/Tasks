import React, { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fontSize, hitSlop, radius, spacing, type as t } from '../theme';
import { Icon, type IconName } from './Icon';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string | null;
  hint?: string;
  icon?: IconName;
  secureToggle?: boolean;
  multiline?: boolean;
  minHeight?: number;
}

/** Labeled input with focus ring, inline error, optional icon and show/hide for secrets. */
export const TextField = forwardRef<React.ComponentRef<typeof TextInput>, TextFieldProps>(function TextField(
  { label, error, hint, icon, secureToggle, secureTextEntry, multiline, minHeight, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          multiline && { alignItems: 'flex-start', paddingVertical: spacing.md, minHeight: minHeight ?? 120 },
          focused && styles.focused,
          Boolean(error) && styles.errored,
        ]}
      >
        {icon ? <Icon name={icon} size={18} color={focused ? colors.primary : colors.textTertiary} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          secureTextEntry={secureToggle ? hidden : secureTextEntry}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          accessibilityLabel={label ?? rest.placeholder}
          {...rest}
          onFocus={e => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={e => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, multiline && styles.multiline]}
        />
        {secureToggle ? (
          <Pressable
            onPress={() => setHidden(h => !h)}
            hitSlop={hitSlop}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show' : 'Hide'}
          >
            <Icon name={hidden ? 'eye' : 'eye-off'} size={18} color={colors.textTertiary} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  label: {
    ...t.micro,
    marginBottom: spacing.sm,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  focused: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
  },
  errored: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.body,
    paddingVertical: 0,
  },
  multiline: {
    lineHeight: 22,
    minHeight: 90,
  },
  error: {
    marginTop: spacing.xs + 2,
    color: colors.danger,
    fontSize: fontSize.caption,
    fontWeight: '500',
  },
  hint: {
    marginTop: spacing.xs + 2,
    color: colors.textTertiary,
    fontSize: fontSize.caption,
  },
});
