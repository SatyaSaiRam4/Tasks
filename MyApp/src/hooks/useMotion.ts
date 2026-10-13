import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useAppSelector } from '../app/hooks';

let systemReduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then(v => {
    systemReduceMotion = v;
  })
  .catch(() => undefined);

/**
 * Whether non-essential animation should play. Respects the device's
 * Reduce Motion setting and the user's own Animations / Reduced motion
 * settings (mirrored into the preferences slice from /users/me).
 */
export function useMotion(): { reduced: boolean; system: boolean } {
  const prefs = useAppSelector(s => s.preferences);
  const [system, setSystem] = useState(systemReduceMotion);

  useEffect(() => {
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', v => {
      systemReduceMotion = v;
      setSystem(v);
    });
    return () => sub.remove();
  }, []);

  // `system`: the phone's own Remove animations / Reduce motion, for the few
  // moments that play even when Memo's own animations are turned down.
  return { reduced: system || prefs.reducedMotion || !prefs.animationsEnabled, system };
}
