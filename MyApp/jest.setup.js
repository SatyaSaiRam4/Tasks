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

// Google sign-in is native; tests never reach Google.
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() => Promise.resolve({ type: 'cancelled', data: null })),
    signOut: jest.fn(() => Promise.resolve(null)),
  },
  isSuccessResponse: response => response && response.type === 'success',
  isErrorWithCode: error => Boolean(error && error.code),
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED', IN_PROGRESS: 'IN_PROGRESS', PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE' },
}));
