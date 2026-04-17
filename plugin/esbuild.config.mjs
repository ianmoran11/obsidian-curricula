import * as esbuild from 'esbuild';

const isProd = process.env.NODE_ENV === 'production';

esbuild.build({
  entryPoints: ['main.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outdir: 'dist',
  external: ['obsidian'],
  minify: isProd,
  sourcemap: !isProd,
}).catch(() => process.exit(1));