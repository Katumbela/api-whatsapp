module.exports = {
    apps : [{
      name: "crm-360 wwebjs",
      script: "app-multiple-account.js",
      script: './server.js',
      max_memory_restart: '1G',
      cron_restart: '0 */24 * * *',
      watch: true,
      ignore_watch : ["node_modules"],
      env: {
        PORT: 8000
      }
    }]
  }
  