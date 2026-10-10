import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { brand, colors, font, radius, spacing, type as t, withAlpha } from '../../../theme';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Card } from '../../../components/Card';
import { Icon, type IconName } from '../../../components/Icon';
import { BrandMark } from '../../../components/Brand';
import { FadeIn } from '../../../components/Feedback';

/**
 * "Why Memo?": how Memo compares with a phone alarm and with typical to-do
 * apps, in plain words. Kept honest: "Some" means some apps or phones do it
 * (often on a paid plan), and the note at the bottom says what was compared.
 *
 * Compared (October 2026): the phone's Clock app (Google Clock; Samsung
 * Clock), and Google Tasks, Microsoft To Do, Todoist and TickTick. Sources:
 * Google Clock 8.0 release notes (future-date alarms), Todoist Karma help
 * (streaks), TickTick habit tracker (streaks), Google Tasks product page
 * (dates, repeats and reminders).
 */

type Mark = 'yes' | 'some' | 'no';

interface Row {
  icon: IconName;
  label: string;
  alarm: Mark;
  todo: Mark;
  memo: Mark;
}

const ROWS: Row[] = [
  { icon: 'bell', label: 'Rings at the time you choose', alarm: 'yes', todo: 'yes', memo: 'yes' },
  { icon: 'calendar', label: 'Remembers a date months ahead', alarm: 'some', todo: 'yes', memo: 'yes' },
  { icon: 'edit', label: 'Tells you what it’s for, with a note', alarm: 'some', todo: 'yes', memo: 'yes' },
  { icon: 'clock', label: 'Rings loudly like an alarm, until you stop it', alarm: 'yes', todo: 'some', memo: 'yes' },
  { icon: 'target', label: 'Goals with small daily tasks', alarm: 'no', todo: 'yes', memo: 'yes' },
  { icon: 'flame', label: 'Streaks that keep you going', alarm: 'no', todo: 'some', memo: 'yes' },
  { icon: 'wallet', label: 'Real money for your streaks', alarm: 'no', todo: 'no', memo: 'yes' },
  { icon: 'message', label: 'Reminder on WhatsApp, to any number', alarm: 'no', todo: 'no', memo: 'yes' },
  { icon: 'lock', label: 'Private notes behind your own PIN', alarm: 'no', todo: 'some', memo: 'yes' },
];

export function WhyMemoScreen() {
  return (
    <Screen>
      <ScreenHeader title="Why Memo?" />
      <Text style={styles.intro}>An alarm rings. A to-do app keeps a list. Memo does both, and helps you keep going.</Text>

      <FadeIn>
        <Diagram />
      </FadeIn>

      <FadeIn index={1}>
        <Card padded={false} style={styles.table}>
          <View style={[styles.row, styles.headRow]}>
            <View style={styles.labelCell} />
            <Column icon="clock" title="Phone alarm" />
            <Column icon="list" title="To-do apps" />
            <Column memo title="Memo" />
          </View>
          {ROWS.map((row, i) => (
            <View key={row.label} style={[styles.row, i < ROWS.length - 1 && styles.rowLine]}>
              <View style={styles.labelCell}>
                <Icon name={row.icon} size={16} color={colors.gold} strokeWidth={1.8} />
                <Text style={styles.label}>{row.label}</Text>
              </View>
              <Cell mark={row.alarm} />
              <Cell mark={row.todo} />
              <Cell mark={row.memo} highlight />
            </View>
          ))}
        </Card>
      </FadeIn>

      <View style={styles.legend}>
        <Legend mark="yes" text="Yes" />
        <Legend mark="some" text="Some apps or phones, often paid" />
        <Legend mark="no" text="No" />
      </View>

      <Text style={styles.note}>
        Compared with the phone’s Clock app (Google and Samsung) and popular to-do apps such as Google Tasks, Microsoft To Do, Todoist
        and TickTick, in October 2026. Features change and differ by phone and plan. WhatsApp reminders are a Memo premium feature.
      </Text>
    </Screen>
  );
}

/** The idea in one picture: an alarm and a to-do list, joined into Memo. */
function Diagram() {
  return (
    <Card tone="hero" contentStyle={styles.diagram}>
      <View style={styles.diagramTop}>
        <Bubble icon="clock" title="Alarm" text="Rings at a time" />
        <Text style={styles.plus}>+</Text>
        <Bubble icon="list" title="To-do app" text="Keeps your list" />
      </View>
      <View style={styles.arrow}>
        <View style={styles.arrowLine} />
        <Icon name="chevron-down" size={18} color={brand.champagne} />
      </View>
      <View style={styles.memoBox}>
        <BrandMark size={34} />
        <View style={styles.flex}>
          <Text style={styles.memoTitle}>Memo</Text>
          <Text style={styles.memoText}>Reminds you on time · plans with daily tasks · streaks that earn rewards</Text>
        </View>
      </View>
    </Card>
  );
}

