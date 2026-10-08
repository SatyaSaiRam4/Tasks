import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import DatePicker from '@ant-design/react-native/lib/date-picker';
import { colors, font, radius, spacing, type as t } from '../theme';
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
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function parseTime(value: string | null): { hour12: number; minute: number; pm: boolean } {
  const [h, m] = value ? value.split(':').map(Number) : [8, 0];
  return { hour12: h % 12 === 0 ? 12 : h % 12, minute: m, pm: h >= 12 };
}

/** A time of day ("HH:MM:00") picked from hour, any minute, and AM/PM. */
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
  const [hour12, setHour12] = useState(() => parseTime(value).hour12);
  const [minute, setMinute] = useState(() => parseTime(value).minute);
  const [pm, setPm] = useState(() => parseTime(value).pm);

  // Start from the field's current value every time the picker opens (the
  // value can change after mount, e.g. when an existing reminder loads).
  const openPicker = () => {
    const t = parseTime(value);
    setHour12(t.hour12);
    setMinute(t.minute);
    setPm(t.pm);
    setOpen(true);
  };

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
        onPress={openPicker}
        onClear={() => onChange(null)}
      />
      <Sheet visible={open} onClose={() => setOpen(false)} title="Pick a time">
        <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={styles.scroll}>
          <Text style={styles.preview} accessibilityLiveRegion="polite">
            {hour12}:{String(minute).padStart(2, '0')}
            <Text style={styles.previewMeridiem}> {pm ? 'PM' : 'AM'}</Text>
          </Text>
          <View style={[styles.grid, styles.period]}>
            <Chip label="AM" selected={!pm} onPress={() => setPm(false)} />
            <Chip label="PM" selected={pm} onPress={() => setPm(true)} />
          </View>
          <Text style={styles.label}>Hour</Text>
          <View style={styles.grid}>
            {HOURS.map(h => (
              <Chip key={h} label={String(h)} selected={h === hour12} onPress={() => setHour12(h)} />
            ))}
          </View>
          <Text style={styles.label}>Minute</Text>
          <View style={styles.minutes}>
            {MINUTES.map(m => {
              const selected = m === minute;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMinute(m)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${m} minutes`}
                  style={({ pressed }) => [styles.minute, m % 5 === 0 && styles.minuteMajor, selected && styles.minuteOn, pressed && styles.minutePressed]}
                >
                  <Text style={[styles.minuteText, m % 5 === 0 && styles.minuteTextMajor, selected && styles.minuteTextOn]}>
                    {String(m).padStart(2, '0')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Button label="Set time" onPress={commit} size="lg" style={styles.commit} />
        </ScrollView>
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
  scroll: {
    flexGrow: 0,
  },
  minutes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.lg,
  },
  minute: {
    width: '8.4%',
    minWidth: 28,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.glass,
  },
  minuteMajor: {
    backgroundColor: colors.glassStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  minuteOn: {
    backgroundColor: colors.primaryFill,
    borderColor: colors.primaryFill,
  },
  minutePressed: {
    opacity: 0.7,
  },
  minuteText: {
    ...font.medium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  minuteTextMajor: {
    ...font.bold,
    color: colors.text,
  },
  minuteTextOn: {
    ...font.bold,
    color: colors.onPrimary,
  },
  commit: {
    marginTop: spacing.sm,
  },
});
