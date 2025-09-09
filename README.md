# map-QLD

Vite + React + Tailwind frontend for Queensland parcel/layer intersection.
- Backend API (Render): `VITE_API_BASE` (set in `.env.production`)
- GitHub Pages base: `/map-QLD/`
- Exports **KMZ** only

## Dev
```bash
npm i
npm run dev
```
Create `.env` for local API if needed:
```
VITE_API_BASE=http://localhost:8000
```

## Build locally
```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages (via Actions)
- Workflow included at `.github/workflows/pages.yml`
- Pages Settings → Source: **GitHub Actions**

## Render backend CORS
Include your Pages origin:
- `https://<your-username>.github.io`

## Notes
- Map uses Google Maps JS API (add your loader elsewhere if needed).
- Layer list comes from `GET /layers`.
- KMZ export posts to `/export/kml` with the resolved parcel + intersected features.
