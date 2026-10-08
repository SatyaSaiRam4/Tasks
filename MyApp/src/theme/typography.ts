/**
 * Type system: Cormorant Garamond for display (editorial, high-contrast
 * serif) and Manrope for UI text (calm, geometric sans).
 *
 * The font files live in MyApp/assets/fonts, which Android bundles as
 * assets/fonts (see android/app/build.gradle). Each weight is its own file,
 * named by its PostScript name, so the family + matching weight always
 * resolves to a real face rather than a synthesized one. iOS uses the
 * platform's own faces until the fonts are linked into the Xcode project.
 */
import { Platform, type TextStyle } from 'react-native';

type SansWeight = '400' | '500' | '600' | '700' | '800';
type SerifWeight = '500' | '600' | '700';

const BUNDLED = Platform.OS !== 'ios';

const SANS: Record<SansWeight, string> = {
  '400': 'Manrope-Regular',
  '500': 'Manrope-Medium',
  '600': 'Manrope-SemiBold',
  '700': 'Manrope-Bold',
  '800': 'Manrope-ExtraBold',
};
const SERIF: Record<SerifWeight, string> = {
  '500': 'CormorantGaramond-Medium',
  '600': 'CormorantGaramond-SemiBold',
  '700': 'CormorantGaramond-Bold',
};
const SERIF_ITALIC: Record<'500' | '600', string> = {
  '500': 'CormorantGaramond-MediumItalic',
  '600': 'CormorantGaramond-SemiBoldItalic',
};

/** Some serif faces default to old-style figures; numbers must read as numbers. */
const LINING: TextStyle['fontVariant'] = ['lining-nums'];

export function sansFace(weight: SansWeight = '400'): TextStyle {
  return { fontFamily: BUNDLED ? SANS[weight] : 'System', fontWeight: weight };
}

export function serifFace(weight: SerifWeight = '600', italic = false): TextStyle {
  if (!BUNDLED) {
    return { fontFamily: 'Georgia', fontWeight: weight, fontStyle: italic ? 'italic' : 'normal', fontVariant: LINING };
  }
  const family = italic ? SERIF_ITALIC[weight === '700' ? '600' : weight] : SERIF[weight];
  return { fontFamily: family, fontWeight: weight === '700' && italic ? '600' : weight, fontStyle: italic ? 'italic' : 'normal', fontVariant: LINING };
}

/** Family names, for the rare place that needs only the family. */
export const fonts = {
  display: BUNDLED ? SERIF['600'] : 'Georgia',
  sans: BUNDLED ? SANS['400'] : 'System',
};

export const fontSize = {
  micro: 10.5,
  caption: 13,
  body: 15,
  subtitle: 16,
  heading: 23,
  title: 30,
  display: 40,
  hero: 64,
} as const;

/** Font family + weight for one-off styles, so nothing falls back to the system face. */
export const font = {
  regular: sansFace('400'),
  medium: sansFace('500'),
  semibold: sansFace('600'),
  bold: sansFace('700'),
  heavy: sansFace('800'),
  serifMedium: serifFace('500'),
  serif: serifFace('600'),
  serifBold: serifFace('700'),
  serifItalic: serifFace('500', true),
};