function Bubble({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <View style={styles.bubble}>
      <View style={styles.bubbleIcon}>
        <Icon name={icon} size={20} color={brand.champagneLight} strokeWidth={1.7} />
      </View>
      <Text style={styles.bubbleTitle}>{title}</Text>
      <Text style={styles.bubbleText}>{text}</Text>
    </View>
  );
}

function Column({ icon, title, memo }: { icon?: IconName; title: string; memo?: boolean }) {
  return (
    <View style={[styles.cell, memo && styles.memoColumn]}>
      {memo ? <BrandMark size={22} /> : <Icon name={icon!} size={18} color={colors.textSecondary} strokeWidth={1.7} />}
      <Text style={[styles.columnTitle, memo && styles.columnTitleMemo]} numberOfLines={2}>
        {title}
      </Text>
    </View>
  );
}

function Cell({ mark, highlight }: { mark: Mark; highlight?: boolean }) {
  return (
    <View style={[styles.cell, highlight && styles.memoColumn]} accessible accessibilityLabel={mark === 'yes' ? 'Yes' : mark === 'some' ? 'Some' : 'No'}>
      <MarkIcon mark={mark} />
    </View>
  );
}

function MarkIcon({ mark }: { mark: Mark }) {
  if (mark === 'yes') {
    return (
      <View style={[styles.mark, styles.markYes]}>
        <Icon name="check" size={13} color={colors.isDark ? brand.midnight : '#ffffff'} strokeWidth={3} />
      </View>
    );
  }
  if (mark === 'some') {
    return (
      <View style={[styles.mark, styles.markSome]}>
        <Text style={styles.markSomeText}>~</Text>
      </View>
    );
  }
  return (
    <View style={[styles.mark, styles.markNo]}>
      <Icon name="x" size={12} color={colors.textTertiary} strokeWidth={2.4} />
    </View>
  );
}

function Legend({ mark, text }: { mark: Mark; text: string }) {
  return (
    <View style={styles.legendItem}>
      <MarkIcon mark={mark} />
      <Text style={t.caption}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  intro: {
    ...t.aside,
    marginBottom: spacing.lg,
  },
  diagram: {
    padding: spacing.lg,
  },
  diagramTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  plus: {
    ...font.serif,
    fontSize: 28,
    color: brand.champagne,
  },
  bubble: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(239,233,220,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.heroLine,
  },
  bubbleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(243,220,166,0.12)',
    marginBottom: spacing.xs,
  },
  bubbleTitle: {
    ...font.bold,
    fontSize: 14,
    color: colors.heroText,
  },
  bubbleText: {
    ...font.medium,
    fontSize: 12,
    color: colors.heroTextSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  arrow: {
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  arrowLine: {
    width: 1.5,
    height: 14,
    backgroundColor: brand.champagne,
    opacity: 0.6,
  },
  memoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: withAlpha(brand.champagne, 0.6),
    backgroundColor: 'rgba(243,220,166,0.1)',
  },
  memoTitle: {
    ...font.serif,
    fontSize: 22,
    lineHeight: 26,
    color: brand.champagneLight,
  },
  memoText: {
    ...font.medium,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.heroTextSecondary,
    marginTop: 2,
  },
  table: {
    marginTop: spacing.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  headRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.goldLine,
  },
  rowLine: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  labelCell: {
    flex: 1.9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
  },
  label: {
    ...font.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: colors.text,
    flex: 1,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: 4,
  },
  memoColumn: {
    backgroundColor: colors.goldSoft,
  },
  columnTitle: {
    ...font.bold,
    fontSize: 10.5,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  columnTitleMemo: {
    color: colors.gold,
  },
  mark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markYes: {
    backgroundColor: colors.success,
  },
  markSome: {
    backgroundColor: withAlpha(colors.warning, 0.22),
    borderWidth: 1,
    borderColor: withAlpha(colors.warning, 0.6),
  },
  markSomeText: {
    ...font.bold,
    fontSize: 14,
    lineHeight: 16,
    color: colors.warning,
  },
  markNo: {
    backgroundColor: colors.glassStrong,
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
    gap: spacing.xs + 2,
  },
  note: {
    ...t.caption,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
});
