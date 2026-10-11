import React from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/**
 * The welcome story's cast, drawn in SVG so they stay sharp at any size and
 * need no image files: Aarav (a boy) and a woman in a kurta (Mom; Riya with a
 * ponytail) and Satya (a young man in a shirt and glasses), each with a few moods.
 */
export type Mood = 'happy' | 'sad' | 'worried' | 'surprised';

const INK = '#2A1E1A';
const LIP = '#8A3B2E';
const BLUSH = '#F29C9C';

/** Eyes, brows and mouth for a face centered on (cx, cy). */
function Face({ cx, cy, mood }: { cx: number; cy: number; mood: Mood }) {
  const eyeR = mood === 'surprised' ? 4 : 3.2;
  return (
    <G>
      <Circle cx={cx - 11} cy={cy} r={eyeR} fill={INK} />
      <Circle cx={cx + 11} cy={cy} r={eyeR} fill={INK} />
      <Circle cx={cx - 10} cy={cy - 1.2} r={1} fill="#fff" />
      <Circle cx={cx + 12} cy={cy - 1.2} r={1} fill="#fff" />
      {mood === 'sad' || mood === 'worried' ? (
        <G stroke={INK} strokeWidth={2} strokeLinecap="round">
          <Path d={`M${cx - 16} ${cy - 8} L${cx - 7} ${cy - 11}`} />
          <Path d={`M${cx + 16} ${cy - 8} L${cx + 7} ${cy - 11}`} />
        </G>
      ) : mood === 'surprised' ? (
        <G stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none">
          <Path d={`M${cx - 15} ${cy - 10} Q${cx - 11} ${cy - 14} ${cx - 7} ${cy - 10}`} />
          <Path d={`M${cx + 7} ${cy - 10} Q${cx + 11} ${cy - 14} ${cx + 15} ${cy - 10}`} />
        </G>
      ) : null}
      <Circle cx={cx - 16} cy={cy + 9} r={4} fill={BLUSH} opacity={0.55} />
      <Circle cx={cx + 16} cy={cy + 9} r={4} fill={BLUSH} opacity={0.55} />
      {mood === 'happy' ? (
        <Path d={`M${cx - 9} ${cy + 11} Q${cx} ${cy + 21} ${cx + 9} ${cy + 11}`} stroke={LIP} strokeWidth={3} strokeLinecap="round" fill="none" />
      ) : mood === 'sad' ? (
        <Path d={`M${cx - 8} ${cy + 18} Q${cx} ${cy + 11} ${cx + 8} ${cy + 18}`} stroke={LIP} strokeWidth={3} strokeLinecap="round" fill="none" />
      ) : mood === 'surprised' ? (
        <Ellipse cx={cx} cy={cy + 15} rx={4.5} ry={5.5} fill={LIP} />
      ) : (
        <Path d={`M${cx - 7} ${cy + 15} Q${cx} ${cy + 12} ${cx + 7} ${cy + 15}`} stroke={LIP} strokeWidth={3} strokeLinecap="round" fill="none" />
      )}
    </G>
  );
}

/** The boy: blue hoodie, messy dark hair. `wave` raises his right arm. */
export function Kid({ size = 150, mood = 'happy', wave = false }: { size?: number; mood?: Mood; wave?: boolean }) {
  const skin = '#F3C9A6';
  return (
    <Svg width={size * (120 / 190)} height={size} viewBox="0 0 120 190">
      <Defs>
        <LinearGradient id="kidHoodie" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#5B9BFF" />
          <Stop offset="1" stopColor="#2F5FD0" />
        </LinearGradient>
      </Defs>
      <Ellipse cx={60} cy={184} rx={34} ry={5} fill="#000" opacity={0.25} />
      <Rect x={44} y={138} width={13} height={42} rx={6} fill="#26345E" />
      <Rect x={63} y={138} width={13} height={42} rx={6} fill="#26345E" />
      <Ellipse cx={50} cy={180} rx={11} ry={5} fill="#EDEDED" />
      <Ellipse cx={70} cy={180} rx={11} ry={5} fill="#EDEDED" />
      <Rect x={22} y={96} width={14} height={44} rx={7} fill="url(#kidHoodie)" />
      {wave ? (
        <G transform="rotate(-150 90 100)">
          <Rect x={84} y={96} width={14} height={44} rx={7} fill="url(#kidHoodie)" />
          <Circle cx={91} cy={142} r={7} fill={skin} />
        </G>
      ) : (
        <G>
          <Rect x={84} y={96} width={14} height={44} rx={7} fill="url(#kidHoodie)" />
          <Circle cx={91} cy={142} r={7} fill={skin} />
        </G>
      )}
      <Circle cx={29} cy={142} r={7} fill={skin} />
      <Rect x={30} y={86} width={60} height={62} rx={22} fill="url(#kidHoodie)" />
      <Path d="M48 88 Q60 100 72 88" stroke="#fff" strokeWidth={2} opacity={0.5} fill="none" />
      <Circle cx={30} cy={60} r={6} fill={skin} />
      <Circle cx={90} cy={60} r={6} fill={skin} />
      <Circle cx={60} cy={58} r={30} fill={skin} />
      <Path d="M29 56 C27 22 93 22 91 56 C86 42 74 36 60 39 C46 36 34 42 29 56 Z" fill={INK} />
      <Path d="M52 30 L58 20 L62 31 L70 22 L70 34 Z" fill={INK} />
      <Face cx={60} cy={60} mood={mood} />
    </Svg>
  );
}

