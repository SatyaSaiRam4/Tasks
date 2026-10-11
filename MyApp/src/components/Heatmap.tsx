import React, { useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing, type as t, withAlpha } from '../theme';

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
      return colors.gold;
    case 'NO_ACTIONS':
      return colors.surfaceHigh;
    default:
      return withAlpha(colors.gold, 0.08);
  }
}

/**
 * A contribution-graph style consistency calendar: one column per week,
 * Monday at the top. Colors are paired with a legend and accessibility
 * labels so status never depends on color alone. With `scrollable`, only
 * the weeks scroll sideways (starting at today); the weekday labels stay put.
 */
export function Heatmap({
  days,
  cell = 14,
  legend = true,
  scrollable = false,
}: {
  days: HeatmapDay[];
  cell?: number;
  legend?: boolean;
  scrollable?: boolean;
}) {
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
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
              {d}
            </Text>
          ))}
        </View>
        <Weeks scrollable={scrollable} scroller={scroller}>
          {weeks.map((week, wi) => {
            const firstDay = week.find(Boolean);
            const showMonth = firstDay && (wi === 0 || new Date(`${firstDay.date}T00:00:00`).getDate() <= 7);
            return (
              // Fixed to the cell width: the month label may overflow into the
              // next columns, but must not widen this one.
              <View key={wi} style={{ width: cell, marginRight: gap }}>
                <Text style={styles.month}>
                  {showMonth && firstDay ? MONTHS[new Date(`${firstDay.date}T00:00:00`).getMonth()] : ''}
                </Text>
                {week.map((day, di) => (
                  <View
                    key={di}
                    style={{
                      width: cell,
                      height: cell,
                      marginBottom: gap,
                      borderRadius: cell * 0.32,
                      backgroundColor: day ? cellColor(day.status) : 'transparent',
                      opacity: day && day.status === 'FUTURE' ? 0.35 : 1,
                    }}
                  />
                ))}
              </View>
            );
          })}
        </Weeks>
      </View>
      {legend ? <HeatmapLegend /> : null}
    </View>
  );
}

/** The week columns: a plain row, or a sideways scroller that opens on the newest weeks. */
function Weeks({
  scrollable,
  scroller,
  children,
}: {
  scrollable: boolean;
  scroller: React.RefObject<React.ComponentRef<typeof ScrollView> | null>;
  children: React.ReactNode;
}) {
  if (!scrollable) return <View style={styles.row}>{children}</View>;
  return (
    <ScrollView
      ref={scroller}
      horizontal
      style={styles.flex}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
    >
      {children}
    </ScrollView>
  );
}

/** The color key. Render it separately when the calendar itself scrolls. */
export function HeatmapLegend() {
  return (
    <View style={styles.legend}>
      <Legend color={colors.success} label="Complete" />
      <Legend color={colors.danger} label="Missed" />
      <Legend color={colors.surfaceHigh} label="Rest day" />
      <Legend color={colors.gold} label="Today" />
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
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
  },
  weekday: {
    ...t.micro,
    fontSize: 9,
    letterSpacing: 0,
    width: 14,
    color: colors.textTertiary,
  },
  month: {
    ...t.micro,
    fontSize: 9,
    letterSpacing: 0.6,
    height: 14,
    marginBottom: 4,
    width: 40,
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
    ...font.medium,
    color: colors.textSecondary,
    fontSize: 12,
  },
});
