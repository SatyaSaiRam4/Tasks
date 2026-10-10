module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-async-storage|react-native-safe-area-context|react-native-screens|react-native-svg|react-native-webview|@react-navigation|@ant-design|@reduxjs/toolkit|react-redux|immer|redux|react-clone-referenced-element|@react-native-community)/)',
  ],
};
