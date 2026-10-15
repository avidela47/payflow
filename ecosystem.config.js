module.exports = {
  apps: [
    {
      name: "payflow",
      cwd: "/var/www/payflow",
      script: "npm",
      args: "run start -- -p 3001",
      env: { NODE_ENV: "production" },
    },
  ],
};