/** A woman in a kurta with a gold dupatta, hair in a bun, a bindi. `colors` sets the kurta. */
export function Mom({
  size = 190,
  mood = 'happy',
  colors = ['#D8698A', '#8E3A5E'],
  ponytail = false,
}: {
  size?: number;
  mood?: Mood;
  colors?: [string, string];
  /** A high ponytail instead of the bun (Riya). */
  ponytail?: boolean;
}) {
  const skin = '#E9B48F';
  const hair = '#3B2620';
  return (
    <Svg width={size * (130 / 240)} height={size} viewBox="0 0 130 240">
      <Defs>
        <LinearGradient id={`kurta${colors[0].slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors[0]} />
          <Stop offset="1" stopColor={colors[1]} />
        </LinearGradient>
      </Defs>
      <Ellipse cx={65} cy={232} rx={42} ry={6} fill="#000" opacity={0.25} />
      <Rect x={29} y={68} width={72} height={58} rx={22} fill={hair} />
      <Rect x={24} y={112} width={14} height={60} rx={7} fill={`url(#kurta${colors[0].slice(1)})`} />
      <Rect x={92} y={112} width={14} height={60} rx={7} fill={`url(#kurta${colors[0].slice(1)})`} />
      <Circle cx={31} cy={174} r={7} fill={skin} />
      <Circle cx={99} cy={174} r={7} fill={skin} />
      <Rect x={58} y={88} width={14} height={18} fill={skin} />
      <Path d="M38 110 Q65 96 92 110 L104 226 Q65 236 26 226 Z" fill={`url(#kurta${colors[0].slice(1)})`} />
      <Path d="M44 108 L98 214" stroke="#E7C17A" strokeWidth={7} strokeLinecap="round" opacity={0.85} />
      <Circle cx={65} cy={60} r={28} fill={skin} />
      <Path d="M37 58 C36 28 94 28 93 58 C88 44 77 38 65 40 C53 38 42 44 37 58 Z" fill={hair} />
      {ponytail ? (
        <Path d="M88 40 C104 44 106 70 98 92 C94 76 90 62 84 52 Z" fill={hair} />
      ) : (
        <Circle cx={65} cy={30} r={12} fill={hair} />
      )}
      <Circle cx={65} cy={48} r={2.2} fill="#C0392B" />
      <Circle cx={37} cy={72} r={3} fill="#E7C17A" />
      <Circle cx={93} cy={72} r={3} fill="#E7C17A" />
      <Face cx={65} cy={60} mood={mood} />
    </Svg>
  );
}

/** Satya: a young man in a teal shirt with glasses and short hair. */
export function Man({ size = 200, mood = 'happy' }: { size?: number; mood?: Mood }) {
  const skin = '#D9A27A';
  const hair = '#1E1512';
  return (
    <Svg width={size * (130 / 240)} height={size} viewBox="0 0 130 240">
      <Defs>
        <LinearGradient id="manShirt" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#3FA7B5" />
          <Stop offset="1" stopColor="#23707B" />
        </LinearGradient>
      </Defs>
      <Ellipse cx={65} cy={232} rx={40} ry={6} fill="#000" opacity={0.25} />
      <Rect x={44} y={150} width={17} height={78} rx={7} fill="#2B3550" />
      <Rect x={69} y={150} width={17} height={78} rx={7} fill="#2B3550" />
      <Ellipse cx={52} cy={228} rx={12} ry={5} fill="#2A1D17" />
      <Ellipse cx={78} cy={228} rx={12} ry={5} fill="#2A1D17" />
      <Rect x={22} y={100} width={15} height={62} rx={7} fill="url(#manShirt)" />
      <Rect x={93} y={100} width={15} height={62} rx={7} fill="url(#manShirt)" />
      <Circle cx={29} cy={165} r={7.5} fill={skin} />
      <Circle cx={101} cy={165} r={7.5} fill={skin} />
      <Rect x={58} y={84} width={14} height={18} fill={skin} />
      <Rect x={33} y={94} width={64} height={66} rx={20} fill="url(#manShirt)" />
      <Path d="M54 95 L65 108 L76 95" stroke="#FFFFFF" strokeWidth={4} fill="none" strokeLinejoin="round" />
      <Circle cx={65} cy={118} r={2.2} fill="#E8F3F5" />
      <Circle cx={65} cy={132} r={2.2} fill="#E8F3F5" />
      <Circle cx={65} cy={146} r={2.2} fill="#E8F3F5" />
      <Circle cx={37} cy={60} r={5} fill={skin} />
      <Circle cx={93} cy={60} r={5} fill={skin} />
      <Circle cx={65} cy={58} r={28} fill={skin} />
      <Path d="M37 54 C35 26 95 26 93 54 C88 42 76 36 62 38 C50 37 41 43 37 54 Z" fill={hair} />
      <Path d="M60 34 C72 28 86 32 90 44 C80 38 70 38 60 40 Z" fill={hair} />
      <Face cx={65} cy={60} mood={mood} />
      <G stroke="#1D1D1D" strokeWidth={2.2} fill="none">
        <Circle cx={54} cy={60} r={8} />
        <Circle cx={76} cy={60} r={8} />
        <Path d="M62 60 L68 60" />
      </G>
    </Svg>
  );
}
