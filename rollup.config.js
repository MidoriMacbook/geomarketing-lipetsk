import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';

const material = {
  input: 'scripts/frontend/material-web-entry.js',
  output: {
    file: 'static/vendor/material-web/material-components.js',
    format: 'es',
    sourcemap: false,
  },
  plugins: [nodeResolve({ browser: true })],
  treeshake: true,
};

const hero = {
  input: 'scripts/frontend/hero-entry.js',
  output: {
    file: 'static/vendor/hero/hero-motion.js', format: 'es', sourcemap: false,
    banner: '/*! GeoMarketing hero: React Bits adaptations; see LICENSES.txt and SOURCES.md. */',
  },
  plugins: [
    replace({preventAssignment:true,'process.env.NODE_ENV':JSON.stringify('production')}),
    nodeResolve({browser:true}), commonjs(),
    terser({format:{comments:/^!|@license|@preserve/}}),
  ],
  treeshake:true,
  onwarn(warning,warn) {
    if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('use client')) return;
    warn(warning);
  },
};

export default args => args.configHero ? hero : material;
