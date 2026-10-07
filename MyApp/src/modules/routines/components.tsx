import React, { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, font, gradients, radius, spacing, type as t } from '../../theme';
import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { ProgressBar } from '../../components/Progress';
import { formatDayMonth, fromDateKey, WEEKDAY_SHORT } from '../../utils/date';
import type { GridCell, Track, TrackGrid } from './routinesApi';

/** "04 Oct – 02 Nov · Day 3 of 30" */
export function periodLabel(track: Track): string {
  const range = `${formatDayMonth(track.start_date)} – ${track.end_date ? formatDayMonth(track.end_date) : 'ongoing'}`;
  if (track.status === 'UPCOMING') return `${range} · Starts soon`;
  if (track.status === 'ENDED') return `${range} · Ended`;
  if (track.day_number && track.total_days) return `${range} · Day ${track.day_number} of ${track.total_days}`;
  return range;
}

/**
 * One category in a list: a monogram medallion, its name and period, and
 * today's progress as a fine gauge underneath.
 */
export function CategoryCard({ track, onPress, style }: { track: Track; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const allDone = track.today_required > 0 && track.today_completed >= track.today_required;
  const progress = track.today_required > 0 ? track.today_completed / track.today_required : 0;
  return (
    <Card onPress={onPress} style={[styles.card, style]} accessibilityLabel={`${track.name}, ${track.today_completed} of ${track.today_required} done today`}>
      <View style={styles.cardRow}>
        <View style={[styles.monogram, allDone && styles.monogramDone]}>
          <Text style={[styles.monogramText, allDone && { color: colors.success }]}>{track.name.trim().charAt(0).toUpperCase() || '•'}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {track.name}
          </Text>
          <Text style={[t.caption, styles.cardMeta]} numberOfLines={1}>
            {periodLabel(track)}
          </Text>
        </View>
        {track.today_required > 0 ? (
          <View style={styles.today}>
            {allDone ? <Icon name="check" size={13} color={colors.success} strokeWidth={2.6} /> : null}
            <Text style={[styles.todayText, allDone && { color: colors.success }]}>
              {track.today_completed}
              <Text style={styles.todayOf}>/{track.today_required}</Text>
            </Text>
          </View>
        ) : null}
        <Icon name="chevron-right" size={17} color={colors.textTertiary} />
      </View>
      {track.today_required > 0 ? (
        <ProgressBar progress={progress} height={3} colorsPair={allDone ? gradients.success : gradients.gold} style={styles.gauge} />
      ) : null}
    </Card>
  );
}

// ---- The category table ---------------------------------------------------------

const NAME_W = 124;
const COL_W = 52;
const ROW_H = 52;

/**
 * Tasks down the side, days across the top, a box in every cell. Only
 * today's boxes can be ticked; past days show what happened, future days are
 * empty. Opens scrolled so today is in view.
 */
export function CategoryTable({
  grid,
  onToggle,
  onTaskPress,
}: {
  grid: TrackGrid;
  onToggle: (row: TrackGrid['rows'][number], isDone: boolean) => void;
  onTaskPress: (row: TrackGrid['rows'][number]) => void;
}) {
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const todayIndex = grid.days.indexOf(grid.today);

  return (
    <View style={styles.table}>
      {/* Fixed first column: task names */}
      <View style={styles.nameCol}>
        <View style={[styles.headerCell, styles.nameCell, styles.bottomLine]}>
          <Text style={t.micro}>Task</Text>
        </View>
        {grid.rows.map((row, i) => (
          <Pressable
            key={row.action_id}
            onPress={() => onTaskPress(row)}
            style={({ pressed }) => [styles.bodyCell, styles.nameCell, i < grid.rows.length - 1 && styles.bottomLine, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`${row.title}. Tap to rename or delete.`}
          >
            <Text style={styles.taskName} numberOfLines={2}>
              {row.title}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Days, scrolling sideways */}
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() => {
          if (todayIndex > 1) scroll.current?.scrollTo({ x: (todayIndex - 1) * COL_W, animated: false });
        }}
      >
        <View>
          <View style={[styles.row, styles.bottomLine]}>
            {grid.days.map((day, di) => {
              const isToday = di === todayIndex;
              const d = fromDateKey(day);
              return (
                <View key={day} style={[styles.headerCell, styles.dayCell, di > 0 && styles.leftLine, isToday && styles.todayCol]}>
                  <Text style={[styles.weekday, isToday && styles.todayText2]}>{isToday ? 'Today' : WEEKDAY_SHORT[d.getDay()]}</Text>
                  <Text style={[styles.dayNum, isToday && styles.todayText2]}>{d.getDate()}</Text>
                </View>
              );
            })}
          </View>
          {grid.rows.map((row, ri) => (
            <View key={row.action_id} style={[styles.row, ri < grid.rows.length - 1 && styles.bottomLine]}>
              {row.cells.map((cell, di) => (
                <View key={grid.days[di]} style={[styles.bodyCell, styles.dayCell, di > 0 && styles.leftLine, di === todayIndex && styles.todayCol]}>
                  <Mark
                    cell={cell}
                    label={`${row.title}, ${grid.days[di]}`}
                    onPress={di === todayIndex && cell !== 'NONE' ? () => onToggle(row, cell === 'DONE') : undefined}
                  />
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const MARK_LABEL: Record<GridCell, string> = {
  DONE: 'done',
  MISSED: 'missed',
  TODO: 'not done yet',
  FUTURE: 'upcoming',
  NONE: 'not scheduled',
};

function Mark({ cell, label, onPress }: { cell: GridCell; label: string; onPress?: () => void }) {
  const box =
    cell === 'DONE' ? (
      <View style={[styles.box, styles.boxDone]}>
        <Icon name="check" size={15} color={colors.onPrimary} strokeWidth={2.8} />
      </View>
    ) : cell === 'MISSED' ? (
      <Icon name="x" size={15} color={colors.danger} strokeWidth={2} />
    ) : cell === 'TODO' ? (
      <View style={[styles.box, styles.boxTodo]} />
    ) : cell === 'FUTURE' ? (
      <View style={[styles.box, styles.boxFuture]} />
    ) : (
      <Text style={styles.none}>–</Text>
    );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={`${label}: ${MARK_LABEL[cell]}`}>
        {box}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: cell === 'DONE' }}
      accessibilityLabel={`${label}: ${MARK_LABEL[cell]}`}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {box}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  card: {
    marginBottom: spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  monogram: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161D36',
    borderWidth: 1,
    borderColor: colors.goldLine,
  },
  monogramDone: {
    backgroundColor: colors.successSoft,
    borderColor: 'rgba(140,211,179,0.35)',
  },
  monogramText: {
    ...font.serif,
    fontSize: 20,
    lineHeight: 23,
    color: colors.goldBright,
  },
  cardTitle: {
    ...font.serif,
    fontSize: 19,
    lineHeight: 22,
    color: colors.text,
  },
  cardMeta: {
    marginTop: 2,
  },
  today: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  todayText: {
    ...font.serif,
    fontSize: 20,
    color: colors.goldBright,
  },
  todayOf: {
    fontSize: 17,
    color: colors.textTertiary,
  },
  gauge: {
    marginTop: spacing.lg,
  },

  table: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldLine,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.glass,
  },
  nameCol: {
    width: NAME_W,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.goldLine,
    backgroundColor: 'rgba(21,27,47,0.9)',
  },
  row: {
    flexDirection: 'row',
  },
  headerCell: {
    height: ROW_H,
    justifyContent: 'center',
  },
  bodyCell: {
    height: ROW_H,
    justifyContent: 'center',
  },
  nameCell: {
    paddingHorizontal: spacing.md,
  },
  dayCell: {
    width: COL_W,
    alignItems: 'center',
  },
  bottomLine: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  leftLine: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
  todayCol: {
    backgroundColor: colors.goldSoft,
  },
  taskName: {
    ...font.semibold,
    color: colors.text,
  },
  weekday: {
    ...font.bold,
    fontSize: 9.5,
    letterSpacing: 1,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  dayNum: {
    ...font.serif,
    fontSize: 16,
    lineHeight: 18,
    color: colors.text,
  },
  todayText2: {
    color: colors.gold,
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxDone: {
    backgroundColor: colors.success,
  },
  boxTodo: {
    borderWidth: 1.5,
    borderColor: colors.gold,
    backgroundColor: 'rgba(5,6,11,0.6)',
  },
  boxFuture: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  none: {
    color: colors.textTertiary,
  },
});
