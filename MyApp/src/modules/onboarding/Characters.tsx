import React from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/**
 * The welcome story's cast, drawn in SVG so they stay sharp at any size and
 * need no image files: Aarav (a boy) and Mom (a woman in a kurta) for Part 1;
 * Satya (beard, glasses, a jacket) and Riya (long hair, top and jeans) for
 * Part 2. Each has a few moods.
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
}: {
  size?: number;
  mood?: Mood;
  colors?: [string, string];
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
      <Circle cx={65} cy={30} r={12} fill={hair} />
      <Circle cx={65} cy={48} r={2.2} fill="#C0392B" />
      <Circle cx={37} cy={72} r={3} fill="#E7C17A" />
      <Circle cx={93} cy={72} r={3} fill="#E7C17A" />
      <Face cx={65} cy={60} mood={mood} />
    </Svg>
  );
}

/** Satya: a young man with a neat beard and glasses, a navy jacket over a white shirt. */
export function Man({ size = 200, mood = 'happy' }: { size?: number; mood?: Mood }) {
  const skin = '#C98F66';
  const hair = '#161010';
  const jacket = '#2B3A5C';
  return (
    <Svg width={size * (130 / 240)} height={size} viewBox="0 0 130 240">
      <Ellipse cx={65} cy={232} rx={40} ry={6} fill="#000" opacity={0.25} />
      <Rect x={44} y={150} width={17} height={76} rx={7} fill="#3A3F4A" />
      <Rect x={69} y={150} width={17} height={76} rx={7} fill="#3A3F4A" />
      <Ellipse cx={52} cy={228} rx={12} ry={5} fill="#F2F2F2" />
      <Ellipse cx={78} cy={228} rx={12} ry={5} fill="#F2F2F2" />
      <Rect x={22} y={100} width={15} height={62} rx={7} fill={jacket} />
      <Rect x={93} y={100} width={15} height={62} rx={7} fill={jacket} />
      <Rect x={22} y={150} width={15} height={5} rx={2} fill="#D4AF6A" />
      <Circle cx={29} cy={165} r={7.5} fill={skin} />
      <Circle cx={101} cy={165} r={7.5} fill={skin} />
      <Rect x={58} y={84} width={14} height={18} fill={skin} />
      <Rect x={33} y={94} width={64} height={66} rx={20} fill={jacket} />
      <Path d="M52 96 L65 150 L78 96 Z" fill="#F2F4F7" />
      <Path d="M52 96 L60 118 L48 104 Z M78 96 L70 118 L82 104 Z" fill="#1B2438" />
      <Circle cx={37} cy={60} r={5} fill={skin} />
      <Circle cx={93} cy={60} r={5} fill={skin} />
      <Circle cx={65} cy={58} r={28} fill={skin} />
      {/* A short beard along the jaw, below the mouth. */}
      <Path d="M38 64 C40 84 52 90 65 90 C78 90 90 84 92 64 C88 76 80 82 65 82 C50 82 42 76 38 64 Z" fill="#3D2C24" />
      <Path d="M37 54 C35 26 95 26 93 54 C88 40 72 32 56 38 C46 40 40 46 37 54 Z" fill={hair} />
      <Path d="M48 36 C62 22 86 26 92 44 C80 34 64 32 48 36 Z" fill={hair} />
      <Face cx={65} cy={60} mood={mood} />
      <G stroke="#1D1D1D" strokeWidth={2.2} fill="none">
        <Circle cx={54} cy={60} r={8} />
        <Circle cx={76} cy={60} r={8} />
        <Path d="M62 60 L68 60" />
      </G>
    </Svg>
  );
}

/** Riya: a young woman with long open hair, a pink top, jeans and hoops. */
export function Girl({ size = 190, mood = 'happy' }: { size?: number; mood?: Mood }) {
  const skin = '#F0C4A0';
  const hair = '#3A2318';
  return (
    <Svg width={size * (130 / 240)} height={size} viewBox="0 0 130 240">
      <Ellipse cx={65} cy={232} rx={38} ry={6} fill="#000" opacity={0.25} />
      {/* Long hair falling behind the shoulders. */}
      <Path d="M35 50 C30 90 32 120 40 132 L90 132 C98 120 100 90 95 50 Z" fill={hair} />
      <Rect x={46} y={142} width={16} height={84} rx={7} fill="#3B5BA5" />
      <Rect x={68} y={142} width={16} height={84} rx={7} fill="#3B5BA5" />
      <Ellipse cx={54} cy={228} rx={11} ry={5} fill="#F2F2F2" />
      <Ellipse cx={76} cy={228} rx={11} ry={5} fill="#F2F2F2" />
      <Rect x={26} y={100} width={13} height={58} rx={6} fill="#E85D8A" />
      <Rect x={91} y={100} width={13} height={58} rx={6} fill="#E85D8A" />
      <Circle cx={32} cy={161} r={7} fill={skin} />
      <Circle cx={98} cy={161} r={7} fill={skin} />
      <Rect x={58} y={84} width={14} height={18} fill={skin} />
      <Rect x={36} y={94} width={58} height={56} rx={20} fill="#E85D8A" />
      <Path d="M56 95 Q65 104 74 95" stroke="#FFFFFF" strokeWidth={3} fill="none" />
      <Path d="M65 116 l3 6 6 .8-4.5 4.2 1 6.2-5.5-3-5.5 3 1-6.2-4.5-4.2 6-.8z" fill="#FFF1A8" />
      <Circle cx={65} cy={60} r={27} fill={skin} />
      <Path d="M37 60 C34 28 96 28 93 60 C92 46 84 36 70 36 C58 40 46 42 37 60 Z" fill={hair} />
      <Path d="M40 48 C50 30 74 30 82 40 C68 38 54 42 40 48 Z" fill={hair} />
      <Circle cx={37} cy={72} r={4} stroke="#E7C17A" strokeWidth={2} fill="none" />
      <Circle cx={93} cy={72} r={4} stroke="#E7C17A" strokeWidth={2} fill="none" />
      <Face cx={65} cy={61} mood={mood} />
    </Svg>
  );
}
