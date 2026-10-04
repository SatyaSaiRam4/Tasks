import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { border, colors, fontSize, radius, spacing } from '../theme';
import { isSameDay } from '../utils/date';

const WEEKDAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const CELL_WIDTH = 56;

export interface DayCompletion {
  total: number;
  done: number;
}

interface DateStripProps {
  selectedDate: Date;
  onSelect: (date: Date) => void;
  /** How many days before/after today to show. */
  daysPast?: number;
  daysFuture?: number;
  /** Optional per-day task completion, keyed by yyyy-mm-dd, to show a small progress dot. */
  completionByDate?: Record<string, DayCompletion>;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * A horizontal scrollable strip of day tabs — "on the top as like tabs" from
 * the category flow, letting the user jump to today or look back at any
 * previous day's checklist completion at a glance (a filled dot = all done,
 * a half dot = partially done).
 */
export function DateStrip({ selectedDate, onSelect, daysPast = 14, daysFuture = 7, completionByDate }: DateStripProps) {
  const today = useMemo(() => new Date(), []);

  const days = useMemo(() => {
    const list: Date[] = [];
    for (let i = -daysPast; i <= daysFuture; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      list.push(d);
    }
    return list;
  }, [today, daysPast, daysFuture]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      contentOffset={{ x: daysPast * (CELL_WIDTH + spacing.sm), y: 0 }}
    >
      {days.map(day => {
        const isSelected = isSameDay(day, selectedDate);
        const isToday = isSameDay(day, today);
        const completion = completionByDate?.[dateKey(day)];

        return (
          <TouchableOpacity
            key={day.toISOString()}
            style={[styles.cell, isSelected && styles.cellSelected, !isSelected && isToday && styles.cellToday]}
            onPress={() => onSelect(day)}
            activeOpacity={0.8}
          >
            <Text style={[styles.weekday, isSelected && styles.textSelected]}>{WEEKDAY[day.getDay()]}</Text>
            <Text style={[styles.dayNumber, isSelected && styles.textSelected]}>{day.getDate()}</Text>
            {completion && completion.total > 0 ? (
              <View
                style={[
                  styles.dot,
                  completion.done >= completion.total ? styles.dotDone : styles.dotPartial,
                  isSelected && styles.dotSelected,
                ]}
              />
            ) : (
              <View style={styles.dotSpacer} />
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  cell: {
    width: CELL_WIDTH,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: radius.md,
    borderWidth: border.thin,
    borderColor: colors.ink,
    backgroundColor: colors.surface,
  },
  cellSelected: {
    backgroundColor: colors.primary,
    borderWidth: border.thick,
  },
  cellToday: {
    borderColor: colors.accentBlue,
    borderWidth: border.thick,
  },
  weekday: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.4,
  },
  dayNumber: {
    fontSize: fontSize.lg,
    fontWeight: '900',
    color: colors.ink,
    marginTop: 2,
  },
  textSelected: {
    color: colors.white,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    marginTop: 4,
  },
  dotSpacer: {
    width: 6,
    height: 6,
    marginTop: 4,
  },
  dotDone: {
    backgroundColor: colors.success,
  },
  dotPartial: {
    backgroundColor: colors.accentOrange,
  },
  dotSelected: {
    backgroundColor: colors.white,
  },
});
