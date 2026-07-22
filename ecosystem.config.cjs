module.exports = {
  apps: [{
    name: 'deepfish-ai-server',
    script: './dist/serve/pm2-server.js',
    cwd: '../',
    node_args: '--no-warnings',
    env: {
      NODE_ENV: 'production',
      NODE_OPTIONS: '--no-warnings',
    },
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  }]
};
