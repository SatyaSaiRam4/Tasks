import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Dimensions, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { brand, colors, gradients, radius, spacing, type as t } from '../theme';
import { Emblem } from './Emblem';
import { Eyebrow } from './ScreenHeader';
import { useMotion } from '../hooks/useMotion';
import { Button } from './Button';
import { Glow, Gradient, Sheen } from './Gradient';
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
        color: [brand.champagneLight, brand.champagne, brand.ivory, colors.streak, colors.azure][i % 5],
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
  // The card is always midnight, so use the bright (dark-theme) tones on it.
  const accent = spec.tone === 'streak' ? brand.ember : spec.tone === 'success' ? brand.jade : brand.champagne;
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
          <Gradient colors={gradients.hero} direction="diagonal" style={StyleSheet.absoluteFill} />
          <Glow color={accent} size={420} intensity={0.22} style={styles.cardGlow} />
          <Sheen color={gradients.heroSheen} inset="20%" />
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
                  <Text style={[t.heading, styles.center, styles.statValue]}>{s.value}</Text>
                  <Text style={[t.caption, styles.center, styles.statLabel]}>{s.label}</Text>
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
    backgroundColor: colors.scrim,
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
    backgroundColor: brand.midnight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.heroLine,
    overflow: 'hidden',
  },
  cardGlow: {
    position: 'absolute',
    top: -160,
    alignSelf: 'center',
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
    fontSize: 38,
    lineHeight: 42,
    color: colors.heroText,
  },
  subtitle: {
    textAlign: 'center',
    color: colors.heroTextSecondary,
    marginTop: spacing.sm,
  },
  stats: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.heroGlass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.heroLine,
    paddingVertical: spacing.lg,
  },
  stat: {
    flex: 1,
  },
  statValue: {
    color: brand.champagneLight,
    fontSize: 30,
    lineHeight: 34,
  },
  statLabel: {
    color: colors.heroTextSecondary,
  },
  cta: {
    marginTop: spacing.xxl,
  },
});
