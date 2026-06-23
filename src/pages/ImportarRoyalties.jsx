import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://edlunosajckvtskzcpch.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkbHVub3NhamNrdnRza3pjcGNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5Nzk4NjMsImV4cCI6MjA5NzU1NTg2M30.7a-wLtuoVeyRXJpQ2IsBPu8Qlu0MxOVIWJcfnSuqz4E";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const theme = {
  bg: "#0F1117",
  surface: "#1A1D27",
  card: "#22263A",
  border: "#2E3250",
  accent: "#6C63FF",
  accentLight: "#8B84FF",
  text: "#F0F0F5",
  muted: "#7A7D9C",
  success: "#4CAF50",
  danger: "#F44336",
  medium: "#FF9800",
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      row.push(field);
      field = "";
      if (row.some((value) => value.trim())) {
        rows.push(row);
      }
      row = [];
    } else {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    if (row.some((value) => value.trim())) {
      rows.push(row);
    }
  }

  return rows;
}

function normalizeHeader(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export default function ImportarRoyalties({ showToast }) {
  const [rows, setRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [fileName, setFileName] = useState("");

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result || "";
      const parsed = parseCsv(text);
      if (parsed.length < 2) {
        showToast("No se detectaron filas válidas en el archivo", "error");
        return;
      }

      const headers = parsed[0].map(normalizeHeader);
      const data = parsed
        .slice(1)
        .map((row) => {
          const entry = {};
          headers.forEach((header, index) => {
            entry[header] = (row[index] || "").trim();
          });
          return entry;
        })
        .filter((row) => Object.values(row).some((value) => value));

      setRows(data);
      setResults(null);
    };

    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!rows.length) {
      showToast("Primero seleccioná un archivo CSV", "error");
      return;
    }

    setImporting(true);
    setResults(null);

    const payload = rows.map((row, index) => ({
      ...row,
      row_number: index + 2,
      source_file: fileName,
      imported_at: new Date().toISOString(),
    }));

    let result = await supabase.from("zazzle_royalty_history").insert(payload);

    if (result.error && ["42P01", "42703"].includes(result.error.code)) {
      result = await supabase.from("royalty_history").insert(payload);
    }

    if (result.error && ["42P01", "42703"].includes(result.error.code)) {
      result = await supabase.from("royalty_imports").insert({
        source_file: fileName,
        imported_at: new Date().toISOString(),
        rows: payload,
      });
    }

    setImporting(false);

    if (result.error) {
      showToast(`No se pudo importar: ${result.error.message}`, "error");
      setResults({ ok: 0, err: payload.length });
      return;
    }

    setResults({ ok: payload.length, err: 0 });
    showToast(`✓ ${payload.length} registros importados a Supabase`, "success");
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>Importar Royalties</div>
        <div style={{ fontSize: 13, color: theme.muted, marginTop: 4 }}>
          Importá el historial de royalties de Zazzle desde un CSV y envialo a Supabase
        </div>
      </div>

      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: theme.muted, textTransform: "uppercase", marginBottom: 10 }}>
          Archivo esperado
        </div>
        <div style={{ fontSize: 13, color: theme.muted, lineHeight: 1.7 }}>
          • Cargá un CSV exportado desde Zazzle o una tabla con columnas separadas por comas.<br />
          • Los datos se normalizan y se preparan para insertarse en Supabase.<br />
          • Este flujo es independiente del importador existente de inventario.
        </div>
      </div>

      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: theme.muted, textTransform: "uppercase", marginBottom: 8 }}>
          Seleccioná el archivo
        </div>
        <input type="file" accept=".csv,.txt" onChange={handleFile} style={{ color: theme.text, marginBottom: 16, display: "block" }} />

        {rows.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: theme.accentLight, fontWeight: 700 }}>{rows.length}</span> filas detectadas
            </div>
            <div style={{ overflowX: "auto", maxHeight: 240, overflowY: "auto", marginBottom: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {Object.keys(rows[0]).slice(0, 6).map((key) => (
                      <th key={key} style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, fontWeight: 600, color: theme.muted, textTransform: "uppercase", borderBottom: `1px solid ${theme.border}` }}>
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((row, index) => (
                    <tr key={`${row.source_file || "row"}-${index}`}>
                      {Object.values(row).slice(0, 6).map((value, valueIndex) => (
                        <td key={`${index}-${valueIndex}`} style={{ padding: "6px 10px", borderBottom: `1px solid ${theme.border}`, fontSize: 11, color: theme.muted }}>
                          {String(value).slice(0, 80)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 10 && <div style={{ textAlign: "center", padding: 8, color: theme.muted, fontSize: 11 }}>...y {rows.length - 10} más</div>}
            </div>
            <button onClick={handleImport} disabled={importing} style={{ padding: "8px 16px", background: theme.accent, color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {importing ? "Importando..." : `⬆ Importar ${rows.length} registros`}
            </button>
          </div>
        )}

        {results && (
          <div style={{ background: theme.surface, borderRadius: 8, padding: 16, marginTop: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Resultado:</div>
            <div style={{ display: "flex", gap: 20, fontSize: 13 }}>
              <span style={{ color: theme.success }}>✓ {results.ok} importados</span>
              {results.err > 0 && <span style={{ color: theme.danger }}>✗ {results.err} errores</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
