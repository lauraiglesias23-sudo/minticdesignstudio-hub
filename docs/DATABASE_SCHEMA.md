# DATABASE SCHEMA

Supabase project ID: `edlunosajckvtskzcpch`

## Tables

### products
| Column | Type | Notes |
|--------|------|-------|
| product_id | text PK | No hyphens |
| name | text | |
| product_type_id | uuid FK | → product_types.id |
| niche_id | uuid FK | → niches.id |
| created_date | date | |
| created_time | time | |
| notes | text | |
| url | text | |
| lifetime_earnings | numeric | Excludes canceled |
| lifetime_orders | int | Excludes canceled |
| lifetime_units | int | Excludes canceled |
| lifetime_customers | int | |
| months_sold | int | |
| repeat_seller | boolean | |
| high_signal_seller | boolean | |
| first_sale_date | date | |
| last_sale_date | date | |

### sales
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| product_id | text | With hyphens (Zazzle format) |
| sale_date | date | |
| royalty_usd | numeric | |
| quantity | int | |
| status | text | 'canceled' excluded from metrics |
| shipped_to | text | |
| order_id | text | |

Insert uses `ON CONFLICT DO NOTHING` for idempotency.

### product_types
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | Readable name (e.g. "Business Cards") |
| zazzle_code | text | Zazzle internal code (e.g. "zazzle_businesscard") |
| lmh | text | "low" / "medium" / "high" |
| active | boolean | |

Multiple zazzle_codes can map to one product type name.

### niches
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | |
| category_id | uuid FK | |

### customers
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| total_orders | int | |
| total_spent_usd | numeric | |

### orders
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| order_date | date | |

### inventory_snapshots
196 rows: 38 niches + 158 product types.

## Key Constraints
- `products_product_id_key`: unique constraint on product_id (enables ON CONFLICT upserts)
- Product metrics always recalculated filtering `WHERE status != 'canceled'`
- Product ID normalization: `REPLACE(product_id, '-', '')` required for all sales↔products JOINs
