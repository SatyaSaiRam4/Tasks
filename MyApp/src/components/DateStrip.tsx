import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, font, gradients, radius, spacing } from '../theme';
import { useLayout } from '../hooks/useLayout';
import { Gradient } from './Gradient';
import { addDays, fromDateKey, toDateKey, WEEKDAY_SHORT } from '../utils/date';

export interface DayMark {
  required: number;
  completed: number;
  status: string;
}

const CELL = 54;
const STEP = CELL + spacing.sm;

/**
 * Horizontally scrolling day tabs with a completion dot under each day. The
 * selected day always scrolls into view (near the start, one day before it
 * showing), also when it is picked from a calendar, and the strip grows to
 * include a day picked outside its range.
 */
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
  const { gutter } = useLayout();
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const days = useMemo(() => {
    const base = fromDateKey(today);
    const picked = fromDateKey(selected);
    const offset = Math.round((picked.getTime() - base.getTime()) / 86400000);
    const back = Math.max(daysBack, -offset + 3);
    const forward = Math.max(daysForward, offset + 7);
    return Array.from({ length: back + forward + 1 }, (_, i) => addDays(base, i - back));
  }, [today, selected, daysBack, daysForward]);
  const selectedIndex = days.findIndex(d => toDateKey(d) === selected);
  const startX = Math.max(0, (selectedIndex - 1) * STEP);

  // Bring the selected day to the front whenever it changes.
  useEffect(() => {
    const id = setTimeout(() => scroller.current?.scrollTo({ x: startX, animated: true }), 0);
    return () => clearTimeout(id);
  }, [startX]);

  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.strip}
      contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}
      contentOffset={{ x: startX, y: 0 }}
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
            {isSelected ? <Gradient colors={gradients.primary} direction="diagonal" borderRadius={radius.pill} style={StyleSheet.absoluteFill} /> : null}
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
  },
  cell: {
    width: CELL,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.glassStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cellSelected: {
    borderColor: 'rgba(255,255,255,0.45)',
  },
  cellToday: {
    borderColor: colors.goldLine,
    borderWidth: 1,
  },
  weekday: {
    ...font.bold,
    fontSize: 9.5,
    color: colors.textTertiary,
    letterSpacing: 1.4,
  },
  day: {
    ...font.serif,
    fontSize: 23,
    lineHeight: 26,
    color: colors.text,
    marginTop: 2,
  },
  textSelected: {
    color: colors.onPrimary,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden', // keeps it round on Android when the color changes after mount
    marginTop: 5,
  },
  dotSelected: {
    backgroundColor: colors.onPrimary,
  },
});
