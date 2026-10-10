/* eslint-env jest */
// Native-only modules have no implementation under Jest; give tests a harmless stand-in.
jest.mock('react-native-nitro-sound', () => {
  const noop = () => Promise.resolve('');
  return {
    createSound: () => ({
      startRecorder: noop,
      stopRecorder: noop,
      startPlayer: noop,
      stopPlayer: noop,
      setSubscriptionDuration: () => undefined,
      addRecordBackListener: () => undefined,
      removeRecordBackListener: () => undefined,
      addPlayBackListener: () => undefined,
      removePlayBackListener: () => undefined,
      addPlaybackEndListener: () => undefined,
      removePlaybackEndListener: () => undefined,
    }),
  };
});

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: () => Promise.resolve({ didCancel: true }),
  launchCamera: () => Promise.resolve({ didCancel: true }),
}));
