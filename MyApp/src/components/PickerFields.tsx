import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import DatePicker from '@ant-design/react-native/lib/date-picker';
import { colors, font, radius, spacing } from '../theme';
import { formatClock, formatFullDate, formatDateTime, fromDateKey, toDateKey } from '../utils/date';
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
const PERIODS = ['AM', 'PM'];

function parseTime(value: string | null): { hour12: number; minute: number; pm: boolean } {
  const [h, m] = value ? value.split(':').map(Number) : [8, 0];
  return { hour12: h % 12 === 0 ? 12 : h % 12, minute: m, pm: h >= 12 };
}

const ROW = 44;
const VISIBLE = 5;

/** One scroll wheel: rows snap into the highlighted middle slot. */
function Wheel({
  items,
  index,
  onChange,
  label,
}: {
  items: string[];
  index: number;
  onChange: (index: number) => void;
  label: string;
}) {
  const ref = useRef<React.ComponentRef<typeof ScrollView>>(null);
  // Scroll to the starting value once laid out (contentOffset is iOS-only).
  const place = () => ref.current?.scrollTo({ y: index * ROW, animated: false });
  const settle = (y: number) => {
    const i = Math.max(0, Math.min(items.length - 1, Math.round(y / ROW)));
    if (i !== index) onChange(i);
  };
  return (
    <View style={styles.wheel} accessibilityLabel={`${label}: ${items[index]}`}>
      <View pointerEvents="none" style={styles.wheelBand} />
      <ScrollView
        ref={ref}
        onLayout={place}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW}
        decelerationRate="fast"
        nestedScrollEnabled
        contentContainerStyle={styles.wheelContent}
        onMomentumScrollEnd={e => settle(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={e => settle(e.nativeEvent.contentOffset.y)}
      >
        {items.map((item, i) => (
          <Pressable
            key={item}
            onPress={() => {
              ref.current?.scrollTo({ y: i * ROW, animated: true });
              onChange(i);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${label} ${item}`}
            style={styles.wheelRow}
          >
            <Text style={[styles.wheelText, i === index && styles.wheelTextOn]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** A time of day ("HH:MM:00") picked on hour, minute and AM/PM scroll wheels. */
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
        <View style={styles.wheels}>
          <Wheel label="Hour" items={HOURS.map(String)} index={HOURS.indexOf(hour12)} onChange={i => setHour12(HOURS[i])} />
          <Text style={styles.colon}>:</Text>
          <Wheel label="Minute" items={MINUTES.map(m => String(m).padStart(2, '0'))} index={minute} onChange={setMinute} />
          <Wheel label="Period" items={PERIODS} index={pm ? 1 : 0} onChange={i => setPm(i === 1)} />
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
  wheels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  wheel: {
    width: 76,
    height: ROW * VISIBLE,
  },
  wheelBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ROW * 2,
    height: ROW,
    borderRadius: radius.md,
    backgroundColor: colors.goldSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldLine,
  },
  wheelContent: {
    paddingVertical: ROW * 2,
  },
  wheelRow: {
    height: ROW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelText: {
    ...font.medium,
    fontSize: 18,
    color: colors.textTertiary,
  },
  wheelTextOn: {
    ...font.bold,
    fontSize: 22,
    color: colors.text,
  },
  colon: {
    ...font.bold,
    fontSize: 22,
    color: colors.textSecondary,
  },
  commit: {
    marginTop: spacing.sm,
  },
});
