/**
 * Local development entry point.
 * Starts the Express app on port 8080 with tsx hot reload.
 * Not used in Lambda — see lambda.ts.
 */
import { createApp } from './app.js';

const PORT = Number(process.env.PORT ?? 8080);

const app = createApp();
app.listen(PORT, () => {
  console.log(`[server] Listening on http://localhost:${PORT}`);
});
