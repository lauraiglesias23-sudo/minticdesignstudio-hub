import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import ImportarRoyalties from "./pages/ImportarRoyalties";
import ImportarReferrals from "./pages/ImportarReferrals";

const SUPABASE_URL = "https://edlunosajckvtskzcpch.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkbHVub3NhamNrdnRza3pjcGNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5Nzk4NjMsImV4cCI6MjA5NzU1NTg2M30.7a-wLtuoVeyRXJpQ2IsBPu8Qlu0MxOVIWJcfnSuqz4E";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const theme = {
  bg: "#F5F5F3",
  surface: "#FFFFFF",
  card: "#FAFAF8",
  border: "#E2E2DC",
  accent: "#2D6A4F",
  accentLight: "#40916C",
  low: "#2D6A4F",
  medium: "#B5820A",
  high: "#C0392B",
  text: "#1A1A18",
  muted: "#6B6B65",
  success: "#2D6A4F",
  danger: "#C0392B",
};

const PAGE_SIZE = 50;

function parseQuickAdd(text) {
  const result = { product_id: "", name: "", date: "", time: "" };
  const idMatch = text.match(/Product ID[:\s]+(\d+)/i);
  if (idMatch) result.product_id = idMatch[1].trim();
  const nameMatch = text.match(/^(.*?)\s*-?\s*Product ID/i);
  if (nameMatch) result.name = nameMatch[1].trim();
  const dateMatch = text.match(/Created on[:\s]+(.+)/i);
  if (dateMatch) {
    const raw = dateMatch[1].trim();
    const parts = raw.match(/(\d+)\/(\d+)\/(\d+),?\s+(\d+):(\d+)\s*(AM|PM)?/i);
    if (parts) {
      let h = parseInt(parts[4]);
      const m = parts[5];
      const ampm = parts[6];
      if (ampm && ampm.toUpperCase() === "PM" && h < 12) h += 12;
      if (ampm && ampm.toUpperCase() === "AM" && h === 12) h = 0;
      result.date = `${parts[3]}-${parts[1].padStart(2,"0")}-${parts[2].padStart(2,"0")}`;
      result.time = `${String(h).padStart(2,"0")}:${m}`;
    }
  }
  return result;
}

function lmhColor(lmh) {
  if (lmh === "low") return theme.low;
  if (lmh === "medium") return theme.medium;
  if (lmh === "high") return theme.high;
  return theme.muted;
}

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  return (
    <div style={{
      position:"fixed", bottom:24, right:24, zIndex:1000,
      background:theme.surface, border:`1px solid ${type==="success"?theme.success:theme.danger}`,
      borderRadius:8, padding:"12px 18px", fontSize:13,
      color: type==="success"?theme.success:theme.danger,
      boxShadow:"0 4px 16px rgba(0,0,0,0.12)"
    }}>{msg}</div>
  );
}

