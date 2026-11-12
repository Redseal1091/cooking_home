import type { Config } from 'tailwindcss';
import sharedPreset from '../../packages/shared/tailwind.preset';

export default {
  presets: [sharedPreset],
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
} satisfies Config;
