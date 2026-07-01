import { useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function normalizeProductId(raw) {
  return raw.replace(/-/g, "");
}

function parseRoyaltyUSD(raw) {
  if (!raw) return 0;
  // Quitar asteriscos, espacios, letras de moneda y símbolos — dejar solo números y punto
  const clean = raw.replace(/\*+/g, "").replace(/[^0-9.]/g, "");
  const val = parseFloat(clean);
  return isNaN(val) ? 0 : val;
}

function isFxRecalculated(raw) {
  if (!raw) return false;
  return /\*/.test(raw);
}

function parseDate(raw) {
  if (!raw) return new Date(NaN);
  // Formato Zazzle: M/D/YYYY H:MM o M/D/YYYY
  const parts = raw.trim().split(/[\s,]+/);
  const dateParts = parts[0].split("/");
  if (dateParts.length === 3) {
    const [month, day, year] = dateParts;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  return new Date(raw);
}

function safeDateISO(d) {
  if (!d || isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

function parseCSV(text) {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) throw new Error("CSV vacío o sin datos.");
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const cols = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === "," && !inQuote) { cols.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });
    return row;
  });
}

async function importCSV(rows, onProgress) {
  const log = [];
  let salesInserted = 0, ordersCreated = 0, customersCreated = 0, productsCreated = 0, productsUpdated = 0;

  // --- CLIENTES ---
  onProgress("Procesando clientes...", 10);
  const customerMap = new Map();
  for (const row of rows) {
    const shippedTo = row["Shipped To"];
    if (!shippedTo || customerMap.has(shippedTo)) continue;
    const dashIdx = shippedTo.indexOf(" - ");
    const name = dashIdx >= 0 ? shippedTo.substring(0, dashIdx).trim() : null;
    const location = dashIdx >= 0 ? shippedTo.substring(dashIdx + 3).trim() : null;
    customerMap.set(shippedTo, { name, location });
  }

  onProgress("Sincronizando clientes...", 20);
  const customerIdMap = new Map();
  for (const [shippedTo, data] of customerMap.entries()) {
    const { data: existing } = await supabase.from("customers").select("id").eq("shipped_to", shippedTo).single();
    if (existing) {
      customerIdMap.set(shippedTo, existing.id);
    } else {
      const { data: inserted, error } = await supabase.from("customers")
        .insert({ shipped_to: shippedTo, name: data.name, location: data.location })
        .select("id").single();
      if (error) { log.push(`⚠️ Customer error [${shippedTo}]: ${error.message}`); continue; }
      customerIdMap.set(shippedTo, inserted.id);
      customersCreated++;
    }
  }

  // --- ÓRDENES ---
  onProgress("Sincronizando órdenes...", 35);
  const orderMap = new Map();
  const orderGroups = new Map();
  for (const row of rows) {
    const shippedTo = row["Shipped To"];
    const dateOnly = safeDateISO(parseDate(row["Date"]));
    const key = `${shippedTo}|${dateOnly}`;
    if (!orderGroups.has(key)) orderGroups.set(key, []);
    orderGroups.get(key).push(row);
  }
  for (const [key, orderRows] of orderGroups.entries()) {
    const [shippedTo, dateOnly] = key.split("|");
    const customerId = customerIdMap.get(shippedTo);
    if (!customerId) continue;
    const totalItems = orderRows.reduce((sum, r) => sum + parseInt(r["Quantity"] || 0), 0);
    const totalUsd = orderRows.reduce((sum, r) => sum + parseRoyaltyUSD(r["Royalty (USD)"]), 0);
    const { data: existing } = await supabase.from("orders").select("id")
      .eq("customer_id", customerId).eq("order_date", dateOnly).single();
    if (existing) {
      orderMap.set(key, existing.id);
    } else {
      const { data: inserted, error } = await supabase.from("orders")
        .insert({ customer_id: customerId, order_date: dateOnly, total_items: totalItems, total_usd: parseFloat(totalUsd.toFixed(4)) })
        .select("id").single();
      if (error) { log.push(`⚠️ Order error [${key}]: ${error.message}`); continue; }
      orderMap.set(key, inserted.id);
      ordersCreated++;
    }
  }

  // --- VENTAS ---
  onProgress("Insertando ventas...", 55);
  const { data: existingProducts } = await supabase.from("products").select("id, product_id");
  const productDbMap = new Map();
  for (const p of existingProducts || []) productDbMap.set(normalizeProductId(p.product_id), p);

  const productSalesMap = new Map();
  for (const row of rows) {
    const pid = normalizeProductId(row["Product ID"]);
    if (!productSalesMap.has(pid)) productSalesMap.set(pid, []);
    productSalesMap.get(pid).push(row);
  }

  for (const row of rows) {
    const shippedTo = row["Shipped To"];
    const dateOnly = safeDateISO(parseDate(row["Date"]));
    const orderId = orderMap.get(`${shippedTo}|${dateOnly}`);
    const customerId = customerIdMap.get(shippedTo);
    const orderItemId = row["Order Item ID"] || null;

    const { error } = await supabase.from("sales").upsert({
      order_item_id: orderItemId,
      order_id: orderId || null,
      customer_id: customerId || null,
      product_id: row["Product ID"],
      product_name: row["Product Title"],
      product_type_code: row["Product Type"],
      sale_date: safeDateISO(parseDate(row["Date"])),
      quantity: parseInt(row["Quantity"]) || 1,
      royalty_rate: row["Royalty Rate"],
      royalty_usd: parseRoyaltyUSD(row["Royalty (USD)"]),
        is_fx_recalculated: isFxRecalculated(row["Royalty (USD)"]),
      status: (row["Status"] || "pending").toLowerCase().trim(),
      is_customized: row["Is Customized"] === "Yes",
      referred: row["Referred"],
      shipped_to: shippedTo,
      store: row["Store"],
    }, { onConflict: "order_item_id", ignoreDuplicates: false });

    if (error) log.push(`⚠️ Sale error [${row["Order Item ID"]}]: ${error.message}`);
    else salesInserted++;
  }

  // --- MÉTRICAS DE PRODUCTOS (recalculadas desde cero, no acumuladas) ---
  onProgress("Actualizando métricas de productos...", 75);
  for (const [normPid, pidRows] of productSalesMap.entries()) {
    const activeRows = pidRows.filter((r) => {
      const status = (r["Status"] || "").toLowerCase().trim();
      return status !== "canceled";
    });

    const totalEarnings = activeRows.reduce((s, r) => s + parseRoyaltyUSD(r["Royalty (USD)"]), 0);
    const totalUnits = activeRows.reduce((s, r) => s + parseInt(r["Quantity"] || 0), 0);
    const uniqueCustomers = new Set(activeRows.map((r) => r["Shipped To"])).size;
    const monthSet = new Set(activeRows.map((r) => {
      const d = parseDate(r["Date"]);
      return `${d.getFullYear()}-${d.getMonth()}`;
    }));
    const monthsSold = monthSet.size;
    const dates = activeRows.map((r) => parseDate(r["Date"])).filter((d) => d && !isNaN(d.getTime()));
    const firstSale = dates.length ? safeDateISO(new Date(Math.min(...dates))) : null;
    const lastSale = dates.length ? safeDateISO(new Date(Math.max(...dates))) : null;
    const uniqueOrders = new Set(activeRows.map((r) => {
      const d = safeDateISO(parseDate(r["Date"]));
      return `${r["Shipped To"]}|${d}`;
    })).size;
    const repeatSeller = monthsSold > 1;
    const highSignalSeller = uniqueCustomers > 1 && monthsSold > 1;

    const existing = productDbMap.get(normPid);
    if (existing) {
      const { error } = await supabase.from("products").update({
        lifetime_earnings: parseFloat(totalEarnings.toFixed(4)),
        lifetime_orders: uniqueOrders,
        lifetime_units: totalUnits,
        lifetime_customers: uniqueCustomers,
        months_sold: monthsSold,
        first_sale_date: firstSale,
        last_sale_date: lastSale,
        repeat_seller: repeatSeller,
        high_signal_seller: highSignalSeller,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
      if (error) log.push(`⚠️ Product update error [${normPid}]: ${error.message}`);
      else productsUpdated++;
    } else {
      const { error } = await supabase.from("products").insert({
        product_id: pidRows[0]["Product ID"],
        name: pidRows[0]["Product Title"],
        is_new: false,
        is_evergreen: true,
        lifetime_earnings: parseFloat(totalEarnings.toFixed(4)),
        lifetime_orders: uniqueOrders,
        lifetime_units: totalUnits,
        lifetime_customers: uniqueCustomers,
        months_sold: monthsSold,
        first_sale_date: firstSale,
        last_sale_date: lastSale,
        repeat_seller: repeatSeller,
        high_signal_seller: highSignalSeller,
      });
      if (error) log.push(`⚠️ Product insert error [${normPid}]: ${error.message}`);
      else productsCreated++;
    }
  }

  // --- TOTALES DE CLIENTES ---
  onProgress("Actualizando totales de clientes...", 90);
  for (const [shippedTo, customerId] of customerIdMap.entries()) {
    const customerRows = rows.filter((r) => r["Shipped To"] === shippedTo);
    const customerOrders = new Set(customerRows.map((r) => safeDateISO(parseDate(r["Date"])))).size;
    const totalSpent = customerRows.reduce((s, r) => s + parseRoyaltyUSD(r["Royalty (USD)"]), 0);
    const dates = customerRows.map((r) => parseDate(r["Date"])).filter((d) => d && !isNaN(d.getTime()));
    await supabase.from("customers").update({
      total_orders: customerOrders,
      total_spent_usd: parseFloat(totalSpent.toFixed(2)),
      first_order_date: dates.length ? safeDateISO(new Date(Math.min(...dates))) : null,
      last_order_date: dates.length ? safeDateISO(new Date(Math.max(...dates))) : null,
    }).eq("id", customerId);
  }

  onProgress("Importación completa.", 100);
  return { salesInserted, ordersCreated, customersCreated, productsCreated, productsUpdated, warnings: log };
}

export default function ImportarRoyalties() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFile = useCallback((e) => {
    const f = e.target.files?.[0] || e.dataTransfer?.files?.[0];
    if (f) setFile(f);
  }, []);

  const handleImport = async () => {
    if (!file) return;
    setStatus("running"); setProgress(0); setResult(null); setError(null);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      const res = await importCSV(rows, (msg, pct) => { setProgressMsg(msg); setProgress(pct); });
      setResult(res); setStatus("done");
    } catch (err) { setError(err.message); setStatus("error"); }
  };

  const reset = () => {
    setFile(null); setStatus("idle"); setProgress(0);
    setProgressMsg(""); setResult(null); setError(null);
  };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ fontSize: "1.4rem", fontWeight: 600, marginBottom: "0.25rem" }}>Importar Royalties Zazzle</h2>
      <p style={{ color: "#666", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
        Royalty history CSV → base de datos
      </p>

      {status === "idle" && (
        <>
          <input type="file" accept=".csv" onChange={handleFile} style={{ marginBottom: "1rem", display: "block" }} />
          {file && (
            <button
              onClick={handleImport}
              style={{ padding: "0.75rem 1.5rem", background: "#1a1a1a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.95rem" }}
            >
              Importar {file.name}
            </button>
          )}
        </>
      )}

      {status === "running" && (
        <div>
          <div style={{ height: 6, background: "#eee", borderRadius: 3, marginBottom: "0.75rem" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "#1a1a1a", borderRadius: 3, transition: "width 0.3s" }} />
          </div>
          <p style={{ color: "#555", fontSize: "0.875rem" }}>{progressMsg}</p>
        </div>
      )}

      {status === "done" && result && (
        <div style={{ background: "#f4faf4", border: "1px solid #c3e6c3", borderRadius: 8, padding: "1.25rem" }}>
          <div style={{ fontWeight: 600, marginBottom: "1rem" }}>Importación completa</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
            {[
              ["Ventas", result.salesInserted],
              ["Órdenes creadas", result.ordersCreated],
              ["Clientes nuevos", result.customersCreated],
              ["Productos creados", result.productsCreated],
              ["Productos actualizados", result.productsUpdated],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>{val}</div>
                <div style={{ fontSize: "0.75rem", color: "#555" }}>{label}</div>
              </div>
            ))}
          </div>
          {result.warnings.length > 0 && (
            <details style={{ fontSize: "0.8rem", color: "#885500", marginBottom: "0.5rem" }}>
              <summary>{result.warnings.length} advertencia(s)</summary>
              {result.warnings.map((w, i) => <p key={i} style={{ margin: "0.2rem 0" }}>{w}</p>)}
            </details>
          )}
          <button onClick={reset} style={{ padding: "0.65rem 1rem", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", marginTop: "0.5rem" }}>
            Importar otro
          </button>
        </div>
      )}

      {status === "error" && (
        <div style={{ background: "#fdf4f4", border: "1px solid #e6c3c3", borderRadius: 8, padding: "1.25rem" }}>
          <div style={{ fontWeight: 600, color: "#c00", marginBottom: "0.5rem" }}>Error</div>
          <p style={{ fontSize: "0.875rem", color: "#660000" }}>{error}</p>
          <button onClick={reset} style={{ padding: "0.65rem 1rem", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer" }}>
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}
