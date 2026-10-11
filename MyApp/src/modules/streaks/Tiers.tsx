import React, { useId, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CelebrationSpec } from '../../components/Celebration';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { colors, font, gradients, radius, spacing, type as t } from '../../theme';
import { Sheet } from '../../components/Sheet';
import { RealIcon } from '../../components/RealIcon';
import { ProgressBar } from '../../components/Progress';

/**
 * Premium streak tiers, earned by the best streak ever kept (so a broken
 * streak never takes a badge away). Diamond and Master match the wallet's
 * ₹10 and ₹20 rewards.
 */
export interface Tier {
  key: string;
  name: string;
  days: number;
  /** Light, mid and dark metal tones, top to bottom. */
  metal: [string, string, string];
  reward?: string;
}

export const TIERS: Tier[] = [
  { key: 'bronze', name: 'Bronze', days: 7, metal: ['#F6C29A', '#B8662F', '#5E2C12'] },
  { key: 'silver', name: 'Silver', days: 30, metal: ['#FFFFFF', '#B9C3CE', '#5F6975'] },
  { key: 'gold', name: 'Gold', days: 100, metal: ['#FFF3A8', '#E9B336', '#86560F'] },
  { key: 'platinum', name: 'Platinum', days: 250, metal: ['#EFFDFF', '#8FD6E3', '#2F6F80'] },
  { key: 'diamond', name: 'Diamond', days: 500, metal: ['#E6F1FF', '#6AA4FF', '#2B2FB8'], reward: '₹10' },
  { key: 'master', name: 'Master', days: 1000, metal: ['#FFE0F4', '#C24DFF', '#4E0C86'], reward: '₹20' },
];

/** How many tiers a best streak has earned. */
/** The highest badge earned with this best streak, or -1 for none yet. */
export function tierIndex(best: number): number {
  let index = -1;
  TIERS.forEach((tier, i) => {
    if (best >= tier.days) index = i;
  });
  return index;
}

const seenKey = (userId: string) => `@memo/tier_seen_${userId}`;
const seenInMemory = new Map<string, number>();

/**
 * Congratulates the user once for each badge they reach ("You reached
 * Bronze!"). The first check on a device only records the badges already
 * held, so nobody is congratulated for old news, unless the badge was
 * reached by the tick that is being checked.
 */
export async function celebrateNewTier(
  userId: string,
  best: number,
  celebrate: (spec: CelebrationSpec) => void,
  /** True when this very tick added the streak point, so a badge reached exactly now is news. */
  justEarned = false,
) {
  const reached = tierIndex(best);
  const reachedNow = justEarned && reached >= 0 && TIERS[reached].days === best;
  let seen = seenInMemory.get(userId);
  if (seen === undefined) {
    const raw = await AsyncStorage.getItem(seenKey(userId)).catch(() => null);
    seen = raw === null ? (reachedNow ? reached - 1 : reached) : Number(raw);
    // A check that ran while this one waited may already have recorded more.
    seen = Math.max(seen, seenInMemory.get(userId) ?? -1);
  }
  seenInMemory.set(userId, Math.max(seen, reached));
  if (reached > seen) {
    const tier = TIERS[reached];
    const next = TIERS[reached + 1];
    celebrate({
      icon: 'award',
      tone: 'primary',
      eyebrow: 'New badge',
      title: `You reached ${tier.name}!`,
      subtitle: tier.reward
        ? `${tier.reward} has been added to your Wallet.`
        : next
          ? `Streak ${tier.days} reached. Next: ${next.name} at ${next.days}.`
          : `Streak ${tier.days}. The highest badge there is.`,
      stats: [
        { label: 'Badge', value: tier.name },
        { label: 'Best streak', value: String(best) },
      ],
    });
  }
  AsyncStorage.setItem(seenKey(userId), String(Math.max(seen, reached))).catch(() => undefined);
}

export function earnedCount(best: number) {
  return TIERS.filter(tr => best >= tr.days).length;
}

