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
        // HealthWeave brand palette (matches Magic Patterns design)
        "hw-navy-dark":  "#1C466A",
        "hw-navy":       "#29628B",
        "hw-teal":       "#4693C3",
        "hw-teal-light": "#8CBEDC",
        // Legacy aliases kept for backwards compat
        primary: {
          dark:    "#1C466A",
          DEFAULT: "#29628B",
          light:   "#4693C3",
        },
        accent: {
          DEFAULT: "#4693C3",
          light:   "#8CBEDC",
        },
      },
      fontFamily: {
        sans:    ["Geist", "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        heading: ["Geist", "Plus Jakarta Sans", "sans-serif"],
        mono:    ['"Geist Mono"', "ui-monospace", "monospace"],
      },
      animation: {
        "fade-in-up": "fadeInUp 0.45s ease both",
        "ping-slow":  "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite",
        shimmer:      "shimmer 1.6s linear infinite",
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(14px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
      },
      backdropBlur: {
        xs: "4px",
      },
    },
  },
  plugins: [],
} satisfies Config;
