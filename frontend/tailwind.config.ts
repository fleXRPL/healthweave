import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          dark: '#1C466A',
          DEFAULT: '#29628B',
          light: '#4693C3',
        },
        accent: {
          DEFAULT: '#4693C3',
          light: '#8CBEDC',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
