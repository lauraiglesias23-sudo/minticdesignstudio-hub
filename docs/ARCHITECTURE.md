# ARCHITECTURE

## Stack
- React + Vite (frontend)
- Supabase (PostgreSQL database + auth)
- Vercel (hosting, auto-deploy on push to main)
- GitHub Codespaces (development environment)

## Repo
github.com/lauraiglesias23-sudo/minticdesignstudio-hub

## Live URL
https://minticdesignstudio-hub.vercel.app

## File Structure
src/

App.jsx                  # Entire app (components + navigation + logic)

pages/

ImportarRoyalties.jsx  # CSV importer page

public/

docs/                      # Technical documentation
## Navigation
Page-state navigation (not URL routing).
State variable: `page` (string).
Routes: `dashboard` | `products` | `reports` | `importar-royalties`

Navigation is managed via `getInitialPage()` which reads `window.location.pathname`.
Direct URL navigation does not work — all navigation goes through state.

## Supabase Client
Initialized lazily inside components/functions.
Never instantiated at module top level (causes crash if env vars missing).
Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (set in Vercel).

## Deploy
Automatic redeploy on push to `main`.
After adding env vars in Vercel, force redeploy with empty commit:
`git commit --allow-empty -m "trigger redeploy"`

## Key Patterns
- Product IDs stored without hyphens: `256-86991603-9905371` → `256869916039905371`
- All JOINs between `sales` and `products` require `REPLACE(product_id, '-', '')` normalization
- Pagination: 50 items per page (`PAGE_SIZE = 50`)
- Supabase writes: `apply_migration` preferred over `execute_sql` for all UPDATE/INSERT
- Batch size for upserts: max 25–50 rows to avoid parameter limits
