module.exports = {
  apps: [
    {
      name: 'your-server-name',
      exec_mode: 'cluster',
      instances: 'max',
      script: './dist/index.js',
      watch: false,
      env: {
        ENV: 'development',
      },
      env_production: {
        ENV: 'production',
      },
    },
  ],
};
