import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, font, gradients } from '../../theme';
import { useMotion } from '../../hooks/useMotion';
import { Glow, Gradient } from '../../components/Gradient';

const MODEL_PAGE = 'file:///android_asset/web/satya/index.html';
const LOAD_TIMEOUT_MS = 8000;

type Phase = 'loading' | 'ready' | 'fallback';

/**
 * Satya, rendered from the bundled GLB through <model-viewer> in a WebView.
 * Never blocks the screen: an animated orb shows immediately and stays as the
 * fallback if WebGL is missing, the model fails, or loading takes too long.
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
      {phase !== 'ready' ? <SatyaOrb size={size * 0.62} /> : null}
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

/** The non-3D Satya: a breathing gradient orb. Used while loading and as the fallback. */
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
            <Text style={[styles.orbText, { fontSize: size * 0.32 }]}>S</Text>
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
    backgroundColor: '#101730',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbText: {
    ...font.serif,
    color: colors.goldBright,
    includeFontPadding: false,
  },
});
