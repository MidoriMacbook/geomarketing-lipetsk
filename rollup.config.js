import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
  input: 'scripts/frontend/material-web-entry.js',
  output: {
    file: 'static/vendor/material-web/material-components.js',
    format: 'es',
    sourcemap: false,
  },
  plugins: [nodeResolve({ browser: true })],
  treeshake: true,
};
