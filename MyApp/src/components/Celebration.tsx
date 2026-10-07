import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Dimensions, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, gradients, radius, spacing, type as t } from '../theme';
import { Emblem } from './Emblem';
import { Eyebrow } from './ScreenHeader';
import { useMotion } from '../hooks/useMotion';
import { Button } from './Button';
import { Gradient } from './Gradient';
import { type IconName } from './Icon';

export interface CelebrationSpec {
  icon: IconName;
  eyebrow: string;
  title: string;
  subtitle?: string;
  stats?: { label: string; value: string }[];
  tone?: 'streak' | 'success' | 'primary';
}

interface CelebrationApi {
  celebrate: (spec: CelebrationSpec) => void;
}

const CelebrationContext = createContext<CelebrationApi>({ celebrate: () => undefined });

export function useCelebration() {
  return useContext(CelebrationContext);
}

const { width: W, height: H } = Dimensions.get('window');
const PARTICLES = 26;

/** Queues celebrations (day secured, achievement, Track completed) and shows them one at a time. */
export function CelebrationProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<CelebrationSpec[]>([]);
  const current = queue[0] ?? null;

  const celebrate = useCallback((spec: CelebrationSpec) => {
    setQueue(q => [...q, spec]);
    AccessibilityInfo.announceForAccessibility(`${spec.eyebrow}. ${spec.title}`);
  }, []);

  const value = useMemo(() => ({ celebrate }), [celebrate]);

  return (
    <CelebrationContext.Provider value={value}>
      {children}
      {current ? <CelebrationOverlay key={`${current.title}-${queue.length}`} spec={current} onDone={() => setQueue(q => q.slice(1))} /> : null}
    </CelebrationContext.Provider>
  );
}

function CelebrationOverlay({ spec, onDone }: { spec: CelebrationSpec; onDone: () => void }) {
  const { reduced } = useMotion();
  const appear = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLES }, (_, i) => ({
        angle: (i / PARTICLES) * Math.PI * 2 + Math.random() * 0.4,
        dist: 120 + Math.random() * 160,
        size: 3 + Math.random() * 5,
        color: [colors.goldBright, colors.gold, colors.text, colors.streakGold, colors.moon][i % 5],
        star: i % 3 === 0,
      })),
    [],
  );

  useEffect(() => {
    Animated.parallel([
      Animated.spring(appear, { toValue: 1, useNativeDriver: true, bounciness: 3, speed: 9 }),
      reduced
        ? Animated.timing(burst, { toValue: 0, duration: 0, useNativeDriver: true })
        : Animated.timing(burst, { toValue: 1, duration: 1700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [appear, burst, reduced]);

  const ring = spec.tone === 'streak' ? gradients.streak : spec.tone === 'success' ? gradients.success : gradients.gold;
  const accent = spec.tone === 'streak' ? colors.streak : spec.tone === 'success' ? colors.success : colors.gold;
  const scale = appear.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onDone} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onDone} accessibilityRole="button" accessibilityLabel="Dismiss">
        {particles.map((p, i) => {
          const tx = burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(p.angle) * p.dist] });
          const ty = burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(p.angle) * p.dist + 60] });
          const opacity = burst.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 1, 0] });
          return (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: W / 2,
                top: H / 2 - 120,
                width: p.size,
                height: p.size,
                borderRadius: p.star ? 1 : p.size / 2,
                backgroundColor: p.color,
                opacity,
                transform: [{ translateX: tx }, { translateY: ty }, { rotate: p.star ? '45deg' : '0deg' }],
              }}
            />
          );
        })}
        <Animated.View style={[styles.card, { opacity: appear, transform: [{ scale }] }]} accessibilityViewIsModal>
          <Gradient colors={gradients.moonlight} direction="vertical" style={StyleSheet.absoluteFill} />
          <View style={styles.sheen} pointerEvents="none" />
          <View style={styles.iconArea}>
            <Emblem icon={spec.icon} size={190} tint={accent} ring={ring} />
          </View>
          <View style={styles.eyebrow}>
            <Eyebrow label={spec.eyebrow} color={accent} />
          </View>
          <Text style={[t.title, styles.center, styles.title]}>{spec.title}</Text>
          {spec.subtitle ? <Text style={[t.body, styles.subtitle]}>{spec.subtitle}</Text> : null}
          {spec.stats?.length ? (
            <View style={styles.stats}>
              {spec.stats.map(s => (
                <View key={s.label} style={styles.stat}>
                  <Text style={[t.heading, styles.center]}>{s.value}</Text>
                  <Text style={[t.caption, styles.center]}>{s.label}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <Button label="Keep going" onPress={onDone} size="lg" style={styles.cta} />
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,3,8,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: spacing.xxl,
    paddingTop: spacing.lg,
    borderRadius: radius.xxl,
    backgroundColor: colors.backgroundRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldLine,
    overflow: 'hidden',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 1,
    backgroundColor: 'rgba(241,221,175,0.5)',
  },
  iconArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  eyebrow: {
    alignItems: 'center',
  },
  center: {
    textAlign: 'center',
  },
  title: {
    marginTop: spacing.sm,
    fontSize: 36,
    lineHeight: 40,
  },
  subtitle: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  stats: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    paddingVertical: spacing.lg,
  },
  stat: {
    flex: 1,
  },
  cta: {
    marginTop: spacing.xxl,
  },
});
