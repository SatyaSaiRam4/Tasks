# Memo brand files

A gold monogram **M** with a sparkle, on deep midnight (dark) or warm ivory (light).

## App icon (`app-icon/`)
| File | Use |
|---|---|
| `memo-app-icon-dark-1024.png` | **The app's icon** (installed on Android and iOS). Full square, no transparency: App Store and other stores round the corners themselves. |
| `memo-app-icon-light-1024.png` | Light version, for light listings, websites or print. |
| `memo-app-icon-*-rounded-1024.png` | Rounded previews to share or show. |
| `memo-play-store-dark-512.png` | Google Play listing icon (512 × 512). The light one is an alternative. |

## Logo (`logo/`), transparent PNGs
| File | Use |
|---|---|
| `memo-logo-for-dark-backgrounds.png` | Mark + “Memo” on dark backgrounds. |
| `memo-logo-for-light-backgrounds.png` | Mark + “Memo” on light backgrounds (navy type, deeper gold). |
| `memo-logo-stacked-for-*-backgrounds.png` | Mark above “Memo” (splash, sign-in, posters). |
| `memo-mark-for-*-backgrounds.png` | The M alone (avatars, favicons, watermarks). |
| `memo-logo-on-dark.png`, `memo-logo-on-light.png` | The logo on its background, ready to use as banners. |

## Android (`android/`)
Adaptive-icon layers (432 × 432): foreground, background, and monochrome for Android 13+ themed icons. Already installed in `MyApp/android/app/src/main/res`.

## Editing (`source/`)
SVG sources and `make_brand.py`, which draws everything and renders the PNGs with headless Chrome:
`python3 make_brand.py <out_dir> ../../MyApp/assets/fonts`. The wordmark uses Cormorant Garamond SemiBold Italic (in `MyApp/assets/fonts`); open the SVGs with that font installed.
