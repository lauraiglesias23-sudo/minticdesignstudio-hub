# FEATURES

## Dashboard
Route: `dashboard`
Shows inventory and production metrics.
Metrics: total products, products by type/niche, LMH%, evergreen vs seasonal,
revenue this month vs prior month, orders, AOV, success rate, sellers.
Max 15 metrics displayed.

## Product Master
Route: `products`
Full product list with filters (type, niche, LMH) and search.
Pagination: 50 products per page.
Edit modal includes: name, type, niche, LMH, date, notes, URL.
Quick-add via text input parsing Zazzle product format:
  `[Name] - Product ID: [id] Created on: [date]. Niche: [niche].`

## Reports
Route: `reports`
Planned: 8 specialized reports (see ROADMAP.md).
Current state: placeholder / partial.

## Importar Royalties
Route: `importar-royalties`
CSV importer for Zazzle royalty history exports.
Parses Zazzle MM/DD/YYYY date format via manual string splitting.
Inserts into `sales` table with ON CONFLICT DO NOTHING (idempotent).
Recalculates product metrics from `sales` table after each import (not accumulated).
