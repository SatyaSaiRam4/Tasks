import React, { useId } from 'react';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * Full-colour, shaded icons for the places that deserve a "real" object
 * rather than a line drawing: the streak flame, the wallet coin, the
 * reminder bell, a category's target, the trophy, the vault lock, and the
 * home, profile and wallet of the navigation. They
 * are self-coloured, so they read the same on the dark and light themes.
 */
export type RealIconName = 'flame' | 'coin' | 'bell' | 'target' | 'trophy' | 'lock' | 'home' | 'user' | 'wallet' | 'check';

export function RealIcon({ name, size = 28 }: { name: RealIconName; size?: number }) {
  const id = useId().replace(/:/g, '');
  const g = (k: string) => `url(#${k}${id})`;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {name === 'flame' ? (
        <>
          <Defs>
            <LinearGradient id={`fo${id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFB23E" />
              <Stop offset="0.55" stopColor="#FF5A1F" />
              <Stop offset="1" stopColor="#D41B0E" />
            </LinearGradient>
            <LinearGradient id={`fi${id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFF6B0" />
              <Stop offset="1" stopColor="#FFC22E" />
            </LinearGradient>
          </Defs>
          <Path
            d="M24 3c2 7 10 11 12 20 2 9-3 21-12 21S10 37 11 28c.6-6 4-9 6-12 .4 4 2 6 4 7-1-7 0-14 3-20z"
            fill={g('fo')}
          />
          <Path d="M24 22c1 4 6 6 6 12 0 4-3 8-6 8s-6-3-6-7c0-4 3-6 4-9 .3 2 1 3 2 3-.5-2-.4-5 0-7z" fill={g('fi')} />
          <Ellipse cx="27" cy="20" rx="1.8" ry="4" fill="#FFFFFF" opacity={0.3} transform="rotate(20 27 20)" />
        </>
      ) : name === 'coin' ? (
        <>
          <Defs>
            <RadialGradient id={`c${id}`} cx="35%" cy="30%" r="75%">
              <Stop offset="0" stopColor="#FFF4BF" />
              <Stop offset="0.55" stopColor="#F2C230" />
              <Stop offset="1" stopColor="#B07A0C" />
            </RadialGradient>
          </Defs>
          <Circle cx="24" cy="25" r="20" fill="#9A6808" />
          <Circle cx="24" cy="23" r="20" fill={g('c')} />
          <Circle cx="24" cy="23" r="15" fill="none" stroke="#C99317" strokeWidth={1.6} />
          <Path d="M18 15h12M18 20h12M18 15c7 0 9 4 9 6s-3 5-9 5l10 9" stroke="#8A5A06" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Ellipse cx="16" cy="12" rx="5" ry="2.5" fill="#FFFFFF" opacity={0.45} transform="rotate(-30 16 12)" />
        </>
      ) : name === 'bell' ? (
        <>
          <Defs>
            <LinearGradient id={`b${id}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFE38A" />
              <Stop offset="0.6" stopColor="#F5A623" />
              <Stop offset="1" stopColor="#C46F0B" />
            </LinearGradient>
          </Defs>
          <Circle cx="24" cy="41" r="4.5" fill="#B5620A" />
          <Path d="M24 5c-8 0-13 6-13 14v8l-4 6c-1 1.5 0 3 2 3h30c2 0 3-1.5 2-3l-4-6v-8c0-8-5-14-13-14z" fill={g('b')} />
          <Rect x="21.5" y="2" width="5" height="5" rx="2.5" fill="#D4860F" />
          <Path d="M15 18c0-5 3-8 7-9" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={2.4} strokeLinecap="round" fill="none" />
        </>
      ) : name === 'target' ? (
        <>
          <Circle cx="24" cy="25" r="20" fill="#A3122A" />
          <Circle cx="24" cy="23" r="20" fill="#F23B4E" />
          <Circle cx="24" cy="23" r="14.5" fill="#FFFFFF" />
          <Circle cx="24" cy="23" r="9.5" fill="#F23B4E" />
          <Circle cx="24" cy="23" r="4.5" fill="#FFFFFF" />
          <Path d="M24 23 L41 6" stroke="#5B3A1A" strokeWidth={2.4} strokeLinecap="round" />
          <Path d="M38 4l5 1-1 5-4 1-1-4z" fill="#2E9BF0" />
          <Ellipse cx="15" cy="11" rx="5" ry="2.2" fill="#FFFFFF" opacity={0.35} transform="rotate(-35 15 11)" />
        </>
      ) : name === 'trophy' ? (
        <>
          <Defs>
            <LinearGradient id={`t${id}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFF0A0" />
              <Stop offset="0.5" stopColor="#F4B92E" />
              <Stop offset="1" stopColor="#B0730A" />
            </LinearGradient>
          </Defs>
          <Path d="M13 8H5c0 9 4 14 10 15M35 8h8c0 9-4 14-10 15" stroke="#D49A1C" strokeWidth={3} fill="none" />
          <Path d="M12 5h24v10c0 9-5 15-12 15S12 24 12 15z" fill={g('t')} />
          <Rect x="20" y="29" width="8" height="7" fill="#C98A14" />
          <Rect x="14" y="36" width="20" height="7" rx="2" fill="#6B3E12" />
          <Path d="M17 10v6c0 4 2 7 5 8" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={2.2} strokeLinecap="round" fill="none" />
        </>
      ) : name === 'check' ? (
        <>
          <Defs>
            <RadialGradient id={`k${id}`} cx="35%" cy="30%" r="75%">
              <Stop offset="0" stopColor="#7DF0A8" />
              <Stop offset="0.6" stopColor="#22B45E" />
              <Stop offset="1" stopColor="#0E7A3B" />
            </RadialGradient>
          </Defs>
          <Circle cx="24" cy="26" r="20" fill="#0A5A2B" />
          <Circle cx="24" cy="24" r="20" fill={g('k')} />
          <Path d="M14 24.5l6.5 6.5L34 17.5" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Ellipse cx="16" cy="13" rx="6" ry="3" fill="#FFFFFF" opacity={0.35} transform="rotate(-30 16 13)" />
        </>
      ) : name === 'home' ? (
        <>
          <Defs>
            <LinearGradient id={`h${id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FF7A59" />
              <Stop offset="1" stopColor="#D8432A" />
            </LinearGradient>
          </Defs>
          <Rect x="10" y="21" width="28" height="22" rx="3" fill="#F7E7C6" />
          <Path d="M4 24 24 6l20 18-3 3L24 12 7 27z" fill={g('h')} />
          <Rect x="20" y="30" width="8" height="13" rx="1.5" fill="#8A5A2B" />
          <Rect x="13" y="26" width="5" height="5" rx="1" fill="#6EC3FF" />
          <Rect x="30" y="26" width="5" height="5" rx="1" fill="#6EC3FF" />
          <Rect x="32" y="8" width="5" height="10" fill="#B4472F" />
        </>
      ) : name === 'user' ? (
        <>
          <Defs>
            <LinearGradient id={`u${id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#7FB8FF" />
              <Stop offset="1" stopColor="#3D6FE0" />
            </LinearGradient>
            <RadialGradient id={`uf${id}`} cx="40%" cy="35%" r="70%">
              <Stop offset="0" stopColor="#FFE2C4" />
              <Stop offset="1" stopColor="#E8A877" />
            </RadialGradient>
          </Defs>
          <Path d="M7 44c0-10 8-16 17-16s17 6 17 16z" fill={g('u')} />
          <Circle cx="24" cy="16" r="10" fill={g('uf')} />
          <Path d="M14 15c0-7 5-10 10-10s10 3 10 9c-3-3-7-4-10-4s-7 2-10 5z" fill="#5A3A22" />
        </>
      ) : name === 'wallet' ? (
        <>
          <Defs>
            <LinearGradient id={`w${id}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#B4774A" />
              <Stop offset="1" stopColor="#6E3F1E" />
            </LinearGradient>
          </Defs>
          <Rect x="9" y="7" width="26" height="14" rx="2" fill="#4FBF73" transform="rotate(-8 22 14)" />
          <Rect x="5" y="13" width="38" height="28" rx="5" fill={g('w')} />
          <Path d="M30 22h13v12H30a6 6 0 0 1 0-12z" fill="#5A3217" />
          <Circle cx="31" cy="28" r="2.6" fill="#F2C230" />
          <Rect x="8" y="16" width="20" height="2.4" rx="1.2" fill="#FFFFFF" opacity={0.2} />
        </>
      ) : (
        <>
          <Defs>
            <LinearGradient id={`l${id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#B58CFF" />
              <Stop offset="1" stopColor="#5B2DCC" />
            </LinearGradient>
          </Defs>
          <Path d="M15 21v-6a9 9 0 0 1 18 0v6" stroke="#9AA3B2" strokeWidth={4.5} fill="none" strokeLinecap="round" />
          <Rect x="8" y="20" width="32" height="25" rx="6" fill={g('l')} />
          <Circle cx="24" cy="30" r="3.6" fill="#2A1466" />
          <Rect x="22.6" y="31" width="2.8" height="7" rx="1.4" fill="#2A1466" />
          <Rect x="11" y="23" width="26" height="3" rx="1.5" fill="#FFFFFF" opacity={0.25} />
        </>
      )}
    </Svg>
  );
}
