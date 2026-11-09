/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"] },
      colors: {
        page: token("bg-page"),
        surface: token("bg-surface"),
        subtle: token("bg-subtle"),
        line: token("border"),
        ink: token("text-primary"),
        body: token("text-secondary"),
        muted: token("text-muted"),
        brand: { DEFAULT: token("brand"), dark: token("brand-dark"), soft: token("brand-soft"), line: token("brand-line") },
        good: { DEFAULT: token("good"), soft: token("good-soft") },
        warn: { DEFAULT: token("warn"), soft: token("warn-soft") },
        bad: { DEFAULT: token("bad"), soft: token("bad-soft") },
        info: { DEFAULT: token("info"), soft: token("info-soft") },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)",
        lift: "0 8px 24px -8px rgba(16,24,40,0.12)",
      },
    },
  },
  plugins: [],
};
