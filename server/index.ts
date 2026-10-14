import { createApp } from './app.js';
import { config } from './config.js';
const server = createApp().listen(config.port, config.host, () =>
  console.log(`Application Studio API: http://${config.host}:${config.port}`),
);
server.requestTimeout = 360000;
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => server.close(() => process.exit(0)));
