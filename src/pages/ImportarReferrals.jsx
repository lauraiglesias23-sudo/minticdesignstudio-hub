cd /workspaces/minticdesignstudio-hub && git add src/pages/ImportarReferrals.jsx && git commit -m "feat: importer de referrals" && git push


meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function parseAmount(raw) {
  if (!raw) return 0;
  const clean = raw.replace(/\*+/g, "").replace(/[^0-9.]/g, "");
  const val = parseFloat(clean);
  return isNaN(val) ? 0 : val;
}

function parseDate(raw) {
  if (!raw) return null;
  const parts = raw.trim().split(/[\s,]+/);
  const dateParts = parts[0].split("/");
  if (dateParts.length === 3) {
    const [month, day, year] = dateParts;
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
}

function parseCSV(text) {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) throw new Error("CSV vacío o sin datos.");
  const headers = lines[0].split("\t").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const cols = line.split("\t");
    const row = {};
    headers.forEach((h, i) => { row[h] = (cols[i] || "").trim().replace(/\r/g, ""); });
    return row;
  }).filter((r) => r["Order Item ID"]);
}

async function importReferrals(rows, onProgress) {
  const log = [];
  let inserted = 0, duplicates = 0;

  onProgress("Insertando referrals...", 30);

  for (const row of rows) {
    const { error } = await supabase.from("referrals").upsert({
      order_item_id: row["Order Item ID"],
      product_id: (row["Product ID"] || "").replace(/-/g, ""),
      product_name: row["Product Title"],
      referral_date: parseDate(row["Date"]),
      subtotal_usd: parseAmount(row["Subtotal"]),
      referral_rate: parseAmount(row["Referral Rate"]),
      referral_amount_usd: parseAmount(row["Referral Amount"]),
      converted_referral_usd: parseAmount(row["Converted Referral"]),
      status: (row["Status"] || "").toLowerCase().trim(),
    }, { onConflict: "order_item_id", ignoreDuplicates: true });

    if (error) log.push(`⚠️ Error [${row["Order Item ID"]}]: ${error.message}`);
    else inserted++;
  }

  onProgress("Importación completa.", 100);
  return { inserted, duplicates: rows.length - inserted - log.length, warnings: log };
}

export default function ImportarReferrals() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFile = useCallback((e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }, []);

  const handleImport = async () => {
    if (!file) return;
    setStatus("running"); setProgress(0); setResult(null); setError(null);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length === 0) throw new Error("No se encontraron filas válidas.");
      const res = await importReferrals(rows, (msg, pct) => { setProgressMsg(msg); setProgress(pct); });
      setResult(res); setStatus("done");
    } catch (err) { setError(err.message); setStatus("error"); }
  };

  const reset = () => {
    setFile(null); setStatus("idle"); setProgress(0);
    setProgressMsg(""); setResult(null); setError(null);
  };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ fontSize: "1.4rem", fontWeight: 600, marginBottom: "0.25rem" }}>Importar Referrals Zazzle</h2>
      <p style={{ color: "#666", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
        Self Referral CSV → base de datos
      </p>

      {status === "idle" && (
        <>
          <input type="file" accept=".csv,.tsv,.txt" onChange={handleFile} style={{ marginBottom: "1rem", display: "block" }} />
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
              ["Referrals insertados", result.inserted],
              ["Duplicados ignorados", result.duplicates],
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
