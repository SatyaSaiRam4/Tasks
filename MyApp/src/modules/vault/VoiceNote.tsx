import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Toast from '@ant-design/react-native/lib/toast';
type SoundType = ReturnType<typeof import('react-native-nitro-sound').createSound>;
import { useAppSelector } from '../../app/hooks';
import { colors, font, radius, spacing, type as t, withAlpha } from '../../theme';
import { Icon } from '../../components/Icon';
import { API_BASE_URL } from '../../config/env';
import { selectVaultToken } from './vaultSlice';
import { touchVault } from './VaultAutoLock';

/** Longest recording, in seconds (the server accepts about 4 MB). */
const MAX_SECONDS = 4 * 60;

export interface Recording {
  uri: string;
  seconds: number;
}

/**
 * The recorder/player, created on first use. If this build of the app was
 * made without the audio module (an old install), there is none, and the
 * note screen simply hides voice notes instead of failing.
 */
function makeSound(): SoundType | null {
  try {
    const { createSound } = require('react-native-nitro-sound') as typeof import('react-native-nitro-sound');
    return createSound();
  } catch {
    return null;
  }
}

const clock = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;

async function micAllowed() {
  if (Platform.OS !== 'android') return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    title: 'Record a voice note',
    message: 'Memo needs the microphone to record voice notes. They stay private in your Vault.',
    buttonPositive: 'Allow',
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * A note's voice recording: record (up to 4 minutes), play it back, record
 * again or remove it. A saved recording is streamed from the server with the
 * Vault session; a new one plays from the phone until the note is saved.
 */
export function VoiceNote({
  entryId,
  savedSeconds,
  recording,
  removed,
  onRecorded,
  onRemove,
  disabled,
}: {
  entryId?: string;
  /** Length of the recording already saved with the note, if any. */
  savedSeconds: number | null;
  /** A new recording waiting to be saved. */
  recording: Recording | null;
  /** The saved recording is marked for removal. */
  removed: boolean;
  onRecorded: (r: Recording) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const soundRef = useRef<SoundType | null | undefined>(undefined);
  if (soundRef.current === undefined) soundRef.current = makeSound();
  const sound = soundRef.current;
  const accessToken = useAppSelector(s => s.auth.accessToken);
  const vaultToken = useAppSelector(selectVaultToken);
  const [state, setState] = useState<'idle' | 'recording' | 'playing'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [position, setPosition] = useState(0);
  const pulse = useRef(new Animated.Value(0)).current;
  const elapsedRef = useRef(0);

  const hasSaved = savedSeconds !== null && !removed && entryId;
  const length = recording?.seconds ?? (hasSaved ? savedSeconds! : 0);

  useEffect(() => {
    if (!sound) return;
    return () => {
      sound.removeRecordBackListener();
      sound.removePlayBackListener();
      sound.removePlaybackEndListener();
      sound.stopRecorder().catch(() => undefined);
      sound.stopPlayer().catch(() => undefined);
    };
  }, [sound]);

  useEffect(() => {
    if (state !== 'recording') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state, pulse]);

  const stopRecording = async () => {
    if (!sound) return;
    sound.removeRecordBackListener();
    try {
      const uri = await sound.stopRecorder();
      setState('idle');
      onRecorded({ uri, seconds: Math.max(1, Math.round(elapsedRef.current)) });
    } catch {
      setState('idle');
    }
  };

  const startRecording = async () => {
    if (!sound) return;
    touchVault();
    if (!(await micAllowed())) {
      Toast.info('Allow the microphone in your phone’s settings to record.', 2.5);
      return;
    }
    try {
      await sound.stopPlayer().catch(() => undefined);
      setElapsed(0);
      elapsedRef.current = 0;
      sound.setSubscriptionDuration(0.25);
      sound.addRecordBackListener(meta => {
        const secs = meta.currentPosition / 1000;
        elapsedRef.current = secs;
        setElapsed(secs);
        if (secs >= MAX_SECONDS) stopRecording();
      });
      await sound.startRecorder();
      setState('recording');
    } catch {
      Toast.fail('Could not start recording.', 2);
    }
  };

  const play = async () => {
    if (!sound) return;
    touchVault();
    try {
      sound.addPlayBackListener(meta => setPosition(meta.currentPosition / 1000));
      sound.addPlaybackEndListener(() => {
        setState('idle');
        setPosition(0);
      });
      if (recording) {
        await sound.startPlayer(recording.uri);
      } else {
        await sound.startPlayer(`${API_BASE_URL}/vault/entries/${entryId}/audio`, {
          authorization: `Bearer ${accessToken ?? ''}`,
          'x-vault-token': vaultToken ?? '',
        });
      }
      setState('playing');
    } catch {
      Toast.fail('Could not play this recording.', 2);
    }
  };

  const stopPlaying = async () => {
    await sound?.stopPlayer().catch(() => undefined);
    setState('idle');
    setPosition(0);
  };

  // An install without the audio module: no voice notes, everything else works.
  if (!sound) return null;

  if (state === 'recording') {
    return (
      <View style={[styles.card, styles.recording]}>
        <Animated.View style={[styles.dot, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }]} />
        <View style={styles.flex}>
          <Text style={styles.title}>Recording…</Text>
          <Text style={t.caption}>
            {clock(elapsed)} of {clock(MAX_SECONDS)}
          </Text>
        </View>
        <Pressable onPress={stopRecording} style={[styles.round, styles.stop]} accessibilityRole="button" accessibilityLabel="Stop recording">
          <Icon name="stop" size={18} color="#ffffff" />
        </Pressable>
      </View>
    );
  }

  if (recording || hasSaved) {
    const playing = state === 'playing';
    return (
      <View style={styles.card}>
        <Pressable
          onPress={playing ? stopPlaying : play}
          style={[styles.round, styles.play]}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Stop playing' : 'Play voice note'}
        >
          <Icon name={playing ? 'pause' : 'play'} size={18} color={colors.onPrimary} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.title}>Voice note{recording ? ' · not saved yet' : ''}</Text>
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${length ? Math.min(100, (100 * position) / length) : 0}%` }]} />
          </View>
          <Text style={t.caption}>{playing ? `${clock(position)} / ${clock(length)}` : clock(length)}</Text>
        </View>
        {disabled ? null : (
          <>
            <Pressable onPress={startRecording} hitSlop={8} style={styles.small} accessibilityRole="button" accessibilityLabel="Record again">
              <Icon name="mic" size={18} color={colors.violet} />
            </Pressable>
            <Pressable onPress={onRemove} hitSlop={8} style={styles.small} accessibilityRole="button" accessibilityLabel="Remove voice note">
              <Icon name="trash" size={17} color={colors.danger} />
            </Pressable>
          </>
        )}
      </View>
    );
  }

  if (disabled) return null;
  return (
    <Pressable onPress={startRecording} style={({ pressed }) => [styles.card, styles.empty, pressed && styles.pressed]} accessibilityRole="button">
      <View style={[styles.round, styles.mic]}>
        <Icon name="mic" size={18} color={colors.violet} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.title}>Add a voice note</Text>
        <Text style={t.caption}>Speak instead of typing · up to 4 minutes</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha(colors.violet, 0.35),
  },
  empty: {
    borderStyle: 'dashed',
  },
  recording: {
    borderColor: colors.danger,
  },
  title: {
    ...font.semibold,
    fontSize: 14.5,
    color: colors.text,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mic: {
    backgroundColor: withAlpha(colors.violet, 0.14),
  },
  play: {
    backgroundColor: colors.primary,
  },
  stop: {
    backgroundColor: colors.danger,
  },
  small: {
    padding: spacing.xs,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: spacing.sm,
    backgroundColor: colors.danger,
  },
  track: {
    height: 4,
    borderRadius: 2,
    marginVertical: 6,
    backgroundColor: colors.glassStrong,
    overflow: 'hidden',
  },
  trackFill: {
    height: 4,
    backgroundColor: colors.violet,
  },
});
