import { useEffect, useState } from 'react';
import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateWidgetWeather } from '../../widget';

/**
 * The real weather where the user is, in Melo's corner on Home: it shows
 * lightly behind him and he tells the user about it in a caring way
 * ("It's raining in Hyderabad ☔ Take an umbrella").
 * The phone's rough location (city level, MemoLocationModule, which also
 * names the city) goes straight to Open-Meteo (free, no key), rounded to
 * about 1 km; Memo's server never sees it. Android asks for the location once; if the user says no, Home
 * simply shows no weather and Memo doesn't ask again. Kept for 30 minutes.
 */
export type WeatherKind = 'clear' | 'cloudy' | 'fog' | 'rain' | 'storm' | 'snow';

export interface Weather {
  kind: WeatherKind;
  isDay: boolean;
  temp: number;
  /** The town or city, when the phone can name it. */
  city?: string;
}

const CACHE_KEY = 'memo.weather.v2';
const ASKED_KEY = 'memo.weather.asked';
const FRESH_MS = 30 * 60 * 1000;

const native = NativeModules.MemoLocation as { approximate: () => Promise<{ latitude: number; longitude: number; city?: string } | null> } | undefined;

/** WMO weather codes (Open-Meteo) to the few looks Melo's stage has. */
function kindOf(code: number): WeatherKind {
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 2) return 'cloudy';
  return 'clear';
}

const WORDS: Record<WeatherKind, string> = { clear: 'Clear', cloudy: 'Cloudy', fog: 'Misty', rain: 'Rain', storm: 'Storm', snow: 'Snow' };

function icon(w: Weather): string {
  return { clear: w.isDay ? '☀️' : '🌙', cloudy: '☁️', fog: '🌫️', rain: '🌧️', storm: '⛈️', snow: '❄️' }[w.kind];
}

/** "☀️ 31° · Hyderabad": short, for the corner of Melo's stage. */
export function weatherLabel(w: Weather): string {
  return `${icon(w)} ${Math.round(w.temp)}°${w.city ? ` · ${w.city}` : ` ${WORDS[w.kind]}`}`;
}

/** What Melo says about the weather, kindly, like a friend would. */
export function weatherCare(w: Weather): string {
  const t = Math.round(w.temp);
  const at = w.city ? ` in ${w.city}` : '';
  if (w.kind === 'storm') return `A storm${at} right now ⛈️ Stay in if you can, and stay safe.`;
  if (w.kind === 'rain') return `It's raining${at} ☔ Take an umbrella and stay dry!`;
  if (w.kind === 'snow') return `Snow${at}, ${t}° ❄️ Wrap up warm today!`;
  if (w.kind === 'fog') return `Misty${at} 🌫️ Go slow if you're on the road.`;
  if (t <= 14) return `Chilly ${t}°${at} 🧣 Wear something warm today.`;
  if (w.kind === 'clear' && !w.isDay) return `A clear night${at}, ${t}° 🌙 Rest well after your day.`;
  if (t >= 35) return `${t}°${at}, very hot 🥵 Drink lots of water and stay in the shade.`;
  if (t >= 30) return `Sunny and ${t}°${at} ☀️ Keep a water bottle with you.`;
  if (w.kind === 'clear') return `A lovely ${t}°${at} ☀️ Good day to get things done!`;
  return `Cloudy and ${t}°${at} ☁️ Cosy weather for your tasks.`;
}

async function hasPermission(): Promise<boolean> {
  const perm = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
  if (await PermissionsAndroid.check(perm)) return true;
  // Ask only once, ever: no nagging on every visit to Home.
  if (await AsyncStorage.getItem(ASKED_KEY)) return false;
  await AsyncStorage.setItem(ASKED_KEY, '1');
  const answer = await PermissionsAndroid.request(perm, {
    title: 'Weather on Home',
    message: 'Melo can show the weather where you are. Memo uses your rough location (city level) only for this.',
    buttonPositive: 'Allow',
    buttonNegative: 'No thanks',
  });
  return answer === PermissionsAndroid.RESULTS.GRANTED;
}

async function loadWeather(): Promise<Weather | null> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const { at, weather } = JSON.parse(cached) as { at: number; weather: Weather };
      if (Date.now() - at < FRESH_MS) return weather;
    }
    if (!(await hasPermission())) return null;
    const where = await native!.approximate();
    if (!where) return null;
    const lat = where.latitude.toFixed(2);
    const lon = where.longitude.toFixed(2);
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day`);
    if (!res.ok) return null;
    const body = (await res.json()) as { current?: { temperature_2m: number; weather_code: number; is_day: number } };
    if (!body.current) return null;
    const weather: Weather = {
      kind: kindOf(body.current.weather_code),
      isDay: body.current.is_day === 1,
      temp: body.current.temperature_2m,
      city: where.city || undefined,
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), weather }));
    return weather;
  } catch {
    return null; // no weather is fine; Melo carries on
  }
}

/** The weather for Home, or null (not allowed, offline, not Android). Checked again when `active` turns true after 30 minutes. */
export function useWeather(active: boolean): Weather | null {
  const [weather, setWeather] = useState<Weather | null>(null);
  useEffect(() => {
    if (!active || Platform.OS !== 'android' || !native) return;
    let live = true;
    loadWeather().then(w => {
      if (!w) return;
      updateWidgetWeather(weatherLabel(w)); // the home-screen widget shows it too
      if (live) setWeather(w);
    });
    return () => {
      live = false;
    };
  }, [active]);
  return weather;
}