/**
 * A tier medal: a metallic shield with a flame, stars for its rank and, from
 * Gold up, wings. Locked tiers are drawn in grey with a lock.
 */
export function TierBadge({ tier, earned, size = 64 }: { tier: Tier; earned: boolean; size?: number }) {
  const id = useId().replace(/:/g, '');
  const rank = TIERS.indexOf(tier);
  const [hi, mid, lo] = earned ? tier.metal : ['#D9DDE3', '#9AA1AB', '#5C636D'];
  const wings = rank >= 2;
  const stars = (rank % 3) + 1;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" opacity={earned ? 1 : 0.55}>
      <Defs>
        <LinearGradient id={`rim${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={hi} />
          <Stop offset="0.5" stopColor={mid} />
          <Stop offset="1" stopColor={lo} />
        </LinearGradient>
        <RadialGradient id={`face${id}`} cx="50%" cy="35%" r="70%">
          <Stop offset="0" stopColor={mid} />
          <Stop offset="1" stopColor={lo} />
        </RadialGradient>
        <LinearGradient id={`fl${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={earned ? '#FFE07A' : '#F2F2F2'} />
          <Stop offset="1" stopColor={earned ? '#FF5A1F' : '#B9BEC6'} />
        </LinearGradient>
      </Defs>
      {wings ? (
        <G fill={`url(#rim${id})`}>
          <Path d="M22 34 C8 30 2 40 4 50 C10 46 14 47 18 49 C10 52 8 58 10 64 C15 59 19 58 24 59 Z" />
          <Path d="M78 34 C92 30 98 40 96 50 C90 46 86 47 82 49 C90 52 92 58 90 64 C85 59 81 58 76 59 Z" />
        </G>
      ) : null}
      {/* shield */}
      <Path d="M50 8 L82 20 V50 C82 72 67 86 50 94 C33 86 18 72 18 50 V20 Z" fill={`url(#rim${id})`} />
      <Path d="M50 15 L76 25 V50 C76 68 64 80 50 87 C36 80 24 68 24 50 V25 Z" fill={`url(#face${id})`} />
      {/* flame */}
      <Path d="M50 30c1.5 5 8 8 9 15 1.2 7-3 15-9 15s-10-5-9.5-11c.4-4.5 3-6.5 4.5-9 .3 3 1.5 4.5 3 5-.8-5 0-10 2-15z" fill={`url(#fl${id})`} />
      {/* rank stars */}
      {Array.from({ length: stars }, (_, i) => {
        const x = 50 + (i - (stars - 1) / 2) * 11;
        return <Path key={i} d={`M${x} 64l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6z`} fill={hi} />;
      })}
      {/* sheen */}
      <Path d="M28 26 L50 18 L50 30 C42 31 34 34 28 40 Z" fill="#FFFFFF" opacity={0.18} />
      {!earned ? (
        <G>
          <Circle cx="76" cy="80" r="12" fill="#3B414A" />
          <Path d="M71.5 80v-3a4.5 4.5 0 0 1 9 0v3" stroke="#FFFFFF" strokeWidth={2} fill="none" />
          <Path d="M70 80h12v7H70z" fill="#FFFFFF" />
        </G>
      ) : null}
    </Svg>
  );
}

/** A row of every tier; tapping one shows its steps. */
export function TierRow({ best, size = 58 }: { best: number; size?: number }) {
  const [shown, setShown] = useState<Tier>(TIERS[0]);
  const [open, setOpen] = useState(false);
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {TIERS.map(tier => {
          const earned = best >= tier.days;
          return (
            <Pressable
              key={tier.key}
              onPress={() => {
                setShown(tier);
                setOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${tier.name} badge, ${earned ? 'earned' : `streak ${tier.days} needed`}. Show steps.`}
              style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
            >
              <TierBadge tier={tier} earned={earned} size={size} />
              <Text style={[styles.name, !earned && styles.nameLocked]}>{tier.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <TierSheet tier={shown} visible={open} best={best} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * All six badges as one small, even row (no names), for tight spots like the
 * Home streak card. Earned ones shine; tap any for its steps.
 */
export function BadgeStrip({ best, size = 30, labels }: { best: number; size?: number; labels?: 'hero' | 'default' }) {
  const [shown, setShown] = useState<Tier>(TIERS[0]);
  const [open, setOpen] = useState(false);
  return (
    <>
      <View style={styles.strip}>
        {TIERS.map(tier => {
          const earned = best >= tier.days;
          return (
            <Pressable
              key={tier.key}
              onPress={() => {
                setShown(tier);
                setOpen(true);
              }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`${tier.name} badge, ${earned ? 'earned' : `streak ${tier.days} needed`}. Show steps.`}
              style={({ pressed }) => [styles.stripCell, pressed && styles.pressed]}
            >
              <TierBadge tier={tier} earned={earned} size={size} />
              {labels ? (
                <Text
                  style={[styles.stripName, labels === 'hero' && styles.stripNameHero, !earned && styles.stripNameLocked]}
                  numberOfLines={1}
                >
                  {tier.name}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <TierSheet tier={shown} visible={open} best={best} onClose={() => setOpen(false)} />
    </>
  );
}

/** The steps for one tier: what it takes, how far along, and the full ladder. */
function TierSheet({ tier, visible, best, onClose }: { tier: Tier; visible: boolean; best: number; onClose: () => void }) {
  const earned = best >= tier.days;
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.sheetHead}>
        <TierBadge tier={tier} earned={earned} size={112} />
        <Text style={[t.heading, styles.center]}>{tier.name}</Text>
        <Text style={[t.caption, styles.center]}>
          {earned ? 'Earned. Well kept!' : `Reach a streak of ${tier.days} to earn it.`}
          {tier.reward ? ` Adds ${tier.reward} to your wallet.` : ''}
        </Text>
        <View style={styles.progress}>
          <ProgressBar progress={Math.min(best / tier.days, 1)} height={6} colorsPair={earned ? gradients.success : gradients.gold} />
          <Text style={styles.progressText}>
            {Math.min(best, tier.days)} / {tier.days} days
          </Text>
        </View>
      </View>
      <Text style={styles.stepsLabel}>Steps</Text>
      {TIERS.map((step, i) => {
        const done = best >= step.days;
        return (
          <View key={step.key} style={[styles.step, i === TIERS.length - 1 && styles.stepLast]}>
            <View style={[styles.stepDot, done && styles.stepDotDone, step.key === tier.key && styles.stepDotCurrent]}>
              {done ? <RealIcon name="check" size={24} /> : <Text style={styles.stepNum}>{i + 1}</Text>}
            </View>
            <Text style={[t.body, styles.flex, step.key === tier.key && styles.stepCurrent]}>
              {step.name} · streak {step.days}
            </Text>
            {step.reward ? <Text style={styles.reward}>{step.reward}</Text> : null}
          </View>
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  row: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  cell: {
    width: 72,
    alignItems: 'center',
    gap: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  strip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stripCell: {
    alignItems: 'center',
    gap: 3,
    minWidth: 44,
  },
  stripName: {
    ...font.semibold,
    fontSize: 9.5,
    letterSpacing: 0.3,
    color: colors.text,
  },
  stripNameHero: {
    color: colors.heroText,
  },
  stripNameLocked: {
    opacity: 0.5,
  },
  name: {
    ...font.bold,
    fontSize: 11,
    color: colors.text,
  },
  nameLocked: {
    color: colors.textTertiary,
  },
  sheetHead: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  center: {
    textAlign: 'center',
  },
  progress: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  progressText: {
    ...font.semibold,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  stepsLabel: {
    ...t.micro,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  stepLast: {
    borderBottomWidth: 0,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  stepDotDone: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  stepDotCurrent: {
    borderColor: colors.gold,
    borderWidth: 1.5,
  },
  stepNum: {
    ...font.bold,
    fontSize: 11,
    color: colors.textSecondary,
  },
  stepCurrent: {
    ...font.bold,
  },
  reward: {
    ...font.bold,
    fontSize: 13,
    color: colors.success,
  },
});
