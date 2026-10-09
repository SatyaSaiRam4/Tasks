import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { brand, colors, gradients } from '../../theme';
import { useMotion } from '../../hooks/useMotion';
import { Glow, Gradient } from '../../components/Gradient';
import { Skeleton } from '../../components/Feedback';
import { Icon } from '../../components/Icon';

const MODEL_PAGE = 'file:///android_asset/web/satya/index.html';
const LOAD_TIMEOUT_MS = 8000;

type Phase = 'loading' | 'ready' | 'fallback';

/**
 * Satya, rendered from the bundled GLB through <model-viewer> in a WebView.
 * Never blocks the screen: a shimmering figure shows while it loads, and an
 * animated orb is the fallback if WebGL is missing, the model fails, or
 * loading takes too long.
 *
 * `intro="long"` plays the fuller entrance (first visit); "short" otherwise.
 */
export function SatyaModel({ size = 220, intro = 'short' }: { size?: number; intro?: 'long' | 'short' }) {
  const { reduced } = useMotion();
  const [phase, setPhase] = useState<Phase>('loading');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timer.current = setTimeout(() => setPhase(p => (p === 'loading' ? 'fallback' : p)), LOAD_TIMEOUT_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const canRender3D = Platform.OS === 'android';
  const uri = `${MODEL_PAGE}?motion=${reduced ? 'reduced' : 'full'}&intro=${intro}`;

  return (
    <View style={{ width: size, height: size }} accessible accessibilityLabel="Satya, your guide">
      <Glow color={colors.gold} size={size * 1.25} intensity={0.32} style={[styles.glow, { left: -size * 0.125, top: -size * 0.125 }]} />
      {phase === 'loading' ? <SatyaSkeleton size={size} /> : phase === 'fallback' ? <SatyaOrb size={size * 0.62} /> : null}
      {canRender3D && phase !== 'fallback' ? (
        <WebView
          source={{ uri }}
          style={[StyleSheet.absoluteFill, styles.web, phase !== 'ready' && styles.hidden]}
          containerStyle={styles.web}
          originWhitelist={['file://*']}
          allowFileAccess
          allowFileAccessFromFileURLs
          javaScriptEnabled
          scrollEnabled={false}
          overScrollMode="never"
          androidLayerType="hardware"
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={req => req.url.startsWith('file:///android_asset/')}
          onMessage={e => {
            const msg = e.nativeEvent.data;
            if (msg === 'loaded') setPhase('ready');
            else setPhase('fallback');
          }}
          onError={() => setPhase('fallback')}
          onRenderProcessGone={() => setPhase('fallback')}
          pointerEvents="none"
        />
      ) : null}
    </View>
  );
}

/** A shimmering head-and-body silhouette shown while the 3D model loads. */
function SatyaSkeleton({ size }: { size: number }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.center]} accessibilityLabel="Loading Satya">
      <Skeleton width={size * 0.26} height={size * 0.26} rounded={size * 0.13} />
      <Skeleton width={size * 0.44} height={size * 0.42} rounded={size * 0.16} style={{ marginTop: size * 0.04 }} />
    </View>
  );
}

/** The non-3D Satya: a breathing gradient orb with a sparkle. Used when 3D isn't available. */
export function SatyaOrb({ size = 120 }: { size?: number }) {
  const { reduced } = useMotion();
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe, reduced]);

  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] });
  const translateY = breathe.interpolate({ inputRange: [0, 1], outputRange: [3, -3] });

  return (
    <View style={[StyleSheet.absoluteFill, styles.center]}>
      <Animated.View style={{ transform: [{ scale }, { translateY }] }}>
        <Gradient colors={gradients.gold} borderRadius={size / 2} style={[styles.orb, { width: size, height: size }]}>
          <View style={[styles.orbInner, { width: size * 0.7, height: size * 0.7, borderRadius: size * 0.35 }]}>
            <Icon name="sparkles" size={size * 0.34} color={brand.champagneLight} strokeWidth={1.6} />
          </View>
        </Gradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
  },
  web: {
    backgroundColor: 'transparent',
  },
  hidden: {
    opacity: 0,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbInner: {
    backgroundColor: brand.midnight,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
