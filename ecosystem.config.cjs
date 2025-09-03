module.exports = {
  apps: [{
    name: 'dscribe',
    script: 'server/index.js',
    cwd: '/home/pi/dScribe',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3005
    },
    error_file: './storage/logs/err.log',
    out_file: './storage/logs/out.log',
    log_file: './storage/logs/combined.log',
    time: true,
    max_memory_restart: '512M',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
