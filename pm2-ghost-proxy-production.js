{
  "name": "ghost-proxy",
  "script": "index.js",
  "args": [
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "max_memory_restart" : "200M",
  "treekill": true,
  "restart_delay": 5000,
  "out_file": "/dev/null"
}
