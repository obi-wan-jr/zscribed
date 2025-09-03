module.exports = {
  apps: [{
    name: 'meatpi-bible-api',
    script: './server/index.js',
    cwd: '/home/inggo/dscribe',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3005
    },
    max_memory_restart: '256M',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
