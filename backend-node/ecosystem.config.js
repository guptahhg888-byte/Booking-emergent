module.exports = {
  apps: [
    {
      name: 'booking-emergent',
      script: 'dist/index.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
