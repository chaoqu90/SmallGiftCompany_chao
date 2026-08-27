import { build } from 'esbuild';

await build({
  entryPoints: ['src/lambda.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: 'dist/lambda.js',
  // postgres.js uses native ESM and dynamic imports — do not bundle it
  external: ['postgres'],
  // Minify for faster cold starts
  minify: false,
  sourcemap: true,
  banner: {
    // Required for ESM Lambda bundles that use __dirname / __filename
    js: "import { createRequire } from 'module'; import { fileURLToPath } from 'url'; import { dirname } from 'path'; const require = createRequire(import.meta.url); const __filename = fileURLToPath(import.meta.url); const __dirname = dirname(__filename);",
  },
});

console.log('Build complete: dist/lambda.js');
