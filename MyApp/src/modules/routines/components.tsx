import React, { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, font, gradients, radius, spacing, TRACK_COLORS, type as t, withAlpha } from '../../theme';
import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { RealIcon } from '../../components/RealIcon';
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

/** A stable jewel color for a category: its own color, or one picked from its name. */
export function categoryColor(seed: string, explicit?: string | null): string {
  if (explicit && /^#[0-9a-f]{6}$/i.test(explicit)) return explicit;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 9973;
  return TRACK_COLORS[h % TRACK_COLORS.length];
}

/** A category's initial in a jewel-toned double ring. */
export function Monogram({ name, color, size = 46, done = false }: { name: string; color: string; size?: number; done?: boolean }) {
  const ring = done ? colors.success : color;
  return (
    <View
      style={[
        styles.monogram,
        { width: size, height: size, borderRadius: size / 2, borderColor: ring, backgroundColor: withAlpha(ring, colors.isDark ? 0.08 : 0.1) },
      ]}
    >
      <View style={[styles.monogramInner, { borderRadius: size / 2, borderColor: withAlpha(ring, 0.3) }]} />
      {done ? (
        <RealIcon name="check" size={size * 0.62} />
      ) : (
        <Text style={[styles.monogramText, { fontSize: size * 0.42, color: colors.isDark ? color : colors.text }]}>
          {name.trim().charAt(0).toUpperCase() || '•'}
        </Text>
      )}
    </View>
  );
}

/** One line about a category today: progress, or why nothing is due. */
function todayLine(track: Track): string {
  if (track.status === 'UPCOMING') return 'Starts soon';
  if (track.status === 'ENDED' || track.status === 'ARCHIVED') return 'Ended';
  if (track.today_required === 0) return track.action_count ? 'Nothing due today' : 'No tasks yet';
  return `${Math.min(track.today_completed, track.today_required)} of ${track.today_required} done today`;
}

/** One category as a compact row: its initial, name, today's progress and a fine gauge. */
export function CategoryCard({ track, onPress, style }: { track: Track; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const allDone = track.today_required > 0 && track.today_completed >= track.today_required;
  const progress = track.today_required > 0 ? track.today_completed / track.today_required : 0;
  const color = categoryColor(track.name, track.color);
  return (
    <Card
      onPress={onPress}
      style={[styles.card, style]}
      contentStyle={styles.cardContent}
      accent={color}
      accessibilityLabel={`${track.name}, ${todayLine(track)}`}
    >
      <View style={styles.cardRow}>
        <Monogram name={track.name} color={color} size={40} done={allDone} />
        <View style={styles.flex}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {track.name}
          </Text>
          <Text style={[t.caption, styles.cardMeta, allDone && { color: colors.success }]} numberOfLines={1}>
            {todayLine(track)}
          </Text>
        </View>
        <Icon name="chevron-right" size={18} color={colors.textTertiary} />
      </View>
      {track.today_required > 0 ? (
        <ProgressBar progress={progress} height={3} colorsPair={allDone ? gradients.success : [withAlpha(color, 0.7), color]} style={styles.cardBar} />
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
      <RealIcon name="check" size={26} />
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
    marginBottom: spacing.sm + 2,
  },
  cardContent: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  cardBar: {
    marginTop: spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 2,
  },
  monogram: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  monogramInner: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderWidth: StyleSheet.hairlineWidth,
  },
  monogramText: {
    ...font.bold,
    textAlign: 'center',
    includeFontPadding: false,
  },
  cardTitle: {
    ...t.bodyStrong,
    fontSize: 16,
  },
  cardMeta: {
    marginTop: 2,
  },

  table: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldLine,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  nameCol: {
    width: NAME_W,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.goldLine,
    backgroundColor: colors.surfaceAlt,
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
    borderBottomColor: colors.border,
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
    fontSize: 13.5,
    color: colors.text,
  },
  weekday: {
    ...font.bold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  dayNum: {
    ...font.serif,
    fontSize: 18,
    lineHeight: 20,
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
  boxTodo: {
    borderWidth: 1.5,
    borderColor: colors.gold,
    backgroundColor: colors.goldSoft,
  },
  boxFuture: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  none: {
    color: colors.textTertiary,
  },
});
