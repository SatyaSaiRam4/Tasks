import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Dimensions, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, gradients, radius, spacing, type as t } from '../theme';
import { useMotion } from '../hooks/useMotion';
import { Button } from './Button';
import { Glow, Gradient } from './Gradient';
import { Icon, type IconName } from './Icon';

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
        size: 5 + Math.random() * 6,
        color: [colors.primary, colors.streak, colors.success, colors.streakGold, colors.info][i % 5],
      })),
    [],
  );

  useEffect(() => {
    Animated.parallel([
      Animated.spring(appear, { toValue: 1, useNativeDriver: true, bounciness: 8, speed: 12 }),
      reduced
        ? Animated.timing(burst, { toValue: 0, duration: 0, useNativeDriver: true })
        : Animated.timing(burst, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [appear, burst, reduced]);

  const pair = spec.tone === 'streak' ? gradients.streak : spec.tone === 'success' ? gradients.success : gradients.primary;
  const accent = spec.tone === 'streak' ? colors.streak : spec.tone === 'success' ? colors.success : colors.primary;
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
                borderRadius: p.size / 2,
                backgroundColor: p.color,
                opacity,
                transform: [{ translateX: tx }, { translateY: ty }],
              }}
            />
          );
        })}
        <Animated.View style={[styles.card, { opacity: appear, transform: [{ scale }] }]} accessibilityViewIsModal>
          <View style={styles.iconArea}>
            <Glow color={accent} size={180} intensity={0.5} style={styles.glow} />
            <Gradient colors={pair} borderRadius={radius.xxl} style={styles.iconBadge}>
              <Icon name={spec.icon} size={40} color={colors.white} strokeWidth={2.2} />
            </Gradient>
          </View>
          <Text style={[t.micro, { color: accent, textAlign: 'center' }]}>{spec.eyebrow}</Text>
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
    backgroundColor: 'rgba(3,4,7,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    padding: spacing.xxl,
    borderRadius: radius.xxl,
    backgroundColor: colors.backgroundRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  iconArea: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
    marginBottom: spacing.md,
  },
  glow: {
    position: 'absolute',
  },
  iconBadge: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    textAlign: 'center',
  },
  title: {
    marginTop: spacing.sm,
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
    backgroundColor: colors.surface,
    paddingVertical: spacing.lg,
  },
  stat: {
    flex: 1,
  },
  cta: {
    marginTop: spacing.xl,
  },
});
