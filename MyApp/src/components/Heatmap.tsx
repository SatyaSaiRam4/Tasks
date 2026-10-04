import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type as t } from '../theme';

export interface HeatmapDay {
  date: string; // YYYY-MM-DD
  status: string; // SUCCESS | FAILED | NO_ACTIONS | PENDING | UNTRACKED | FUTURE
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function cellColor(status: string): string {
  switch (status) {
    case 'SUCCESS':
      return colors.success;
    case 'FAILED':
      return colors.danger;
    case 'PENDING':
      return colors.primary;
    case 'NO_ACTIONS':
      return colors.surfaceHigh;
    default:
      return colors.surfaceAlt;
  }
}

/**
 * A contribution-graph style consistency calendar: one column per week,
 * Monday at the top. Colors are paired with a legend and accessibility
 * labels so status never depends on color alone.
 */
export function Heatmap({ days, cell = 14, legend = true }: { days: HeatmapDay[]; cell?: number; legend?: boolean }) {
  const weeks = useMemo(() => {
    if (!days.length) return [] as (HeatmapDay | null)[][];
    const first = new Date(`${days[0].date}T00:00:00`);
    const lead = (first.getDay() + 6) % 7; // Monday = 0
    const cells: (HeatmapDay | null)[] = [...Array(lead).fill(null), ...days];
    const out: (HeatmapDay | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      const week = cells.slice(i, i + 7);
      while (week.length < 7) week.push(null);
      out.push(week);
    }
    return out;
  }, [days]);

  const success = days.filter(d => d.status === 'SUCCESS').length;
  const failed = days.filter(d => d.status === 'FAILED').length;
  const gap = 4;

  return (
    <View accessibilityLabel={`Consistency calendar: ${success} successful days, ${failed} missed days`}>
      <View style={styles.row}>
        <View style={{ marginRight: gap, marginTop: 18 }}>
          {WEEKDAYS.map((d, i) => (
            <Text key={i} style={[styles.weekday, { height: cell, marginBottom: gap, lineHeight: cell }]}>
              {i % 2 === 0 ? d : ''}
            </Text>
          ))}
        </View>
        <View style={styles.row}>
          {weeks.map((week, wi) => {
            const firstDay = week.find(Boolean);
            const showMonth = firstDay && (wi === 0 || new Date(`${firstDay.date}T00:00:00`).getDate() <= 7);
            return (
              // Fixed to the cell width: the month label may overflow into the
              // next columns, but must not widen this one.
              <View key={wi} style={{ width: cell, marginRight: gap }}>
                <Text style={styles.month} numberOfLines={1}>
                  {showMonth && firstDay ? MONTHS[new Date(`${firstDay.date}T00:00:00`).getMonth()] : ''}
                </Text>
                {week.map((day, di) => (
                  <View
                    key={di}
                    style={{
                      width: cell,
                      height: cell,
                      marginBottom: gap,
                      borderRadius: 4,
                      backgroundColor: day ? cellColor(day.status) : 'transparent',
                      opacity: day && day.status === 'FUTURE' ? 0.35 : 1,
                    }}
                  />
                ))}
              </View>
            );
          })}
        </View>
      </View>
      {legend ? <HeatmapLegend /> : null}
    </View>
  );
}

/** The color key. Render it separately when the calendar itself scrolls. */
export function HeatmapLegend() {
  return (
    <View style={styles.legend}>
      <Legend color={colors.success} label="Complete" />
      <Legend color={colors.danger} label="Missed" />
      <Legend color={colors.surfaceHigh} label="Rest day" />
      <Legend color={colors.primary} label="Today" />
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  weekday: {
    ...t.micro,
    fontSize: 9,
    width: 12,
  },
  month: {
    ...t.micro,
    fontSize: 9,
    height: 14,
    marginBottom: 4,
    width: 30,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
});
