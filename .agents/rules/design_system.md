# Antigravity Design System & UI Standards

> Enforces modern, premium glassmorphism styling and responsive layout rules across all frontend UI components.

---

## 🎨 Color Palette & Tokens
- **Background**: `#0f172a` (Slate 900) with subtle radial gradient overlays (`rgba(59, 130, 246, 0.15)` & `rgba(16, 185, 129, 0.15)`).
- **Cards**: `background: rgba(30, 41, 59, 0.75); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 16px;`.
- **Accents**:
  - Buying / Positive: `#10b981` (Emerald 500)
  - Selling / Negative: `#ef4444` (Red 500)
  - Neutral / Info: `#3b82f6` (Blue 500)
  - Warning / Caution: `#f59e0b` (Amber 500)
- **Typography**: Primary font `'Inter', sans-serif` via Google Fonts. Headings use linear gradient text (`linear-gradient(135deg, #60a5fa, #34d399)`).

---

## ⚡ Interactive UX Rules
1. **Hover Micro-Animations**: Interactive cards & buttons must include smooth transitions (`transition: all 0.2s ease; transform: translateY(-2px);`).
2. **No Generic Colors or Browser Defaults**: Never use plain red, blue, or default browser buttons. Use curated HSL gradients and custom buttons (`box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3)`).
3. **No Placeholders**: Always populate realistic dynamic data or mock telemetry.
4. **Responsive Layout Grid**: Use CSS Grid / Flexbox (`grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))`).
