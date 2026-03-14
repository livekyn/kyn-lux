# KYN Lux
### Part of the KYN Protocol
**Intelligent sun session tracking — Evidence-based Vitamin D, Nitric Oxide, and Serotonin targets personalized to your biology.**

---

## What's in the box

| File | Purpose |
|------|---------|
| `index.html` | App shell & all UI |
| `styles.css` | All styles |
| `app.js` | All logic, science calculations, storage |
| `sw.js` | Service worker — enables offline PWA |
| `manifest.json` | PWA manifest — enables "Add to Home Screen" |
| `icons/` | App icons (192×192, 512×512) |

---

## Deploy to GitHub Pages (free, 5 minutes)

### Option A — GitHub.com UI (no terminal needed)

1. Go to [github.com](https://github.com) → Sign in or create a free account
2. Click **+** → **New repository**
3. Name it `kyn-lux`, set to **Public**, click **Create repository**
4. Click **uploading an existing file**
5. Drag **all files** from this folder into the upload area:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `sw.js`
   - `manifest.json`
   - The `icons/` folder (upload both PNGs inside it)
6. Click **Commit changes**
7. Go to **Settings** → **Pages** → Source: **Deploy from branch** → Branch: `main` → `/root` → **Save**
8. Wait ~60 seconds. Your app is live at:
   **`https://yourusername.github.io/kyn-lux`**

### Option B — Git CLI

```bash
cd kyn-lux
git init
git add .
git commit -m "KYN Lux v1"
git branch -M main
git remote add origin https://github.com/YOURUSERNAME/kyn-lux.git
git push -u origin main
# Then enable Pages in repo Settings
```

---

## Deploy to Netlify (even easier, also free)

1. Go to [netlify.com](https://netlify.com) → Sign up free
2. Drag and drop the entire `kyn-lux` folder onto the Netlify dashboard
3. Done. Live at `https://random-name.netlify.app`
4. Go to **Site settings** → **Domain management** to set a custom URL like `kyn-lux.netlify.app`

---

## Install on iPhone

1. Open your deployed URL in **Safari** on iPhone
2. Tap the **Share** button (box with arrow)
3. Scroll down → tap **"Add to Home Screen"**
4. Tap **Add**

KYN Lux now appears as a full-screen app on your home screen — no App Store required.

---

## When you're ready for v2 (user accounts + cloud sync)

Add **Supabase** (free tier, up to 50,000 users):

1. Create a free project at [supabase.com](https://supabase.com)
2. Create a `sessions` table with columns: `user_id, iu, no, se, uv, angle, params, time, elapsed`
3. Add the Supabase JS client to `index.html`
4. Swap `localStorage` calls in `app.js` with Supabase queries
5. Add Google/Apple OAuth sign-in (Supabase handles this)

Total cost: **$0** until ~50k users.

---

## Science behind the targets

| Nutrient | Daily Target | Basis |
|----------|-------------|-------|
| Vitamin D | 8,800 IU (adjusted by skin/age/goal) | Meta-analysis of sufficiency research |
| Nitric Oxide | 18 μmol (adjusted by age/goal) | ≥20 J/cm² UVA for measurable cardiovascular benefit |
| Serotonin | 80% mood lift (adjusted by sex/age/goal) | Direct correlation with bright sunlight duration (Lancet, 2002) |

All targets personalize based on: **age group**, **biological sex**, **Fitzpatrick skin type**, **health goal**, and **vitamin D deficiency status**.

---

## KYN Protocol
KYN Lux is part of the KYN Protocol subscription ecosystem. Future versions will include HealthKit integration, Apple Watch support, and full cross-device sync.

*Built with zero dependencies. Pure HTML, CSS, and JavaScript.*
