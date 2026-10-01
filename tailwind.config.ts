import type { Config } from "tailwindcss";
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  safelist: ["text-right"],
  darkMode: "class",
  theme: { extend: {} },
  plugins: []
} satisfies Config;
