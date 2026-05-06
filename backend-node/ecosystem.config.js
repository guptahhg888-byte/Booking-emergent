module.exports = {
  apps: [
    {
      name: 'mediconsult-api',
      script: 'dist/index.js',
      cwd: __dirname,
      env_file: '.env',
      node_args: '--env-file=.env',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
