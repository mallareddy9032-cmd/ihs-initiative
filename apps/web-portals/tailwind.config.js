/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'ihs-red': '#B91C1C',
        'ihs-monitor': '#00FF00',
      },
    },
  },
  plugins: [],
};
