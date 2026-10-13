import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCelebration } from '../../components/Celebration';
import { useGetMeQuery, useUpdateSettingsMutation } from '../users/usersApi';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import { useMotion } from '../../hooks/useMotion';
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

// The last revealed badge per user: in memory, mirrored on the phone (so it
// holds even before the server knows `badge_seen`), and on the server.
const seenInMemory = new Map<string, number>();
const seenOnPhone = new Map<string, number>();
const loading = new Set<string>();
const listeners = new Set<() => void>();
// Which badge this phone has revealed. v3: earlier builds could mark badges
// seen without revealing them, so every phone starts fresh.
const phoneKey = (userId: string) => `@memo/badge_revealed_v3_${userId}`;
const notify = () => listeners.forEach(fn => fn());

function loadFromPhone(userId: string) {
  if (seenOnPhone.has(userId) || loading.has(userId)) return;
  loading.add(userId);
  AsyncStorage.getItem(phoneKey(userId))
    .then(raw => seenOnPhone.set(userId, raw === null ? -1 : Number(raw)))
    .catch(() => seenOnPhone.set(userId, -1))
    .finally(() => {
      loading.delete(userId);
      notify();
    });
}

function markSeen(userId: string, index: number) {
  setSeen(userId, Math.max(seenInMemory.get(userId) ?? -1, seenOnPhone.get(userId) ?? -1, index));
}

function setSeen(userId: string, value: number) {
  seenInMemory.set(userId, value);
  seenOnPhone.set(userId, value);
  AsyncStorage.setItem(phoneKey(userId), String(value)).catch(() => undefined);
  notify();
}

/**
 * Which badges look earned (`shown`, the highest index, -1 for none) and
 * which one waits to be revealed on Home (`pending`, or -1). Only what this
 * phone has actually shown counts: a badge looks earned only after its
 * reveal played here. `phone` undefined means the record is still loading:
 * everything new stays locked and nothing is revealed yet.
 */
export function badgeState({
  best,
  signedIn,
  phone,
  memory,
}: {
  best: number;
  signedIn: boolean;
  phone?: number;
  memory?: number;
}): { shown: number; pending: number } {
  const reached = tierIndex(best);
  if (!signedIn) return { shown: -1, pending: -1 };
  const seen = Math.max(phone ?? -1, memory ?? -1);
  return { shown: Math.min(reached, seen), pending: phone !== undefined && reached > seen ? reached : -1 };
}

/**
 * Badges appear earned only once they've been revealed on Home: until then a
 * newly reached badge still looks locked everywhere (Home, Profile). Each
 * phone remembers what it has revealed, so the reveal is always seen; the
 * server's `badge_seen` is also updated, for the record.
 */
