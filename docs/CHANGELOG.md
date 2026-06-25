# CHANGELOG

## June 2026

### 2026-06-25
- Created /docs/ with ARCHITECTURE, DATABASE_SCHEMA, FEATURES, ROADMAP, CHANGELOG, VISION

### 2026-06-24
- Fixed parseDate bug in ImportarRoyalties.jsx (Zazzle MM/DD/YYYY format)
- Added safeDateISO() wrapper to prevent Invalid Date crashes
- CSV import working: 1,039 new sales processed, 4,226 total sales in DB
- All 384 products assigned product_type_id (7 SQL batches + inference)
- Product metrics recalculated to exclude canceled sales (idempotent SQL UPDATE)

### 2026-06-23
- Added pagination to Product Master (50/page)
- Added date field to product edit modal
- Supabase env vars configured in Vercel
- App deployed to minticdesignstudio-hub.vercel.app

### Earlier June 2026
- Historical CSV imported: Sep 2024 – Jun 2026
- product_types table populated with zazzle_code mapping
- niches table populated (38 niches)
- inventory_snapshots populated (196 rows)
- Supabase lazy client initialization (prevents crash on missing env vars)
