import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { addDays, toDateKey, WEEKDAY_SHORT } from '../utils/date';

export interface DayMark {
  required: number;
  completed: number;
  status: string;
}

const CELL = 52;

/** Horizontally scrolling day tabs with a completion dot under each day. */
export function DateStrip({
  selected,
  today,
  onSelect,
  marks,
  daysBack = 14,
  daysForward = 7,
}: {
  selected: string;
  today: string;
  onSelect: (dateKey: string) => void;
  marks?: Record<string, DayMark>;
  daysBack?: number;
  daysForward?: number;
}) {
  const days = useMemo(() => {
    const base = new Date(`${today}T00:00:00`);
    return Array.from({ length: daysBack + daysForward + 1 }, (_, i) => addDays(base, i - daysBack));
  }, [today, daysBack, daysForward]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.strip}
      contentContainerStyle={styles.content}
      contentOffset={{ x: Math.max(0, (daysBack - 2) * (CELL + spacing.sm)), y: 0 }}
    >
      {days.map(d => {
        const key = toDateKey(d);
        const isSelected = key === selected;
        const isToday = key === today;
        const mark = marks?.[key];
        const dot =
          mark && mark.required > 0
            ? mark.status === 'SUCCESS'
              ? colors.success
              : mark.status === 'FAILED'
                ? colors.danger
                : mark.completed > 0
                  ? colors.streak
                  : colors.textTertiary
            : null;
        return (
          <Pressable
            key={key}
            onPress={() => onSelect(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${isToday ? 'Today, ' : ''}${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()}${mark ? `, ${mark.completed} of ${mark.required} done` : ''}`}
            style={[styles.cell, isSelected && styles.cellSelected, !isSelected && isToday && styles.cellToday]}
          >
            <Text style={[styles.weekday, isSelected && styles.textSelected]}>{WEEKDAY_SHORT[d.getDay()].toUpperCase()}</Text>
            <Text style={[styles.day, isSelected && styles.textSelected]}>{d.getDate()}</Text>
            <View style={[styles.dot, { backgroundColor: dot ?? 'transparent' }, isSelected && dot ? styles.dotSelected : null]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // ScrollView defaults to flexGrow: 1; inside a growing screen that would
  // stretch the day tiles to fill the leftover height.
  strip: {
    flexGrow: 0,
  },
  content: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: 20,
  },
  cell: {
    width: CELL,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cellSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  cellToday: {
    borderColor: colors.primary,
    borderWidth: 1,
  },
  weekday: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 0.6,
  },
  day: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  textSelected: {
    color: colors.white,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden', // keeps it round on Android when the color changes after mount
    marginTop: 5,
  },
  dotSelected: {
    backgroundColor: colors.white,
  },
});
