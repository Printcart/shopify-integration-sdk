import replace from '@rollup/plugin-replace';
import { terser } from 'rollup-plugin-terser';
import dotenv from 'dotenv';

dotenv.config();

const dev = (process.env.NODE_ENV !== 'production');

export default {
  input: "main.js",
  output: {
    dir: 'dist',
    format: "iife",
  },
  plugins: [
    replace({
      __SDK_URL__: JSON.stringify(process.env.SDK_URL),
      __API_URL__: JSON.stringify(process.env.API_URL),
      __CUSTOMIZER_URL__: JSON.stringify(process.env.CUSTOMIZER_URL),
    }),
    terser({
      ecma: 2018,
      mangle: { toplevel: true },
      compress: {
        module: true,
        toplevel: true,
        unsafe_arrows: true,
        drop_console: !dev,
        drop_debugger: !dev
      },
      output: { quote_style: 1 }
    })
  ]
};