function Dashboard({ products, actions, productTypes, niches, inventoryTotal }) {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const weekAgo = new Date(now - 7*86400000).toISOString().split("T")[0];
  const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
  const yearStart = `${now.getFullYear()}-01-01`;
  const count = (from) => products.filter(p => p.created_date >= from && p.created_date <= todayStr).length;
  const actCount = (from) => actions.filter(a => a.date >= from).length;
  const lmhCounts = { low:0, medium:0, high:0 };
  products.forEach(p => { const pt = productTypes.find(t=>t.id===p.product_type_id); if(pt) lmhCounts[pt.lmh]=(lmhCounts[pt.lmh]||0)+1; });
  const total = products.length || 1;
  const nicheMap = {};
  products.forEach(p => { const n=niches.find(x=>x.id===p.niche_id); if(n) nicheMap[n.name]=(nicheMap[n.name]||0)+1; });
  const topNiches = Object.entries(nicheMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const monthlyMap = {};
  products.forEach(p => { if(!p.created_date) return; const k=p.created_date.slice(0,7); monthlyMap[k]=(monthlyMap[k]||0)+1; });
  const months = Object.keys(monthlyMap).sort().slice(-6);
  const maxMonth = Math.max(...months.map(m=>monthlyMap[m]),1);
  return (
    <div>
      <div style={{marginBottom:24}}><div style={{fontSize:22,fontWeight:700,color:theme.text}}>Dashboard</div><div style={{fontSize:13,color:theme.muted,marginTop:4}}>Vista general de tu inventario</div></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:20}}>
        {[["Hoy",count(todayStr)],["Esta semana",count(weekAgo)],["Este mes",count(monthStart)],["Este año",count(yearStart)]].map(([l,v])=>(
          <div key={l} style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:8,padding:20}}>
            <div style={{fontSize:32,fontWeight:700,color:theme.text}}>{v}</div>
            <div style={{fontSize:12,color:theme.muted,marginTop:4}}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        <div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:8,padding:20}}>
          <div style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>Inventario total</div>
          <div style={{fontSize:32,fontWeight:700,marginBottom:16,color:theme.text}}>{inventoryTotal}</div>
          <div style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",marginBottom:8}}>Distribución LMH</div>
          <div style={{display:"flex",height:8,borderRadius:4,overflow:"hidden",gap:2,marginBottom:8}}>
            {["low","medium","high"].map(k=><div key={k} style={{width:`${(lmhCounts[k]||0)/total*100}%`,background:lmhColor(k),borderRadius:2}}/>)}
          </div>
          <div style={{display:"flex",gap:16,fontSize:12}}>
            {["low","medium","high"].map(k=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:8,height:8,borderRadius:2,background:lmhColor(k)}}/>
                <span style={{color:theme.muted,textTransform:"capitalize"}}>{k}</span>
                <span style={{fontWeight:600,color:theme.text}}>{lmhCounts[k]||0}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:8,padding:20}}>
          <div style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>Best Seller Actions</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            {[["Hoy",actCount(todayStr)],["Semana",actCount(weekAgo)],["Mes",actCount(monthStart)]].map(([l,v])=>(
              <div key={l}><div style={{fontSize:24,fontWeight:700,color:theme.accent}}>{v}</div><div style={{fontSize:11,color:theme.muted}}>{l}</div></div>
            ))}
          </div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:8,padding:20}}>
          <div style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",marginBottom:12}}>Produccion mensual</div>
          <div style={{display:"flex",alignItems:"flex-end",gap:6,height:80}}>
            {months.map(m=>(
              <div key={m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <div style={{fontSize:10,color:theme.muted,fontWeight:600}}>{monthlyMap[m]}</div>
                <div style={{width:"100%",background:theme.accent,borderRadius:"3px 3px 0 0",height:`${(monthlyMap[m]/maxMonth)*64}px`,minHeight:4}}/>
                <div style={{fontSize:9,color:theme.muted}}>{m.slice(5)}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:8,padding:20}}>
          <div style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",marginBottom:12}}>Top Niches</div>
          {topNiches.map(([name,count])=>(
            <div key={name} style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3,color:theme.text}}><span>{name}</span><span style={{color:theme.muted}}>{count}</span></div>
              <div style={{height:5,background:theme.border,borderRadius:3}}><div style={{height:"100%",background:theme.accent,borderRadius:3,width:`${count/topNiches[0][1]*100}%`}}/></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickAdd({ productTypes, niches, onSave, showToast }) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState(null);
  const [selectedType, setSelectedType] = useState("");
  const [selectedNiche, setSelectedNiche] = useState("");
  const [notes, setNotes] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const handleParse = () => setParsed(parseQuickAdd(text));
  const handleSave = async () => {
    if (!parsed?.product_id || !parsed?.name) return showToast("Faltan datos del producto", "error");
    if (!selectedType) return showToast("Selecciona un Product Type", "error");
    if (!selectedNiche) return showToast("Selecciona un Niche", "error");
    setSaving(true);
    const { error } = await supabase.from("products").insert({ product_id:parsed.product_id, name:parsed.name, product_type_id:selectedType, niche_id:selectedNiche, created_date:parsed.date||null, created_time:parsed.time||null, notes, url });
    setSaving(false);
    if (error) { if(error.code==="23505") return showToast("Producto duplicado", "error"); return showToast("Error: "+error.message,"error"); }
    showToast("Producto guardado","success");
    setText(""); setParsed(null); setSelectedType(""); setSelectedNiche(""); setNotes(""); setUrl(""); onSave();
  };
  const s = { background:theme.surface, border:`1px solid ${theme.border}`, borderRadius:8, padding:20, marginBottom:16 };
  const inp = { width:"100%", padding:"9px 12px", background:theme.bg, border:`1px solid ${theme.border}`, borderRadius:6, color:theme.text, fontSize:13, outline:"none" };
  const lbl = { fontSize:11, fontWeight:600, color:theme.muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:5, display:"block" };
  return (
    <div>
      <div style={{marginBottom:24}}><div style={{fontSize:22,fontWeight:700,color:theme.text}}>Quick Add</div><div style={{fontSize:13,color:theme.muted,marginTop:4}}>Pega el texto de Zazzle y extrae los datos automaticamente</div></div>
      <div style={s}>
        <div style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",marginBottom:12}}>Paso 1 — Pega el texto de Zazzle</div>
        <textarea style={{...inp,minHeight:100,resize:"vertical",marginBottom:12}} placeholder={"Modern Spa Massage Therapist Neutral Beige Appointment Card - Product ID: 256957814198807743\nCreated on: 6/19/2026, 12:46 PM"} value={text} onChange={e=>{setText(e.target.value);setParsed(null);}}/>
        <button onClick={handleParse} disabled={!text.trim()} style={{padding:"8px 16px",background:theme.accent,color:"#fff",border:"none",borderRadius:6,fontSize:13,fontWeight:600,cursor:"pointer"}}>Extraer datos</button>
        {parsed && (
          <div style={{background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:6,padding:16,marginTop:12}}>
            <div style={{fontSize:12,fontWeight:600,color:theme.accent,marginBottom:10}}>Datos extraidos:</div>
            {[["Product ID",parsed.product_id],["Nombre",parsed.name],["Fecha",parsed.date],["Hora",parsed.time]].map(([k,v])=>(
              <div key={k} style={{display:"flex",gap:8,marginBottom:6,fontSize:13}}>
                <span style={{color:theme.muted,width:110,minWidth:110}}>{k}</span>
                <span style={{fontWeight:500,color:theme.text}}>{v||<span style={{color:theme.danger}}>No detectado</span>}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {parsed && (
        <div style={s}>
          <div style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",marginBottom:12}}>Paso 2 — Clasificacion</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div><label style={lbl}>Product Type</label><select style={inp} value={selectedType} onChange={e=>setSelectedType(e.target.value)}><option value="">Selecciona...</option>{productTypes.filter(t=>t.active).map(t=><option key={t.id} value={t.id}>{t.name} ({t.lmh?.toUpperCase()})</option>)}</select></div>
            <div><label style={lbl}>Niche</label><select style={inp} value={selectedNiche} onChange={e=>setSelectedNiche(e.target.value)}><option value="">Selecciona...</option>{niches.filter(n=>n.active).map(n=><option key={n.id} value={n.id}>{n.name}</option>)}</select></div>
          </div>
          <div style={{marginBottom:16}}><label style={lbl}>Notas (opcional)</label><textarea style={{...inp,minHeight:60,resize:"vertical"}} value={notes} onChange={e=>setNotes(e.target.value)}/></div>
          <div style={{marginBottom:16}}><label style={lbl}>URL (opcional)</label><input style={inp} type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://"/></div>
          <button onClick={handleSave} disabled={saving} style={{padding:"8px 16px",background:theme.accent,color:"#fff",border:"none",borderRadius:6,fontSize:13,fontWeight:600,cursor:"pointer"}}>{saving?"Guardando...":"Guardar producto"}</button>
        </div>
      )}
    </div>
  );
}

function ProductMaster({ products, productTypes, niches, onRefresh, showToast }) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterNiche, setFilterNiche] = useState("");
  const [filterLmh, setFilterLmh] = useState("");
  const [page, setPage] = useState(1);
  const [editProduct, setEditProduct] = useState(null);
  const [saving, setSaving] = useState(false);
  const inp = { width:"100%", padding:"9px 12px", background:theme.bg, border:`1px solid ${theme.border}`, borderRadius:6, color:theme.text, fontSize:13, outline:"none" };
  const filtered = products.filter(p => {
    const pt = productTypes.find(t=>t.id===p.product_type_id);
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.product_id?.includes(search);
    const matchType = !filterType || p.product_type_id===filterType;
    const matchNiche = !filterNiche || p.niche_id===filterNiche;
    const matchLmh = !filterLmh || pt?.lmh===filterLmh;
    return matchSearch && matchType && matchNiche && matchLmh;
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  // Reset to page 1 when filters change
  useEffect(() => setPage(1), [search, filterType, filterNiche, filterLmh]);

  const handleSaveEdit = async () => {
    setSaving(true);
    const { error } = await supabase.from("products").update({
      name: editProduct.name,
      product_type_id: editProduct.product_type_id,
      niche_id: editProduct.niche_id,
      created_date: editProduct.created_date || null,
      notes: editProduct.notes,
      url: editProduct.url,
    }).eq("id", editProduct.id);
    setSaving(false);
    if (error) return showToast("Error: "+error.message,"error");
    showToast("Producto actualizado","success"); setEditProduct(null); onRefresh();
  };

  const btnStyle = (active) => ({
    padding:"5px 10px", fontSize:12, borderRadius:5, cursor:"pointer",
    background: active ? theme.accent : theme.surface,
    color: active ? "#fff" : theme.muted,
    border: `1px solid ${active ? theme.accent : theme.border}`,
  });

  return (
    <div>
      <div style={{marginBottom:24}}><div style={{fontSize:22,fontWeight:700,color:theme.text}}>Product Master</div><div style={{fontSize:13,color:theme.muted,marginTop:4}}>{products.length} productos registrados</div></div>
      <div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:8,padding:20}}>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
          <input style={{...inp,flex:1,minWidth:180}} placeholder="Buscar por nombre o ID..." value={search} onChange={e=>setSearch(e.target.value)}/>
          <select style={{...inp,width:160}} value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="">Todos los tipos</option>{productTypes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <select style={{...inp,width:160}} value={filterNiche} onChange={e=>setFilterNiche(e.target.value)}><option value="">Todos los niches</option>{niches.map(n=><option key={n.id} value={n.id}>{n.name}</option>)}</select>
          <select style={{...inp,width:120}} value={filterLmh} onChange={e=>setFilterLmh(e.target.value)}><option value="">LMH</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
        </div>
        <div style={{fontSize:12,color:theme.muted,marginBottom:10}}>{filtered.length} resultados</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr>{["Producto","ID","Type","LMH","Niche","Fecha","URL",""].map(h=><th key={h} style={{textAlign:"left",padding:"10px 12px",fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",borderBottom:`1px solid ${theme.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
            <tbody>
              {paginated.map(p=>{
                const pt=productTypes.find(t=>t.id===p.product_type_id);
                const n=niches.find(x=>x.id===p.niche_id);
                return (
                  <tr key={p.id} style={{background:"transparent"}}>
                    <td style={{padding:"10px 12px",borderBottom:`1px solid ${theme.border}`,maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500,color:theme.text}}>{p.name}</td>
                    <td style={{padding:"10px 12px",borderBottom:`1px solid ${theme.border}`,color:theme.muted,fontSize:11}}>{p.product_id}</td>
                    <td style={{padding:"10px 12px",borderBottom:`1px solid ${theme.border}`,color:theme.text}}>{pt?.name||"—"}</td>
                    <td style={{padding:"10px 12px",borderBottom:`1px solid ${theme.border}`}}>{pt&&<span style={{padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:600,background:pt.lmh==="low"?"rgba(45,106,79,0.1)":pt.lmh==="medium"?"rgba(181,130,10,0.1)":"rgba(192,57,43,0.1)",color:lmhColor(pt.lmh)}}>{pt.lmh}</span>}</td>
                    <td style={{padding:"10px 12px",borderBottom:`1px solid ${theme.border}`,color:theme.text}}>{n?.name||"—"}</td>
                    <td style={{padding:"10px 12px",borderBottom:`1px solid ${theme.border}`,color:theme.muted,whiteSpace:"nowrap"}}>{p.created_date||"—"}</td>
                    <td style={{padding:"10px 12px",borderBottom:`1px solid ${theme.border}`}}>{p.url?<a href={p.url} target="_blank" rel="noopener noreferrer" style={{color:theme.accent,textDecoration:"underline",cursor:"pointer"}}>Ver</a>:"—"}</td>
                    <td style={{padding:"10px 12px",borderBottom:`1px solid ${theme.border}`}}><button onClick={()=>setEditProduct({...p})} style={{padding:"3px 10px",background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:5,color:theme.text,fontSize:11,cursor:"pointer"}}>Editar</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length===0&&<div style={{textAlign:"center",padding:48,color:theme.muted}}>Sin resultados</div>}
        </div>
        {totalPages > 1 && (
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:16,paddingTop:16,borderTop:`1px solid ${theme.border}`}}>
            <div style={{fontSize:12,color:theme.muted}}>Pagina {page} de {totalPages} · {filtered.length} resultados</div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>setPage(1)} disabled={page===1} style={btnStyle(false)}>Primera</button>
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={btnStyle(false)}>Anterior</button>
              {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
                const pageNum = Math.min(Math.max(page-2,1)+i, totalPages);
                return <button key={pageNum} onClick={()=>setPage(pageNum)} style={btnStyle(pageNum===page)}>{pageNum}</button>;
              })}
              <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={btnStyle(false)}>Siguiente</button>
              <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} style={btnStyle(false)}>Ultima</button>
            </div>
          </div>
        )}
      </div>
      {editProduct&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.3)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={e=>e.target===e.currentTarget&&setEditProduct(null)}>
          <div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:10,padding:28,width:"100%",maxWidth:560,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 8px 32px rgba(0,0,0,0.12)"}}>
            <div style={{fontSize:17,fontWeight:700,marginBottom:20,color:theme.text}}>Editar producto</div>
            <div style={{marginBottom:12}}><label style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",display:"block",marginBottom:5}}>Nombre</label><input style={inp} value={editProduct.name} onChange={e=>setEditProduct({...editProduct,name:e.target.value})}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
              <div><label style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",display:"block",marginBottom:5}}>Product Type</label><select style={inp} value={editProduct.product_type_id||""} onChange={e=>setEditProduct({...editProduct,product_type_id:e.target.value})}><option value="">Selecciona...</option>{productTypes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div><label style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",display:"block",marginBottom:5}}>Niche</label><select style={inp} value={editProduct.niche_id||""} onChange={e=>setEditProduct({...editProduct,niche_id:e.target.value})}><option value="">Selecciona...</option>{niches.map(n=><option key={n.id} value={n.id}>{n.name}</option>)}</select></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
              <div><label style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",display:"block",marginBottom:5}}>Fecha de creacion</label><input style={inp} type="date" value={editProduct.created_date||""} onChange={e=>setEditProduct({...editProduct,created_date:e.target.value})}/></div>
              <div><label style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",display:"block",marginBottom:5}}>URL</label><input style={inp} type="url" value={editProduct.url||""} onChange={e=>setEditProduct({...editProduct,url:e.target.value})} placeholder="https://"/></div>
            </div>
            <div style={{marginBottom:20}}><label style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",display:"block",marginBottom:5}}>Notas</label><textarea style={{...inp,minHeight:60,resize:"vertical"}} value={editProduct.notes||""} onChange={e=>setEditProduct({...editProduct,notes:e.target.value})}/></div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>setEditProduct(null)} style={{padding:"8px 16px",background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:6,color:theme.text,fontSize:13,cursor:"pointer"}}>Cancelar</button>
              <button onClick={handleSaveEdit} disabled={saving} style={{padding:"8px 16px",background:theme.accent,border:"none",borderRadius:6,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{saving?"Guardando...":"Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductTypes({ productTypes, onRefresh, showToast }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name:"", zazzle_code:"", lmh:"low" });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const inp = { width:"100%", padding:"9px 12px", background:theme.bg, border:`1px solid ${theme.border}`, borderRadius:6, color:theme.text, fontSize:13, outline:"none" };
  const filtered = productTypes.filter(t=>!search||t.name.toLowerCase().includes(search.toLowerCase()));
  const handleAdd = async () => {
    if (!form.name) return showToast("El nombre es requerido","error");
    setSaving(true);
    const { error } = await supabase.from("product_types").insert(form);
    setSaving(false);
    if (error) return showToast("Error: "+error.message,"error");
    showToast("Product Type agregado","success");
    setForm({ name:"", zazzle_code:"", lmh:"low" }); setShowAdd(false); onRefresh();
  };
  const toggleActive = async (pt) => { await supabase.from("product_types").update({active:!pt.active}).eq("id",pt.id); onRefresh(); };
  return (
    <div>
      <div style={{marginBottom:24,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div><div style={{fontSize:22,fontWeight:700,color:theme.text}}>Product Types</div><div style={{fontSize:13,color:theme.muted,marginTop:4}}>{productTypes.filter(t=>t.active).length} activos</div></div>
        <button onClick={()=>setShowAdd(true)} style={{padding:"8px 16px",background:theme.accent,color:"#fff",border:"none",borderRadius:6,fontSize:13,fontWeight:600,cursor:"pointer"}}>+ Agregar tipo</button>
      </div>
      <div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:8,padding:20}}>
        <input style={{...inp,marginBottom:16}} placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr>{["Nombre","Codigo Zazzle","LMH","Estado",""].map(h=><th key={h} style={{textAlign:"left",padding:"10px 12px",fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",borderBottom:`1px solid ${theme.border}`}}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map(t=>(
                <tr key={t.id} style={{opacity:t.active?1:0.4}}>
                  <td style={{padding:"10px 12px",borderBottom:`1px solid ${theme.border}`,fontWeight:500,color:theme.text}}>{t.name}</td>
                  <td style={{padding:"10px 12px",borderBottom:`1px solid ${theme.border}`,color:theme.muted,fontSize:11}}>{t.zazzle_code||"—"}</td>
                  <td style={{padding:"10px 12px",borderBottom:`1px solid ${theme.border}`}}><span style={{padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:600,background:t.lmh==="low"?"rgba(45,106,79,0.1)":t.lmh==="medium"?"rgba(181,130,10,0.1)":"rgba(192,57,43,0.1)",color:lmhColor(t.lmh)}}>{t.lmh}</span></td>
                  <td style={{padding:"10px 12px",borderBottom:`1px solid ${theme.border}`,fontSize:11,color:t.active?theme.success:theme.muted}}>{t.active?"Activo":"Inactivo"}</td>
                  <td style={{padding:"10px 12px",borderBottom:`1px solid ${theme.border}`}}><button onClick={()=>toggleActive(t)} style={{padding:"3px 10px",background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:5,color:theme.text,fontSize:11,cursor:"pointer"}}>{t.active?"Desactivar":"Activar"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showAdd&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.3)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={e=>e.target===e.currentTarget&&setShowAdd(false)}>
          <div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:10,padding:28,width:"100%",maxWidth:480,boxShadow:"0 8px 32px rgba(0,0,0,0.12)"}}>
            <div style={{fontSize:17,fontWeight:700,marginBottom:20,color:theme.text}}>Nuevo Product Type</div>
            <div style={{marginBottom:12}}><label style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",display:"block",marginBottom:5}}>Nombre</label><input style={inp} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ej: Appointment Card"/></div>
            <div style={{marginBottom:12}}><label style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",display:"block",marginBottom:5}}>Codigo Zazzle (opcional)</label><input style={inp} value={form.zazzle_code} onChange={e=>setForm({...form,zazzle_code:e.target.value})} placeholder="Ej: zazzle_flatappointmentcard"/></div>
            <div style={{marginBottom:20}}><label style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",display:"block",marginBottom:5}}>LMH</label><select style={inp} value={form.lmh} onChange={e=>setForm({...form,lmh:e.target.value})}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>setShowAdd(false)} style={{padding:"8px 16px",background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:6,color:theme.text,fontSize:13,cursor:"pointer"}}>Cancelar</button>
              <button onClick={handleAdd} disabled={saving} style={{padding:"8px 16px",background:theme.accent,border:"none",borderRadius:6,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{saving?"Guardando...":"Agregar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Niches({ niches, nicheCategories, onRefresh, showToast }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name:"", category_id:"" });
  const [saving, setSaving] = useState(false);
  const inp = { width:"100%", padding:"9px 12px", background:theme.bg, border:`1px solid ${theme.border}`, borderRadius:6, color:theme.text, fontSize:13, outline:"none" };
  const handleAdd = async () => {
    if (!form.name||!form.category_id) return showToast("Completa todos los campos","error");
    setSaving(true);
    const { error } = await supabase.from("niches").insert(form);
    setSaving(false);
    if (error) return showToast("Error: "+error.message,"error");
    showToast("Niche agregado","success");
    setForm({ name:"", category_id:"" }); setShowAdd(false); onRefresh();
  };
  const toggleActive = async (n) => { await supabase.from("niches").update({active:!n.active}).eq("id",n.id); onRefresh(); };
  return (
    <div>
      <div style={{marginBottom:24,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div><div style={{fontSize:22,fontWeight:700,color:theme.text}}>Niches</div><div style={{fontSize:13,color:theme.muted,marginTop:4}}>{niches.filter(n=>n.active).length} activos</div></div>
        <button onClick={()=>setShowAdd(true)} style={{padding:"8px 16px",background:theme.accent,color:"#fff",border:"none",borderRadius:6,fontSize:13,fontWeight:600,cursor:"pointer"}}>+ Agregar niche</button>
      </div>
      {nicheCategories.map(cat=>{
        const catNiches=niches.filter(n=>n.category_id===cat.id);
        return (
          <div key={cat.id} style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:8,padding:20,marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>{cat.name}</div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr>{["Niche","Estado",""].map(h=><th key={h} style={{textAlign:"left",padding:"8px 12px",fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",borderBottom:`1px solid ${theme.border}`}}>{h}</th>)}</tr></thead>
              <tbody>
                {catNiches.map(n=>(
                  <tr key={n.id} style={{opacity:n.active?1:0.4}}>
                    <td style={{padding:"8px 12px",borderBottom:`1px solid ${theme.border}`,fontWeight:500,color:theme.text}}>{n.name}</td>
                    <td style={{padding:"8px 12px",borderBottom:`1px solid ${theme.border}`,fontSize:11,color:n.active?theme.success:theme.muted}}>{n.active?"Activo":"Inactivo"}</td>
                    <td style={{padding:"8px 12px",borderBottom:`1px solid ${theme.border}`}}><button onClick={()=>toggleActive(n)} style={{padding:"3px 10px",background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:5,color:theme.text,fontSize:11,cursor:"pointer"}}>{n.active?"Desactivar":"Activar"}</button></td>
                  </tr>
                ))}
                {catNiches.length===0&&<tr><td colSpan={3} style={{padding:"8px 12px",color:theme.muted,fontSize:12}}>Sin niches</td></tr>}
              </tbody>
            </table>
          </div>
        );
      })}
      {showAdd&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.3)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={e=>e.target===e.currentTarget&&setShowAdd(false)}>
          <div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:10,padding:28,width:"100%",maxWidth:480,boxShadow:"0 8px 32px rgba(0,0,0,0.12)"}}>
            <div style={{fontSize:17,fontWeight:700,marginBottom:20,color:theme.text}}>Nuevo Niche</div>
            <div style={{marginBottom:12}}><label style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",display:"block",marginBottom:5}}>Categoria</label><select style={inp} value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})}><option value="">Selecciona...</option>{nicheCategories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div style={{marginBottom:20}}><label style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",display:"block",marginBottom:5}}>Nombre</label><input style={inp} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ej: Dental Clinic"/></div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>setShowAdd(false)} style={{padding:"8px 16px",background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:6,color:theme.text,fontSize:13,cursor:"pointer"}}>Cancelar</button>
              <button onClick={handleAdd} disabled={saving} style={{padding:"8px 16px",background:theme.accent,border:"none",borderRadius:6,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{saving?"Guardando...":"Agregar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BestSellerActions({ actions, onRefresh, showToast }) {
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ product_id:"", product_name:"", date:new Date().toISOString().split("T")[0], action:"", outcome:"", next_step:"", notes:"" });
  const [saving, setSaving] = useState(false);
  const inp = { width:"100%", padding:"9px 12px", background:theme.bg, border:`1px solid ${theme.border}`, borderRadius:6, color:theme.text, fontSize:13, outline:"none" };
  const filtered = actions.filter(a=>!search||a.product_name?.toLowerCase().includes(search.toLowerCase())||a.product_id?.includes(search)||a.action?.toLowerCase().includes(search.toLowerCase()));
  const handleAdd = async () => {
    if (!form.product_id||!form.date) return showToast("Product ID y fecha son requeridos","error");
    setSaving(true);
    const { error } = await supabase.from("best_seller_actions").insert(form);
    setSaving(false);
    if (error) return showToast("Error: "+error.message,"error");
    showToast("Accion registrada","success");
    setForm({ product_id:"", product_name:"", date:new Date().toISOString().split("T")[0], action:"", outcome:"", next_step:"", notes:"" });
    setShowAdd(false); onRefresh();
  };
  const exportCSV = () => {
    const headers = ["Date","Product ID","Product Name","Action","Outcome","Next Step","Notes"];
    const rows = filtered.map(a=>[a.date,a.product_id,a.product_name,a.action,a.outcome,a.next_step,a.notes].map(v=>`"${(v||"").replace(/"/g,'""')}"`));
    const csv = [headers,...rows].map(r=>r.join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="best_seller_actions.csv"; a.click();
  };
  const lbl = { fontSize:11, fontWeight:600, color:theme.muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:5, display:"block" };
  return (
    <div>
      <div style={{marginBottom:24,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div><div style={{fontSize:22,fontWeight:700,color:theme.text}}>Best Seller Actions</div><div style={{fontSize:13,color:theme.muted,marginTop:4}}>{actions.length} acciones registradas</div></div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={exportCSV} style={{padding:"8px 16px",background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:6,color:theme.text,fontSize:13,cursor:"pointer"}}>Exportar CSV</button>
          <button onClick={()=>setShowAdd(true)} style={{padding:"8px 16px",background:theme.accent,color:"#fff",border:"none",borderRadius:6,fontSize:13,fontWeight:600,cursor:"pointer"}}>+ Nueva accion</button>
        </div>
      </div>
      <div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:8,padding:20}}>
        <input style={{...inp,marginBottom:16}} placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr>{["Fecha","Producto","Accion","Outcome","Proximo paso"].map(h=><th key={h} style={{textAlign:"left",padding:"10px 12px",fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",borderBottom:`1px solid ${theme.border}`,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map(a=>(
                <tr key={a.id}>
                  <td style={{padding:"10px 12px",borderBottom:`1px solid ${theme.border}`,whiteSpace:"nowrap",color:theme.muted}}>{a.date}</td>
                  <td style={{padding:"10px 12px",borderBottom:`1px solid ${theme.border}`}}><div style={{fontWeight:500,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:theme.text}}>{a.product_name||a.product_id}</div><div style={{fontSize:11,color:theme.muted}}>{a.product_id}</div></td>
                  <td style={{padding:"10px 12px",borderBottom:`1px solid ${theme.border}`,maxWidth:200,color:theme.text}}>{a.action}</td>
                  <td style={{padding:"10px 12px",borderBottom:`1px solid ${theme.border}`,maxWidth:160,color:theme.muted,fontSize:12}}>{a.outcome}</td>
                  <td style={{padding:"10px 12px",borderBottom:`1px solid ${theme.border}`,maxWidth:160,color:theme.accent,fontSize:12}}>{a.next_step}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length===0&&<div style={{textAlign:"center",padding:48,color:theme.muted}}>Sin acciones registradas</div>}
        </div>
      </div>
      {showAdd&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.3)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={e=>e.target===e.currentTarget&&setShowAdd(false)}>
          <div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:10,padding:28,width:"100%",maxWidth:560,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 8px 32px rgba(0,0,0,0.12)"}}>
            <div style={{fontSize:17,fontWeight:700,marginBottom:20,color:theme.text}}>Nueva Best Seller Action</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
              <div><label style={lbl}>Product ID</label><input style={inp} value={form.product_id} onChange={e=>setForm({...form,product_id:e.target.value})}/></div>
              <div><label style={lbl}>Fecha</label><input style={inp} type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></div>
            </div>
            <div style={{marginBottom:12}}><label style={lbl}>Nombre del producto</label><input style={inp} value={form.product_name} onChange={e=>setForm({...form,product_name:e.target.value})}/></div>
            <div style={{marginBottom:12}}><label style={lbl}>Accion realizada</label><textarea style={{...inp,minHeight:60,resize:"vertical"}} value={form.action} onChange={e=>setForm({...form,action:e.target.value})}/></div>
            <div style={{marginBottom:12}}><label style={lbl}>Outcome</label><textarea style={{...inp,minHeight:60,resize:"vertical"}} value={form.outcome} onChange={e=>setForm({...form,outcome:e.target.value})}/></div>
            <div style={{marginBottom:12}}><label style={lbl}>Proximo paso</label><input style={inp} value={form.next_step} onChange={e=>setForm({...form,next_step:e.target.value})}/></div>
            <div style={{marginBottom:20}}><label style={lbl}>Notas</label><textarea style={{...inp,minHeight:60,resize:"vertical"}} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>setShowAdd(false)} style={{padding:"8px 16px",background:theme.bg,border:`1px solid ${theme.border}`,borderRadius:6,color:theme.text,fontSize:13,cursor:"pointer"}}>Cancelar</button>
              <button onClick={handleAdd} disabled={saving} style={{padding:"8px 16px",background:theme.accent,border:"none",borderRadius:6,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{saving?"Guardando...":"Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ImportCSV({ productTypes, niches, onRefresh, showToast }) {
  const [rows, setRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const inp = { width:"100%", padding:"9px 12px", background:theme.bg, border:`1px solid ${theme.border}`, borderRadius:6, color:theme.text, fontSize:13, outline:"none" };
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.split("\n").filter(l=>l.trim());
      const headers = lines[0].split("\t").map(h=>h.trim().toLowerCase().replace(/\s+/g,"_"));
      const data = lines.slice(1).map(line=>{
        const cols = line.split("\t");
        const obj = {};
        headers.forEach((h,i)=>obj[h]=(cols[i]||"").trim().replace(/\r/g,""));
        return obj;
      }).filter(r=>r.product_id);
      setRows(data); setResults(null);
    };
    reader.readAsText(file);
  };
  const handleImport = async () => {
    setImporting(true);
    let ok=0, dupe=0, err=0;
    for (const row of rows) {
      const ptName=(row.product_type||"").toLowerCase().trim();
      const pt=productTypes.find(t=>t.name.toLowerCase()===ptName||t.zazzle_code===ptName);
      const nName=(row.niche||"").toLowerCase().trim();
      const n=niches.find(x=>x.name.toLowerCase()===nName);
      let date=null, time=null;
      if (row.creation_date) {
        const parts=row.creation_date.match(/(\d{4}-\d{2}-\d{2})/);
        if(parts) date=parts[1];
        const tp=row.creation_date.match(/(\d{1,2}:\d{2})/);
        if(tp) time=tp[1];
        if(!date) { const d=new Date(row.creation_date); if(!isNaN(d)){ date=d.toISOString().split("T")[0]; time=d.toTimeString().slice(0,5); } }
      }
      const { error } = await supabase.from("products").insert({ product_id:row.product_id, name:row.product_name, product_type_id:pt?.id||null, niche_id:n?.id||null, created_date:date, created_time:time, notes:row.notes||null, url:row.url||null });
      if(!error) ok++; else if(error.code==="23505") dupe++; else err++;
    }
    setImporting(false); setResults({ok,dupe,err});
    if(ok>0) onRefresh();
  };
  return (
    <div>
      <div style={{marginBottom:24}}><div style={{fontSize:22,fontWeight:700,color:theme.text}}>Importar CSV</div><div style={{fontSize:13,color:theme.muted,marginTop:4}}>Carga tu production log desde Google Sheets</div></div>
      <div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:8,padding:20,marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",marginBottom:12}}>Formato esperado</div>
        <div style={{background:theme.bg,borderRadius:6,padding:12,fontSize:12,color:theme.muted,fontFamily:"monospace",marginBottom:12}}>Product ID | Product Name | Product Type | Niche | Creation Date</div>
        <div style={{fontSize:12,color:theme.muted,lineHeight:1.8}}>
          Separado por tabs (TSV)<br/>
          Product Type debe coincidir con nombre existente o codigo Zazzle<br/>
          Duplicados ignorados automaticamente por Product ID
        </div>
      </div>
      <div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:8,padding:20}}>
        <div style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",marginBottom:8}}>Selecciona el archivo</div>
        <input type="file" accept=".csv,.tsv,.txt" onChange={handleFile} style={{color:theme.text,marginBottom:16,display:"block"}}/>
        {rows.length>0&&(
          <div style={{marginBottom:16}}>
            <div style={{fontSize:13,marginBottom:8,color:theme.text}}><span style={{color:theme.accent,fontWeight:700}}>{rows.length}</span> filas detectadas</div>
            <div style={{overflowX:"auto",maxHeight:200,overflowY:"auto",marginBottom:12}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead><tr>{["Product ID","Nombre","Type","Niche","Fecha"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 10px",fontSize:10,fontWeight:600,color:theme.muted,textTransform:"uppercase",borderBottom:`1px solid ${theme.border}`}}>{h}</th>)}</tr></thead>
                <tbody>
                  {rows.slice(0,10).map((r,i)=>(
                    <tr key={i}>
                      <td style={{padding:"6px 10px",borderBottom:`1px solid ${theme.border}`,fontSize:11,color:theme.muted}}>{r.product_id}</td>
                      <td style={{padding:"6px 10px",borderBottom:`1px solid ${theme.border}`,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:theme.text}}>{r.product_name}</td>
                      <td style={{padding:"6px 10px",borderBottom:`1px solid ${theme.border}`,color:theme.text}}>{r.product_type}</td>
                      <td style={{padding:"6px 10px",borderBottom:`1px solid ${theme.border}`,color:theme.text}}>{r.niche}</td>
                      <td style={{padding:"6px 10px",borderBottom:`1px solid ${theme.border}`,fontSize:11,color:theme.muted}}>{r.creation_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length>10&&<div style={{textAlign:"center",padding:8,color:theme.muted,fontSize:11}}>...y {rows.length-10} mas</div>}
            </div>
            <button onClick={handleImport} disabled={importing} style={{padding:"8px 16px",background:theme.accent,color:"#fff",border:"none",borderRadius:6,fontSize:13,fontWeight:600,cursor:"pointer"}}>{importing?"Importando...":"Importar "+rows.length+" productos"}</button>
          </div>
        )}
        {results&&(
          <div style={{background:theme.bg,borderRadius:8,padding:16,marginTop:8,border:`1px solid ${theme.border}`}}>
            <div style={{fontSize:14,fontWeight:600,marginBottom:8,color:theme.text}}>Resultado:</div>
            <div style={{display:"flex",gap:20,fontSize:13}}>
              <span style={{color:theme.success}}>{results.ok} importados</span>
              <span style={{color:theme.medium}}>{results.dupe} duplicados ignorados</span>
              {results.err>0&&<span style={{color:theme.danger}}>{results.err} errores</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Analytics({ products, productTypes, niches, nicheCategories }) {
  const lmhCounts = { low:0, medium:0, high:0 };
  products.forEach(p=>{ const pt=productTypes.find(t=>t.id===p.product_type_id); if(pt) lmhCounts[pt.lmh]=(lmhCounts[pt.lmh]||0)+1; });
  const total = products.length||1;
  const nicheMap = {};
  products.forEach(p=>{ const n=niches.find(x=>x.id===p.niche_id); if(n) nicheMap[n.name]=(nicheMap[n.name]||0)+1; });
  const typeMap = {};
  products.forEach(p=>{ const t=productTypes.find(x=>x.id===p.product_type_id); if(t) typeMap[t.name]=(typeMap[t.name]||0)+1; });
  const catMap = {};
  products.forEach(p=>{ const n=niches.find(x=>x.id===p.niche_id); if(n){ const cat=nicheCategories.find(c=>c.id===n.category_id); if(cat) catMap[cat.name]=(catMap[cat.name]||0)+1; } });
  const sortedNiches = Object.entries(nicheMap).sort((a,b)=>b[1]-a[1]);
  const sortedTypes = Object.entries(typeMap).sort((a,b)=>b[1]-a[1]);
  const sortedCats = Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
  return (
    <div>
      <div style={{marginBottom:24}}><div style={{fontSize:22,fontWeight:700,color:theme.text}}>Analytics</div><div style={{fontSize:13,color:theme.muted,marginTop:4}}>Analisis de distribucion e inventario</div></div>
      <div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:8,padding:20,marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",marginBottom:12}}>Distribucion LMH — {products.length} productos</div>
        <div style={{display:"flex",gap:24,marginBottom:16}}>
          {["low","medium","high"].map(k=>(
            <div key={k}><div style={{fontSize:28,fontWeight:700,color:lmhColor(k)}}>{((lmhCounts[k]||0)/total*100).toFixed(1)}%</div><div style={{fontSize:12,color:theme.muted,textTransform:"capitalize"}}>{k} — {lmhCounts[k]||0} productos</div></div>
          ))}
        </div>
        <div style={{display:"flex",height:10,borderRadius:4,overflow:"hidden",gap:2}}>
          {["low","medium","high"].map(k=><div key={k} style={{width:`${(lmhCounts[k]||0)/total*100}%`,background:lmhColor(k),borderRadius:2}}/>)}
        </div>
        {lmhCounts.low>lmhCounts.high*3&&<div style={{marginTop:12,padding:"8px 12px",background:"rgba(181,130,10,0.08)",border:"1px solid rgba(181,130,10,0.25)",borderRadius:6,fontSize:12,color:theme.medium}}>Inventario con mucho Low en relacion a High. Considera producir mas High royalty.</div>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:8,padding:20}}>
          <div style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",marginBottom:12}}>Por categoria</div>
          {sortedCats.map(([name,count])=>(
            <div key={name} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:3,color:theme.text}}><span>{name}</span><span style={{color:theme.muted}}>{count} ({(count/total*100).toFixed(1)}%)</span></div>
              <div style={{height:5,background:theme.border,borderRadius:3}}><div style={{height:"100%",background:theme.accent,borderRadius:3,width:`${count/total*100}%`}}/></div>
            </div>
          ))}
        </div>
        <div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:8,padding:20}}>
          <div style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",marginBottom:12}}>Top 10 Niches</div>
          {sortedNiches.slice(0,10).map(([name,count])=>(
            <div key={name} style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:2,color:theme.text}}><span>{name}</span><span style={{color:theme.muted}}>{count}</span></div>
              <div style={{height:5,background:theme.border,borderRadius:3}}><div style={{height:"100%",background:theme.accent,borderRadius:3,width:`${count/sortedNiches[0][1]*100}%`}}/></div>
            </div>
          ))}
        </div>
      </div>
      <div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:8,padding:20}}>
        <div style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",marginBottom:12}}>Top Product Types</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr>{["Tipo","LMH","Cantidad","% Total",""].map(h=><th key={h} style={{textAlign:"left",padding:"10px 12px",fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",borderBottom:`1px solid ${theme.border}`}}>{h}</th>)}</tr></thead>
            <tbody>
              {sortedTypes.slice(0,20).map(([name,count])=>{
                const pt=productTypes.find(t=>t.name===name);
                return (
                  <tr key={name}>
                    <td style={{padding:"10px 12px",borderBottom:`1px solid ${theme.border}`,fontWeight:500,color:theme.text}}>{name}</td>
                    <td style={{padding:"10px 12px",borderBottom:`1px solid ${theme.border}`}}>{pt&&<span style={{padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:600,background:pt.lmh==="low"?"rgba(45,106,79,0.1)":pt.lmh==="medium"?"rgba(181,130,10,0.1)":"rgba(192,57,43,0.1)",color:lmhColor(pt.lmh)}}>{pt.lmh}</span>}</td>
                    <td style={{padding:"10px 12px",borderBottom:`1px solid ${theme.border}`,fontWeight:700,color:theme.accent}}>{count}</td>
                    <td style={{padding:"10px 12px",borderBottom:`1px solid ${theme.border}`,color:theme.muted}}>{(count/total*100).toFixed(1)}%</td>
                    <td style={{padding:"10px 12px",borderBottom:`1px solid ${theme.border}`,width:120}}><div style={{height:5,background:theme.border,borderRadius:3}}><div style={{height:"100%",background:theme.accent,borderRadius:3,width:`${count/sortedTypes[0][1]*100}%`}}/></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Reports({ products, actions, productTypes, niches }) {
  const [period, setPeriod] = useState("month");
  const now = new Date();
  const ranges = { day:now.toISOString().split("T")[0], week:new Date(now-7*86400000).toISOString().split("T")[0], month:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01` };
  const from = ranges[period];
  const periodProducts = products.filter(p=>p.created_date>=from);
  const periodActions = actions.filter(a=>a.date>=from);
  const lmhCount = {low:0,medium:0,high:0};
  periodProducts.forEach(p=>{ const pt=productTypes.find(t=>t.id===p.product_type_id); if(pt) lmhCount[pt.lmh]=(lmhCount[pt.lmh]||0)+1; });
  const nicheCount = {};
  periodProducts.forEach(p=>{ const n=niches.find(x=>x.id===p.niche_id); if(n) nicheCount[n.name]=(nicheCount[n.name]||0)+1; });
  const typeCount = {};
  periodProducts.forEach(p=>{ const t=productTypes.find(x=>x.id===p.product_type_id); if(t) typeCount[t.name]=(typeCount[t.name]||0)+1; });
  const exportCSV = () => {
    const lines = [["MINTIC PRODUCTION HUB — REPORTE"],[`Periodo: ${period==="day"?"Hoy":period==="week"?"Esta semana":"Este mes"}`],[`Fecha: ${now.toLocaleDateString()}`],[],["PRODUCCION"],["Total",periodProducts.length],["Low",lmhCount.low],["Medium",lmhCount.medium],["High",lmhCount.high],[],["NICHES"],...Object.entries(nicheCount).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,v]),[],["PRODUCT TYPES"],...Object.entries(typeCount).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,v]),[],["BEST SELLER ACTIONS",periodActions.length]];
    const csv = lines.map(r=>r.join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`mintic-report-${period}-${from}.csv`; a.click();
  };
  const label = {day:"Hoy",week:"Esta semana",month:"Este mes"};
  return (
    <div>
      <div style={{marginBottom:24,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div><div style={{fontSize:22,fontWeight:700,color:theme.text}}>Reportes</div><div style={{fontSize:13,color:theme.muted,marginTop:4}}>Resumen de produccion y acciones</div></div>
        <button onClick={exportCSV} style={{padding:"8px 16px",background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:6,color:theme.text,fontSize:13,cursor:"pointer"}}>Exportar CSV</button>
      </div>
      <div style={{display:"flex",gap:4,marginBottom:20,background:theme.surface,padding:4,borderRadius:6,width:"fit-content",border:`1px solid ${theme.border}`}}>
        {["day","week","month"].map(p=><div key={p} onClick={()=>setPeriod(p)} style={{padding:"6px 14px",borderRadius:5,fontSize:13,fontWeight:500,cursor:"pointer",background:period===p?theme.accent:"transparent",color:period===p?"#fff":theme.muted}}>{label[p]}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:16}}>
        <div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:8,padding:20}}><div style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",marginBottom:8}}>Productos</div><div style={{fontSize:36,fontWeight:700,color:theme.text}}>{periodProducts.length}</div></div>
        <div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:8,padding:20}}><div style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",marginBottom:8}}>BS Actions</div><div style={{fontSize:36,fontWeight:700,color:theme.text}}>{periodActions.length}</div></div>
        <div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:8,padding:20}}><div style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",marginBottom:8}}>LMH</div><div style={{display:"flex",gap:12,marginTop:4}}>{["low","medium","high"].map(k=><div key={k}><div style={{fontSize:20,fontWeight:700,color:lmhColor(k)}}>{lmhCount[k]||0}</div><div style={{fontSize:10,color:theme.muted,textTransform:"capitalize"}}>{k}</div></div>)}</div></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:8,padding:20}}>
          <div style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",marginBottom:12}}>Niches</div>
          {Object.entries(nicheCount).sort((a,b)=>b[1]-a[1]).map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${theme.border}`,fontSize:13,color:theme.text}}><span>{k}</span><span style={{color:theme.accent,fontWeight:600}}>{v}</span></div>)}
          {Object.keys(nicheCount).length===0&&<div style={{color:theme.muted,fontSize:12}}>Sin datos en este periodo</div>}
        </div>
        <div style={{background:theme.surface,border:`1px solid ${theme.border}`,borderRadius:8,padding:20}}>
          <div style={{fontSize:11,fontWeight:600,color:theme.muted,textTransform:"uppercase",marginBottom:12}}>Product Types</div>
          {Object.entries(typeCount).sort((a,b)=>b[1]-a[1]).map(([k,v])=><div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${theme.border}`,fontSize:13,color:theme.text}}><span>{k}</span><span style={{color:theme.accent,fontWeight:600}}>{v}</span></div>)}
          {Object.keys(typeCount).length===0&&<div style={{color:theme.muted,fontSize:12}}>Sin datos en este periodo</div>}
        </div>
      </div>
    </div>
  );
}

const NAV = [
  { section:"Principal" },
  { id:"dashboard", label:"Dashboard" },
  { id:"quickadd", label:"Quick Add" },
  { section:"Inventario" },
  { id:"products", label:"Product Master" },
  { id:"import", label:"Importar CSV" },
  { section:"Configuracion" },
  { id:"types", label:"Product Types" },
  { id:"niches", label:"Niches" },
  { section:"Ventas" },
  { id:"actions", label:"BS Actions" },
  { id:"importar-royalties", label:"Importar Royalties" },
  { id:"importar-referrals", label:"Importar Referrals" },

  { section:"Analisis" },
  { id:"analytics", label:"Analytics" },
  { id:"reports", label:"Reportes" },
];

function getInitialPage() {
  if (typeof window === "undefined") return "dashboard";
  const path = window.location.pathname.replace(/^\//, "");
  if (!path) return "dashboard";
  return path === "importar-royalties" ? "importar-royalties" : "dashboard";
}

export default function App() {
  const [page, setPage] = useState(getInitialPage);
  const [products, setProducts] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [niches, setNiches] = useState([]);
  const [nicheCategories, setNicheCategories] = useState([]);
  const [actions, setActions] = useState([]);
  const [inventoryTotal, setInventoryTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const showToast = (msg, type="success") => setToast({msg,type});
  const loadAll = useCallback(async () => {
    setLoading(true);
    const [p,pt,n,nc,a,snap,newProds] = await Promise.all([
      supabase.from("products").select("*").order("created_date",{ascending:false}),
      supabase.from("product_types").select("*").order("name"),
      supabase.from("niches").select("*").order("name"),
      supabase.from("niche_categories").select("*").order("name"),
      supabase.from("best_seller_actions").select("*").order("date",{ascending:false}),
      supabase.from("inventory_snapshots").select("total_products").eq("snapshot_date","2026-06-22").eq("snapshot_type","niche"),
      supabase.from("products").select("id",{count:"exact",head:true}).gt("created_date","2026-06-22"),
    ]);
    setProducts(p.data||[]); setProductTypes(pt.data||[]); setNiches(n.data||[]); setNicheCategories(nc.data||[]); setActions(a.data||[]);
    const snapTotal = (snap.data||[]).reduce((acc,r)=>acc+r.total_products,0);
    const newCount = newProds.count||0;
    setInventoryTotal(snapTotal + newCount);
    setLoading(false);
  }, []);
  useEffect(()=>{ loadAll(); },[loadAll]);
  useEffect(() => {
    const syncPageFromPath = () => {
      const path = window.location.pathname.replace(/^\//, "");
      if (path === "importar-royalties") setPage("importar-royalties");
      else if (path === "") setPage("dashboard");
    };
    syncPageFromPath();
    window.addEventListener("popstate", syncPageFromPath);
    return () => window.removeEventListener("popstate", syncPageFromPath);
  }, []);

  const common = { products, productTypes, niches, nicheCategories, actions, onRefresh:loadAll, showToast, inventoryTotal };

  const handleNavigate = (nextPage) => {
    setPage(nextPage);
    const path = nextPage === "importar-royalties" ? "/importar-royalties" : "/";
    window.history.pushState({}, "", path);
  };

  return (
    <div style={{display:"flex",minHeight:"100vh",background:theme.bg,color:theme.text,fontFamily:"Inter, system-ui, sans-serif"}}>
      <aside style={{width:210,minWidth:210,background:theme.surface,borderRight:`1px solid ${theme.border}`,padding:"24px 0",display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh"}}>
        <div style={{padding:"0 20px 20px",borderBottom:`1px solid ${theme.border}`}}>
          <div style={{fontSize:13,fontWeight:700,color:theme.accent,letterSpacing:"0.06em",textTransform:"uppercase"}}>Mintic Hub</div>
          <div style={{fontSize:11,color:theme.muted,marginTop:2}}>Production Manager</div>
        </div>
        <nav style={{flex:1,padding:"8px 0",overflowY:"auto"}}>
          {NAV.map((item,i)=>
            item.section
              ? <div key={i} style={{padding:"14px 20px 4px",fontSize:10,fontWeight:600,color:theme.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>{item.section}</div>
              : <div key={item.id} onClick={()=>handleNavigate(item.id)} style={{display:"flex",alignItems:"center",padding:"8px 20px",fontSize:13,color:page===item.id?theme.accent:theme.muted,cursor:"pointer",background:page===item.id?"rgba(45,106,79,0.07)":"transparent",borderLeft:`2px solid ${page===item.id?theme.accent:"transparent"}`,fontWeight:page===item.id?600:400}}>
                  {item.label}
                </div>
          )}
        </nav>
        <div style={{padding:"14px 20px",borderTop:`1px solid ${theme.border}`,fontSize:11,color:theme.muted}}>{inventoryTotal} productos</div>
      </aside>
      <main style={{flex:1,padding:"28px 32px",overflowY:"auto",minWidth:0,background:theme.bg}}>
        {loading
          ? <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"60vh",color:theme.muted,fontSize:14}}>Cargando datos...</div>
          : <>
              {page==="dashboard"&&<Dashboard {...common}/>}
              {page==="quickadd"&&<QuickAdd {...common} onSave={loadAll}/>}
              {page==="products"&&<ProductMaster {...common}/>}
              {page==="import"&&<ImportCSV {...common}/>}
              {page==="importar-royalties"&&<ImportarRoyalties showToast={showToast}/>}
            {page==="importar-referrals"&&<ImportarReferrals showToast={showToast}/>}

              {page==="types"&&<ProductTypes {...common}/>}
              {page==="niches"&&<Niches {...common}/>}
              {page==="actions"&&<BestSellerActions {...common}/>}
              {page==="analytics"&&<Analytics {...common}/>}
              {page==="reports"&&<Reports {...common}/>}
            </>
        }
      </main>
      {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    </div>
  );
}
