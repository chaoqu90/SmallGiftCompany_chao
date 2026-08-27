/**
 * Lambda entry point.
 * Wraps the Express app with serverless-http and exports the handler.
 *
 * The app is created once at module scope — reused across warm invocations.
 * This file is the esbuild entry point (see esbuild.config.js).
 */
import serverlessHttp from 'serverless-http';
import { createApp } from './app.js';

// Create once at module scope — reused on warm Lambda invocations
const app = createApp();

export const handler = serverlessHttp(app);
