import React, { useId } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { colors } from '../theme';
import { useLoop } from '../animations';
import { Icon, type IconName } from './Icon';

/** Small four-point star path centered on (x, y). */
function sparkle(x: number, y: number, r: number) {
  const k = r * 0.28;
  return `M${x} ${y - r} L${x + k} ${y - k} L${x + r} ${y} L${x + k} ${
    y + k
  } L${x} ${y + r} L${x - k} ${y + k} L${x - r} ${y} L${x - k} ${y - k} Z`;
}

/**
 * The house illustration: an icon set in a champagne-ringed midnight
 * medallion, circled by a faint orbit and a few sparkles, over a soft halo.
 * Used for empty, error, lock and celebration moments so they share one look.
 */
export function Emblem({
  icon,
  size = 168,
  tint = colors.gold,
  iconColor,
  ring = [colors.goldBright, colors.goldDeep],
}: {
  icon: IconName;
  size?: number;
  tint?: string;
  iconColor?: string;
  ring?: [string, string] | readonly [string, string];
}) {
  const id = useId().replace(/:/g, '');
  const spin = useLoop(6000);
  const float = spin.interpolate({ inputRange: [0, 1], outputRange: [3, -3] });
  const twinkle = spin.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 1],
  });
  const c = size / 2;
  const medal = size * 0.42;

  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`h${id}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={tint} stopOpacity={0.26} />
            <Stop offset="1" stopColor={tint} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill={`url(#h${id})`} />
        <Ellipse
          cx={c}
          cy={c}
          rx={size * 0.46}
          ry={size * 0.17}
          stroke={tint}
          strokeOpacity={0.28}
          strokeWidth={1}
          fill="none"
          transform={`rotate(-18 ${c} ${c})`}
        />
        <Circle
          cx={c}
          cy={c}
          r={size * 0.36}
          stroke={tint}
          strokeOpacity={0.12}
          strokeWidth={1}
          fill="none"
          strokeDasharray="2 5"
        />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: twinkle }]}>
        <Svg width={size} height={size}>
          <Path
            d={sparkle(size * 0.82, size * 0.2, size * 0.045)}
            fill={colors.goldBright}
          />
          <Path
            d={sparkle(size * 0.16, size * 0.7, size * 0.03)}
            fill={colors.text}
            opacity={0.8}
          />
          <Circle
            cx={size * 0.24}
            cy={size * 0.24}
            r={1.4}
            fill={colors.text}
          />
          <Circle
            cx={size * 0.8}
            cy={size * 0.78}
            r={1.2}
            fill={colors.goldBright}
          />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[styles.center, { transform: [{ translateY: float }] }]}
      >
        <View style={{ width: medal, height: medal }}>
          <Svg width={medal} height={medal} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id={`r${id}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={ring[0]} />
                <Stop offset="1" stopColor={ring[1]} />
              </LinearGradient>
              <LinearGradient id={`f${id}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#1C2646" />
                <Stop offset="1" stopColor="#0A0E1C" />
              </LinearGradient>
            </Defs>
            <Circle
              cx={medal / 2}
              cy={medal / 2}
              r={medal / 2 - 1}
              fill={`url(#r${id})`}
            />
            <Circle
              cx={medal / 2}
              cy={medal / 2}
              r={medal / 2 - 2.5}
              fill={`url(#f${id})`}
            />
          </Svg>
          <View style={[styles.iconBox, { width: medal, height: medal }]}>
            <Icon
              name={icon}
              size={medal * 0.4}
              color={iconColor ?? tint}
              strokeWidth={1.6}
            />
          </View>
        </View>
      </Animated.View>
    </View>
  );
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
