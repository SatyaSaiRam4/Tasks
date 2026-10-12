module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      // The 3D pages (bundled into assets/web) run in a browser WebView.
      files: ['web/**/*.js'],
      env: { browser: true },
    },
  ],
};
