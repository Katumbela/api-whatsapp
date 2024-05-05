module.exports = {
    apps : [{
      name: "crm-360 wwebjs",
      script: "app-multiple-account.js",
      watch: true,
      ignore_watch : ["node_modules"],
      env: {
        PORT: 8000
      }
    }]
  }
  