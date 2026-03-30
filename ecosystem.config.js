module.exports = {
  apps: [{
    name: 'bounty-pavilion',
    script: 'server.js',
    
    // 实例数量
    instances: 'max',  // 使用所有CPU核心
    exec_mode: 'cluster',  // 集群模式
    
    // 环境变量
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // 日志配置
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    
    // 自动重启
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'uploads', '*.db'],
    max_memory_restart: '1G',  // 内存超过1GB自动重启
    
    // 启动设置
    listen_timeout: 10000,
    kill_timeout: 5000,
    
    // 错误处理
    stop_exit_codes: [0],
    
    // 重启策略
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s',
    
    // 监控
    monitoring: true
  }],
  
  deploy: {
    production: {
      user: 'root',
      host: 'your-server-ip',
      ref: 'origin/master',
      repo: 'https://github.com/Cirrogent/bounty-pavilion.git',
      path: '/var/www/bounty-pavilion',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
