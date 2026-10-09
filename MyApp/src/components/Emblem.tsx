import React, { useId } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { brand, colors } from '../theme';
import { useLoop } from '../animations';
import { Icon, type IconName } from './Icon';

/**
 * The house illustration: an icon set in a champagne-rimmed midnight
 * medallion, framed by an art-deco sunburst of fine rays and a slowly
 * turning dashed orbit, over a soft halo. Used for empty, error, lock and
 * celebration moments so they all share one look.
 */
export function Emblem({
  icon,
  size = 168,
  tint = colors.gold,
  iconColor,
  ring = [brand.champagneLight, brand.champagneDeep],
}: {
  icon: IconName;
  size?: number;
  tint?: string;
  iconColor?: string;
  ring?: [string, string] | readonly [string, string];
}) {
  const id = useId().replace(/:/g, '');
  const breathe = useLoop(6000);
  const spin = useLoop(60000, { pingPong: false, rest: 0 });
  const float = breathe.interpolate({ inputRange: [0, 1], outputRange: [3, -3] });
  const halo = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const c = size / 2;
  const medal = size * 0.44;

  // Sixteen rays, alternating long and short, between the medal and the orbit.
  const rays = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    const r1 = size * 0.27;
    const r2 = size * (i % 2 === 0 ? 0.4 : 0.34);
    return { x1: c + Math.cos(a) * r1, y1: c + Math.sin(a) * r1, x2: c + Math.cos(a) * r2, y2: c + Math.sin(a) * r2 };
  });

  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: halo }]}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id={`h${id}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={tint} stopOpacity={0.3} />
              <Stop offset="0.6" stopColor={tint} stopOpacity={0.08} />
              <Stop offset="1" stopColor={tint} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={size} height={size} fill={`url(#h${id})`} />
          <G>
            {rays.map((r, i) => (
              <Line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke={tint} strokeOpacity={i % 2 === 0 ? 0.32 : 0.18} strokeWidth={1} />
            ))}
          </G>
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
        <Svg width={size} height={size}>
          <Circle cx={c} cy={c} r={size * 0.45} stroke={tint} strokeOpacity={0.22} strokeWidth={1} fill="none" strokeDasharray="1.5 6" />
          <Path d={diamond(c, c - size * 0.45, size * 0.022)} fill={tint} fillOpacity={0.9} />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.center, { transform: [{ translateY: float }] }]}>
        <View style={{ width: medal, height: medal }}>
          <Svg width={medal} height={medal} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id={`r${id}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={ring[0]} />
                <Stop offset="1" stopColor={ring[1]} />
              </LinearGradient>
              <LinearGradient id={`f${id}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={brand.panelHigh} />
                <Stop offset="1" stopColor={brand.midnight} />
              </LinearGradient>
            </Defs>
            <Circle cx={medal / 2} cy={medal / 2} r={medal / 2 - 1} fill={`url(#r${id})`} />
            <Circle cx={medal / 2} cy={medal / 2} r={medal / 2 - 2.5} fill={`url(#f${id})`} />
            <Circle cx={medal / 2} cy={medal / 2} r={medal / 2 - 6} stroke={`url(#r${id})`} strokeOpacity={0.35} strokeWidth={0.75} fill="none" />
          </Svg>
          <View style={[styles.iconBox, { width: medal, height: medal }]}>
            <Icon name={icon} size={medal * 0.4} color={iconColor ?? (colors.isDark ? tint : brand.champagneLight)} strokeWidth={1.5} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function diamond(x: number, y: number, r: number) {
  return `M${x} ${y - r * 1.4} L${x + r} ${y} L${x} ${y + r * 1.4} L${x - r} ${y} Z`;
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
