# FLOW SOCIAL - App Design Language System

This design document serves as a comprehensive reference for the personal-manychat (Flow Social) design tokens, patterns, and component layouts. Every component created or redesigned in the app must align strictly with the principles outlined here to ensure visual consistency and a premium experience.

---

## 1. Typography & Font System
- **Core Font Family**: `'Inter', 'Geist', system-ui, sans-serif` (configured in `@theme` as `--font-sans`).
- **Heading Weight**: `font-black font-extrabold uppercase tracking-tight` (for pages and primary headers) or `font-bold` (for components).
- **Subheadings**: `font-semibold text-xs tracking-wider uppercase text-muted-foreground/60`.
- **Badges / Micro-Labels**: `text-[8px] or text-[9px] font-black uppercase tracking-widest`.
- **Primary Body Font**: `text-sm font-medium text-foreground`.

---

## 2. Color Palettes & Active Themes
The system is built on CSS variables in `globals.css` with 5 customized themes. The active theme is applied as a class on the `<html>` or `<body>` element.

### A. Default (Sleek Light Mode)
- **Background**: `#ffffff`
- **Card**: `#ffffff`
- **Surface**: `#f4f4f5` (Cool zinc gray)
- **Border**: `#e4e4e7` (Light gray)
- **Brand / Primary Accent**: `#6366f1` (Vibrant Indigo)
- **Success**: `#22c55e` (Emerald Green)

### B. Dark Mode (`.dark`) - *Screenshot Core Theme*
- **Background**: `#09090b` (Deep Zinc Black)
- **Card**: `#0f0f12` (Elevated dark card background)
- **Surface**: `#121215` (Deeper card-sub elements)
- **Border**: `#1f1f23` (Refined dark border)
- **Muted Foreground**: `#71717a`
- **Brand / Primary Accent**: `#6366f1` (Vibrant Indigo)
- **Success**: `#22c55e` (Emerald Green)
- **Glass BG**: `rgba(9, 9, 11, 0.4)`
- **Glass Border**: `rgba(255, 255, 255, 0.08)`

### C. Midnight (`.midnight`) - *True High-Contrast OLED Black*
- **Background**: `#000000`
- **Card**: `#000000`
- **Surface**: `#0a0a0a`
- **Border**: `#222222`
- **Glass BG**: `rgba(0, 0, 0, 0.5)`
- **Glass Border**: `rgba(255, 255, 255, 0.1)`

### D. Nature (`.nature`) - *Sophisticated Forest / Olive Greens*
- **Background**: `#fbfcf8`
- **Foreground / Primary**: `#1a2e1a` / `#2d4a2d`
- **Border**: `#d1d9cc`
- **Brand**: `#2d4a2d`

### E. Ocean (`.ocean`) - *Refined Deep Marine & Aqua Blues*
- **Background**: `#f0f4f8`
- **Foreground / Primary**: `#102a43` / `#243b53`
- **Border**: `#bcccdc`
- **Brand**: `#243b53`

---

## 3. Card Designs & Container Specifications
Our application uses two main card systems depending on the global settings (`data-glass` parameter):

### A. The Premium Card (`.premium-card` class)
- **Background**: `bg-card` / `--card`
- **Corner Radius**: `rounded-2xl` (`1rem` border radius)
- **Border**: `border border-border`
- **Padding**: `p-5` or `p-6`
- **Hover Micro-interaction**: 
  - `transition-all duration-300`
  - `hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 hover:scale-[1.002]`
  - Smooth scale and soft primary-accent glow.

### B. The Glassmorphism Card (`.glass-effect` utility)
When `[data-glass='true']` is active, the cards dynamically switch to:
- **Background**: `var(--glass-bg)` with `backdrop-filter: blur(12px)`
- **Border**: `1px solid var(--glass-border)`
- **Shadow**: `box-shadow: 0 4px 30px rgba(0, 0, 0, 0.05)`

---

## 4. Button & Interaction Design Language
Buttons must feel extremely tactile, premium, and dynamic:

### A. Primary Call-To-Action (CTA) Button
- **Classes**: `rounded-xl h-10 px-4 gap-2 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer`
- **Key Characteristics**:
  - `rounded-xl` corner radius.
  - Case: `uppercase`.
  - Letter spacing: `tracking-wider`.
  - Micro-Interaction: Scales up slightly (`1.01`) on hover and shrinks (`0.99`) on click.

### B. Secondary / Ghost Button
- **Classes**: `rounded-xl h-10 px-4 gap-2 border-2 border-border hover:bg-muted text-foreground hover:text-foreground font-bold text-xs uppercase tracking-wider transition-all cursor-pointer`

### C. Icon Control Button
- **Classes**: `p-2 rounded-lg text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-all duration-200 cursor-pointer`

---

## 5. Badges, Indicators & Stats
- **Standard Stats Card Block**:
  - High density layout: `text-center p-3 bg-muted/20 border border-border/10 rounded-xl`
  - Stat Value: `text-xl or text-2xl font-black text-foreground`
  - Stats Label: `text-[9px] uppercase tracking-widest text-muted-foreground/60 font-semibold mt-1`
- **Theme Tags / Badges**:
  - `Badge` with `rounded-full px-2.5 py-0.5 text-[8px] font-black uppercase tracking-widest bg-muted/50 border-border`

---

## 6. Custom Scrollbars & Utilities
- **Custom Scrollbar (`.custom-scrollbar` utility)**:
  - Scrollbar width: `6px`
  - Thumb: Zinc gray `var(--muted)` with rounded corners (`border-radius: 10px`)
  - Track: fully transparent
- **Hover Colors**:
  - Hover on standard cards: `hover:bg-muted/10` or `hover:bg-accent`
  - Interactive transition speed: `transition-all duration-300 ease-in-out`
