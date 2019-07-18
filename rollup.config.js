import commonjs from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';
import resolve from 'rollup-plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';

const files = ['background', 'content'];

export default files.map(file => ({
  input: `src/${file}.ts`,
  output: {
    file: `dist/${file}.js`,
    format: 'iife'
  },
  context: '{}',
  plugins: [
    typescript({ typescript: require('typescript') }),
    json(),
    resolve(),
    commonjs()
  ]
}));
