# Kallix Logo Assets — React Deployment Guide

## The fix for your login page

Looking at your screenshot, the login card uses this layout:

```jsx
<div className="flex items-center gap-3">
  <img src="???" className="w-14 h-14" />
  <h1 className="text-2xl font-bold">Kallix</h1>
</div>
```

That's a **square icon next to text**. The icon shouldn't already contain "KALLIX" text — it should just be the mark/logo. Use one of these:

- **`kallix-badge-animated.gif`** ← best pick. Animated, square, dark rounded bg, matches Firewatch's original shield style
- `kallix-badge-128.png` — static version of the above
- `kallix-loginicon-128.png` — transparent version (no dark bg, just the eye)

## Which asset goes where

### Login page (card with [icon][Kallix] layout)
```jsx
<img src="/assets/kallix-badge-animated.gif" className="w-14 h-14" alt="Kallix" />
<h1 className="text-2xl font-bold text-white">Kallix</h1>
```

### Sidebar nav (tiny icon only)
```jsx
<img src="/assets/kallix-loginicon-48.png" className="w-10 h-10" alt="Kallix" />
```

### Top nav (icon + "KALLIX" brand text)
```jsx
<div className="flex items-center gap-2">
  <img src="/assets/kallix-loginicon-32.png" className="w-8 h-8" />
  <span className="font-mono tracking-widest">KALLIX</span>
</div>
```

### Full-page splash / loading screen (large, animated)
```jsx
<img src="/assets/kallix-login-animated-hq.gif" className="w-96" />
```
This one IS all-in-one (has the eye + KALLIX text + tagline built in).

### Favicon
```html
<link rel="icon" href="/assets/kallix-favicon-hq.ico" />
```

### Social/OG preview (Twitter, Slack, etc)
```html
<meta property="og:image" content="/assets/kallix-og-social-hq.png" />
```
NEVER use this inside the UI — it's 1200x630 and designed for social previews.

## Asset inventory

| File | Size | Purpose |
|------|------|---------|
| `kallix-badge-animated.gif` | 200x200 | **Login card icon** (animated) |
| `kallix-badge-128.png` | 128x128 | Login card icon (static) |
| `kallix-badge-64.png` | 64x64 | Smaller dark-bg badge |
| `kallix-loginicon-256.png` | 256x256 | Large transparent icon |
| `kallix-loginicon-128.png` | 128x128 | Nav/sidebar icon, transparent |
| `kallix-loginicon-64.png` | 64x64 | Small icon, transparent |
| `kallix-loginicon-48.png` | 48x48 | Tiny icon, transparent |
| `kallix-icon-animated-transparent.gif` | 180x180 | Animated, no bg — for overlays |
| `kallix-login-animated-hq.gif` | 600x400 | **Full hero** (has all text, for splash) |
| `kallix-hero-hq.png` | 600x400 | Static hero fallback |
| `kallix-navbar-hq.png` | 300x52 | Horizontal navbar lockup |
| `kallix-footer-hq.png` | 220x90 | Muted footer with etymology |
| `kallix-og-social-hq.png` | 1200x630 | **Social sharing only** — not UI |
| `kallix-favicon-hq.ico` | 32x32 | Browser tab favicon |
| `kallix-mark-transparent-hq.png` | 400x280 | Just the eye, no text |

## Common mistakes to avoid

1. **Don't use `kallix-og-social-hq.png` anywhere in your UI.** That's a social sharing preview, not a UI asset. When scaled down to 60x60 it looks like junk.

2. **Don't use `kallix-login-animated-hq.gif` inside a small login card.** It already contains "KALLIX" text and a tagline — it's meant to be the entire hero area, not an icon.

3. **Don't use `kallix-hero-hq.png` as an icon.** Same issue — text is already baked in.

4. **For side-by-side icon+text layouts, use the `kallix-badge-*` or `kallix-loginicon-*` series.** These are icon-only, square, designed to pair with separately-rendered text.

## React component example

```jsx
// LoginCard.jsx
export function LoginCard() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 w-96">
      <div className="flex items-center justify-center gap-3 mb-6">
        <img
          src="/assets/kallix-badge-animated.gif"
          alt="Kallix"
          className="w-14 h-14"
        />
        <h1 className="text-2xl font-bold text-white">Kallix</h1>
      </div>
      {/* email, password, sign in button */}
    </div>
  );
}
```

## If you want to replace GIFs with React components

The GIFs work fine but if you want native React animation (crisper, no file size), the SVG-based components in `KallixLogoSystem.jsx` I made earlier are better. They use React state for animation instead of rasterized GIF frames.
