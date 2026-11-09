/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"] },
      colors: {
        page: "var(--bg-page)",
        surface: "var(--bg-surface)",
        subtle: "var(--bg-subtle)",
        line: "var(--border)",
        ink: "var(--text-primary)",
        body: "var(--text-secondary)",
        muted: "var(--text-muted)",
        brand: { DEFAULT: "var(--brand)", dark: "var(--brand-dark)", soft: "var(--brand-soft)", line: "var(--brand-line)" },
        good: { DEFAULT: "var(--good)", soft: "var(--good-soft)" },
        warn: { DEFAULT: "var(--warn)", soft: "var(--warn-soft)" },
        bad: { DEFAULT: "var(--bad)", soft: "var(--bad-soft)" },
        info: { DEFAULT: "var(--info)", soft: "var(--info-soft)" },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)",
        lift: "0 8px 24px -8px rgba(16,24,40,0.12)",
      },
    },
  },
  plugins: [],
};
