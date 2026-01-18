/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {
      base: import.meta.dirname,
    },
    autoprefixer: {},
  },
};

export default config;
