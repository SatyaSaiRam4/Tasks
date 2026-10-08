import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DatePicker from '@ant-design/react-native/lib/date-picker';
import { colors, font, spacing, type as t } from '../theme';
import { formatClock, formatFullDate, formatDateTime, fromDateKey, toDateKey } from '../utils/date';
import { Chip } from './Controls';
import { Icon, type IconName } from './Icon';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { fieldStyles } from './TextField';

function FieldShell({
  label,
  icon,
  text,
  placeholder,
  onPress,
  onClear,
  chevron = true,
}: {
  label?: string;
  icon: IconName;
  text: string | null;
  placeholder: string;
  onPress?: () => void;
  onClear?: () => void;
  chevron?: boolean;
}) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label ?? placeholder}: ${text ?? 'not set'}`}
        style={({ pressed }) => [styles.field, pressed && styles.fieldPressed]}
      >
        <Icon name={icon} size={18} color={colors.gold} strokeWidth={1.7} />
        <Text style={[styles.value, !text && styles.placeholder]} numberOfLines={1}>
          {text ?? placeholder}
        </Text>
        {text && onClear ? (
          <Pressable onPress={onClear} accessibilityRole="button" accessibilityLabel={`Clear ${label ?? ''}`} hitSlop={10}>
            <Icon name="x" size={16} color={colors.textTertiary} />
          </Pressable>
        ) : chevron ? (
          <Icon name="chevron-down" size={16} color={colors.textTertiary} />
        ) : null}
      </Pressable>
    </View>
  );
}

/** A calendar date (YYYY-MM-DD) via the themed antd picker. */
export function DateField({
  label,
  value,
  onChange,
  placeholder = 'Pick a date',
  minDate,
  maxDate,
  clearable,
}: {
  label?: string;
  value: string | null;
  onChange: (key: string | null) => void;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
  clearable?: boolean;
}) {
  return (
    <DatePicker
      value={value ? fromDateKey(value) : undefined}
      precision="day"
      minDate={minDate ? fromDateKey(minDate) : new Date(2020, 0, 1)}
      maxDate={maxDate ? fromDateKey(maxDate) : new Date(2035, 11, 31)}
      onChange={(d: Date) => onChange(toDateKey(d))}
      title={label}
    >
      <FieldShell
        label={label}
        icon="calendar"
        text={value ? formatFullDate(value) : null}
        placeholder={placeholder}
        onClear={clearable ? () => onChange(null) : undefined}
        chevron={false}
      />
    </DatePicker>
  );
}

/** A date + time (for reminders). */
export function DateTimeField({ label, value, onChange }: { label?: string; value: Date; onChange: (d: Date) => void }) {
  return (
    <DatePicker value={value} precision="minute" minDate={new Date(2020, 0, 1)} maxDate={new Date(2035, 11, 31)} onChange={onChange} title={label}>
      <FieldShell label={label} icon="clock" text={formatDateTime(value.toISOString())} placeholder="Pick a time" />
    </DatePicker>
  );
}

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

/** A time of day ("HH:MM:00") picked from hour/minute/AM-PM chips. */
export function TimeField({
  label,
  value,
  onChange,
  placeholder = 'Any time',
}: {
  label?: string;
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const initial = value ? value.split(':').map(Number) : [8, 0];
  const [hour12, setHour12] = useState(initial[0] % 12 === 0 ? 12 : initial[0] % 12);
  const [minute, setMinute] = useState(initial[1] - (initial[1] % 5));
  const [pm, setPm] = useState(initial[0] >= 12);

  const commit = () => {
    const h24 = (hour12 % 12) + (pm ? 12 : 0);
    onChange(`${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`);
    setOpen(false);
  };

  return (
    <>
      <FieldShell
        label={label}
        icon="clock"
        text={value ? formatClock(value) : null}
        placeholder={placeholder}
        onPress={() => setOpen(true)}
        onClear={() => onChange(null)}
      />
      <Sheet visible={open} onClose={() => setOpen(false)} title="Pick a time">
        <Text style={styles.preview}>
          {hour12}:{String(minute).padStart(2, '0')}
          <Text style={styles.previewMeridiem}> {pm ? 'PM' : 'AM'}</Text>
        </Text>
        <Text style={styles.label}>Hour</Text>
        <View style={styles.grid}>
          {HOURS.map(h => (
            <Chip key={h} label={String(h)} selected={h === hour12} onPress={() => setHour12(h)} />
          ))}
        </View>
        <Text style={styles.label}>Minute</Text>
        <View style={styles.grid}>
          {MINUTES.map(m => (
            <Chip key={m} label={String(m).padStart(2, '0')} selected={m === minute} onPress={() => setMinute(m)} />
          ))}
        </View>
        <View style={[styles.grid, styles.period]}>
          <Chip label="AM" selected={!pm} onPress={() => setPm(false)} />
          <Chip label="PM" selected={pm} onPress={() => setPm(true)} />
        </View>
        <Button label="Set time" onPress={commit} size="lg" style={styles.commit} />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  label: fieldStyles.label,
  field: fieldStyles.field,
  fieldPressed: {
    borderColor: colors.goldLine,
    backgroundColor: colors.goldSoft,
  },
  value: {
    ...font.medium,
    flex: 1,
    color: colors.text,
    fontSize: 14.5,
  },
  placeholder: {
    color: colors.textTertiary,
  },
  preview: {
    ...t.hero,
    textAlign: 'center',
    fontSize: 60,
    lineHeight: 66,
    color: colors.goldBright,
    marginBottom: spacing.lg,
  },
  previewMeridiem: {
    ...font.bold,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  period: {
    justifyContent: 'center',
  },
  commit: {
    marginTop: spacing.sm,
  },
});