export function useBadges(best: number) {
  const me = useGetMeQuery();
  const [update] = useUpdateSettingsMutation();
  const { celebrate } = useCelebration();
  const [, rerender] = useState(0);
  useEffect(() => {
    const fn = () => rerender(n => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  const id = me.data?.id;
  useEffect(() => {
    if (id) loadFromPhone(id);
  }, [id]);
  const phone = id ? seenOnPhone.get(id) : undefined;
  const { shown, pending } = badgeState({ best, signedIn: Boolean(id), phone, memory: id ? seenInMemory.get(id) : undefined });
  // The best streak only grows; if it went down (test data reset), so does
  // the record, and reaching the badge again reveals it again.
  const reached = tierIndex(best);
  useEffect(() => {
    if (id && phone !== undefined && best > 0 && reached < phone) setSeen(id, reached);
  }, [id, phone, best, reached]);

  /** After the reveal animation: mark it seen and open its congratulations card. */
  const congratulate = useCallback(
    (index: number) => {
      if (!id || index < 0) return;
      markSeen(id, index);
      const tier = TIERS[index];
      const next = TIERS[index + 1];
      celebrate({
        icon: 'award',
        tone: 'primary',
        art: <TierBadge tier={tier} earned size={170} />,
        eyebrow: 'New badge unlocked',
        title: `Congrats! You’ve upgraded to ${tier.name}`,
        subtitle: tier.reward
          ? `Streak ${tier.days} reached, and ${tier.reward} has been added to your Wallet.`
          : next
            ? `Streak ${tier.days} reached. Next up: ${next.name} at ${next.days}.`
            : `Streak ${tier.days}. The highest badge there is.`,
        stats: [
          { label: 'Badge', value: tier.name },
          { label: 'Best streak', value: String(best) },
        ],
      });
      update({ badge_seen: index }).catch(() => undefined);
    },
    [id, best, celebrate, update],
  );
  return { shown, pending, congratulate };
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
  const badges = useBadges(best);
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {TIERS.map((tier, index) => {
          const earned = index <= badges.shown;
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
      <TierSheet tier={shown} visible={open} best={best} earned={TIERS.indexOf(shown) <= badges.shown} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * All six badges as one small, even row (no names), for tight spots like the
 * Home streak card. Earned ones shine; tap any for its steps.
 */
export function BadgeStrip({
  best,
  size = 30,
  labels,
  reveal = -1,
  onRevealed,
}: {
  best: number;
  size?: number;
  labels?: 'hero' | 'default';
  /** The badge to bring to life now (it unlocks in place), or -1. */
  reveal?: number;
  onRevealed?: (index: number) => void;
}) {
  const [shown, setShown] = useState<Tier>(TIERS[0]);
  const [open, setOpen] = useState(false);
  const badges = useBadges(best);
  return (
    <>
      <View style={styles.strip}>
        {TIERS.map((tier, index) => {
          const earned = index <= badges.shown;
          if (index === reveal) {
            return (
              <View key={tier.key} style={[styles.stripCell, styles.revealCell]}>
                <RevealBadge tier={tier} size={size} onDone={() => onRevealed?.(index)} />
                {labels ? (
                  <Text style={[styles.stripName, labels === 'hero' && styles.stripNameHero]} numberOfLines={1}>
                    {tier.name}
                  </Text>
                ) : null}
              </View>
            );
          }
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
      <TierSheet tier={shown} visible={open} best={best} earned={TIERS.indexOf(shown) <= badges.shown} onClose={() => setOpen(false)} />
    </>
  );
}

const SPARKS = 10;
/** The heartbeat before the tremble: four 170 ms pulses and two pauses. */
const BEATS_MS = 4 * 170 + 120 + 140;
const SPARK_WHITE = '#FFFFFF';

/** The locked badge's stone, light and dark. */
const STONE = ['#9AA1AB', '#5C636D'];

/** Stone chips that break off the locked badge: where each flies, how it turns. */
const CHIPS = Array.from({ length: 9 }, (_, i) => {
  const angle = -Math.PI * 0.95 + (i / 8) * Math.PI * 0.9 + (i % 2 ? 0.12 : -0.08);
  return { angle, dist: 1.2 + (i % 3) * 0.35, spin: (i % 2 ? 1 : -1) * (260 + i * 40), w: 0.22 + (i % 3) * 0.06, h: 0.14 + ((i + 1) % 3) * 0.05 };
});

/**
 * A locked badge breaking open like a stone statue: a heartbeat or two, then
 * it shakes harder and harder while cracks spread across the grey stone, and
 * it bursts, stone chips flying out and falling, with a flash of light and
 * sparks, into the gold medal, which settles with a bounce. Then onDone()
 * (the congratulations card). It's the reward moment, so it plays even when
 * Memo's own animations are turned down; only the phone's Remove animations
 * setting shortens it.
 */
function RevealBadge({ tier, size, onDone }: { tier: Tier; size: number; onDone: () => void }) {
  const { system: reduced } = useMotion();
  const shake = useRef(new Animated.Value(0)).current;
  const grow = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const beat = useRef(new Animated.Value(0)).current;
  const crack = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const [lit, setLit] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (reduced) {
      setLit(true);
      const id = setTimeout(() => done.current(), 600);
      return () => clearTimeout(id);
    }
    const pulse = (to: number) => Animated.timing(beat, { toValue: to, duration: 170, easing: Easing.inOut(Easing.quad), useNativeDriver: true });
    const breakAt = BEATS_MS + 1500;
    const unlock = setTimeout(() => {
      setLit(true);
      Vibration.vibrate(60);
    }, breakAt);
    const thuds = [BEATS_MS + 500, BEATS_MS + 1000].map(ms => setTimeout(() => Vibration.vibrate(15), ms));
    const anim = Animated.sequence([
      // A heartbeat or two: something's alive inside.
      pulse(1),
      pulse(0),
      Animated.delay(120),
      pulse(1),
      pulse(0),
      Animated.delay(140),
      // Shakes harder and harder, swelling, as cracks spread over the stone.
      Animated.parallel([
        Animated.timing(shake, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(grow, { toValue: 1, duration: 1500, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(crack, { toValue: 1, duration: 1500, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
      // Bursts: chips fly and fall, a flash, sparks, and the medal pops out.
      Animated.parallel([
        Animated.timing(burst, { toValue: 1, duration: 1000, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(flash, { toValue: 1, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(grow, { toValue: 2, duration: 240, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
      ]),
      // Settles into its place.
      Animated.spring(grow, { toValue: 3, useNativeDriver: true, bounciness: 14, speed: 6 }),
    ]);
    anim.start(() => setTimeout(() => done.current(), 350));
    return () => {
      clearTimeout(unlock);
      thuds.forEach(clearTimeout);
      anim.stop();
    };
  }, [reduced, shake, grow, flash, beat, crack, burst]);

  const rotate = shake.interpolate({
    inputRange: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1],
    outputRange: ['0deg', '-3deg', '3deg', '-5deg', '5deg', '-8deg', '8deg', '-11deg', '11deg', '-14deg', '14deg', '-16deg', '0deg'],
  });
  const jitter = shake.interpolate({
    inputRange: [0, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1],
    outputRange: [0, 0, 1.5, -1.5, 2.5, -2.5, 3, 0],
  });
  const scale = grow.interpolate({ inputRange: [0, 1, 2, 3], outputRange: [1, 1.45, 2.3, 1.15] });
  const glow = grow.interpolate({ inputRange: [0, 1, 2, 3], outputRange: [0, 0.9, 1, 0.45] });
  const ring = flash.interpolate({ inputRange: [0, 1], outputRange: [0.4, 3.6] });
  const ringOpacity = flash.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.95, 0] });
  const halo = size * 1.7;

  return (
    <View style={[styles.revealBox, { width: size, height: size }]} accessibilityLabel={`${tier.name} badge unlocked`}>
      {/* The glow building up behind it. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.revealGlow, { width: halo, height: halo, borderRadius: halo / 2, backgroundColor: tier.metal[1], opacity: glow, transform: [{ scale }] }]}
      />
      {/* The flash ring as it breaks open. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.revealRing, { width: size, height: size, borderRadius: size / 2, opacity: ringOpacity, transform: [{ scale: ring }] }]}
      />
      {/* Sparks flying out. */}
      {Array.from({ length: SPARKS }, (_, i) => {
        const angle = (i / SPARKS) * Math.PI * 2;
        const dist = size * (1.5 + (i % 3) * 0.35);
        return (
          <Animated.View
            key={`s${i}`}
            pointerEvents="none"
            style={[
              styles.spark,
              {
                backgroundColor: i % 2 ? tier.metal[0] : SPARK_WHITE,
                opacity: ringOpacity,
                transform: [
                  { translateX: flash.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * dist] }) },
                  { translateY: flash.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * dist] }) },
                ],
              },
            ]}
          />
        );
      })}
      {/* Stone chips breaking off: they fly up and out, spin, and fall away. */}
      {CHIPS.map((c, i) => (
        <Animated.View
          key={`c${i}`}
          pointerEvents="none"
          style={[
            styles.chip,
            {
              width: size * c.w,
              height: size * c.h,
              backgroundColor: STONE[i % 3 ? 0 : 1],
              opacity: burst.interpolate({ inputRange: [0, 0.02, 0.75, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(c.angle) * size * c.dist] }) },
                {
                  translateY: burst.interpolate({
                    inputRange: [0, 0.35, 1],
                    outputRange: [0, Math.sin(c.angle) * size * c.dist * 0.8, Math.sin(c.angle) * size * c.dist * 0.4 + size * 1.1],
                  }),
                },
                { rotate: burst.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${c.spin}deg`] }) },
              ],
            },
          ]}
        />
      ))}
      <Animated.View
        style={{
          transform: [{ translateX: jitter }, { rotate }, { scale }, { scale: beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) }],
        }}
      >
        <TierBadge tier={tier} earned={lit} size={size} />
        {/* Cracks spreading over the stone before it breaks. */}
        {!lit ? (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: crack }]}>
            <Svg width={size} height={size} viewBox="0 0 100 100">
              <Path d="M50 8 L44 30 L56 42 L46 58 L54 72 L48 92" stroke="#2B2F36" strokeWidth={3.2} fill="none" strokeLinejoin="round" />
              <Path d="M56 42 L74 36 L86 44 M46 58 L28 62 L16 54 M44 30 L30 22" stroke="#2B2F36" strokeWidth={2.4} fill="none" strokeLinejoin="round" />
              <Path d="M54 72 L70 80 M48 20 L52 14" stroke="#3A3F47" strokeWidth={1.8} fill="none" />
            </Svg>
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

/** The steps for one tier: what it takes, how far along, and the full ladder. */
function TierSheet({ tier, visible, best, earned, onClose }: { tier: Tier; visible: boolean; best: number; earned: boolean; onClose: () => void }) {
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
  revealCell: {
    zIndex: 10,
    elevation: 10,
  },
  revealBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealGlow: {
    position: 'absolute',
  },
  revealRing: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  chip: {
    position: 'absolute',
    borderRadius: 1.5,
    borderTopLeftRadius: 0,
  },
  spark: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
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
