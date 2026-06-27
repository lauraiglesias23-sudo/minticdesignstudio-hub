import { useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function fmt$(n) { if (n == null) return "—"; return "$" + Number(n).toFixed(2); }
function fmtN(n) { if (n == null) return "—"; return Number(n).toLocaleString(); }
function fmtPct(n) { if (n == null) return "—"; return Number(n).toFixed(2) + "%"; }
function delta(current, previous) {
  if (!previous || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function DeltaBadge({ value }) {
  if (value == null) return <span style={{ color: "#888", fontSize: 12 }}>—</span>;
  const positive = value >= 0;
  return (
    <span style={{ fontSize: 12, fontWeight: 600, color: positive ? "#22c55e" : "#ef4444",
      background: positive ? "#dcfce7" : "#fee2e2", borderRadius: 4, padding: "2px 6px", marginLeft: 6 }}>
      {positive ? "▲" : "▼"} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function computeComparisonPeriods(startDate, endDate) {
  const s = new Date(startDate + "T00:00:00");
  const e = new Date(endDate + "T00:00:00");
  const monthsDiff = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
  const prevEnd = new Date(s.getFullYear(), s.getMonth(), 0);
  const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth() - monthsDiff + 1, 1);
  const yoyStart = new Date(s.getFullYear() - 1, s.getMonth(), 1);
  const yoyEnd = new Date(e.getFullYear() - 1, e.getMonth() + 1, 0);
  const fmt = (d) => d.toISOString().split("T")[0];
  return { prevStart: fmt(prevStart), prevEnd: fmt(prevEnd), yoyStart: fmt(yoyStart), yoyEnd: fmt(yoyEnd) };
}

function periodLabel(start, end) {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth())
    return m[s.getMonth()] + " " + s.getFullYear();
  return m[s.getMonth()] + " " + s.getFullYear() + " – " + m[e.getMonth()] + " " + e.getFullYear();
}

async function fetchSalesMetrics(start, end) {
  const { data, error } = await supabase.from("sales").select("royalty_usd, order_id, customer_id, product_id")
    .neq("status", "canceled").gte("sale_date", start + "T00:00:00").lte("sale_date", end + "T23:59:59");
  if (error) throw error;
  const revenue = data.reduce((s, r) => s + Number(r.royalty_usd || 0), 0);
  const orderIds = new Set(data.map((r) => r.order_id));
  const customerIds = new Set(data.map((r) => r.customer_id));
  const orders = orderIds.size;
  const aov = orders > 0 ? revenue / orders : 0;
  return { revenue, orders, uniqueCustomers: customerIds.size, aov };
}

async function fetchReferralMetrics(start, end) {
  const { data, error } = await supabase.from("referrals").select("referral_amount_usd, converted_referral_usd")
    .neq("status", "canceled").gte("referral_date", start).lte("referral_date", end);
  if (error) throw error;
  const referralEarnings = data.reduce((s, r) => s + Number(r.converted_referral_usd || r.referral_amount_usd || 0), 0);
  return { referralEarnings };
}

async function fetchSuccessRate(start, end) {
  const { data: sd } = await supabase.from("sales").select("product_id")
    .neq("status","canceled").gte("sale_date", start+"T00:00:00").lte("sale_date", end+"T23:59:59");
  const selling = new Set((sd||[]).map(r => r.product_id.replace(/-/g,""))).size;
  const { count } = await supabase.from("products").select("id",{count:"exact",head:true}).lte("created_date", end);
  return { sellingProducts: selling, totalProducts: count||0, successRate: count > 0 ? (selling/count)*100 : 0 };
}

async function fetchConversionRate(start, end) {
  const { data: sd } = await supabase.from("sales").select("order_id")
    .neq("status","canceled").gte("sale_date",start+"T00:00:00").lte("sale_date",end+"T23:59:59");
  const orders = new Set((sd||[]).map(r=>r.order_id)).size;
  const { data: vd } = await supabase.from("best_seller_actions").select("views");
  const totalViews = (vd||[]).reduce((s,r)=>s+Number(r.views||0),0);
  if (!totalViews || !orders) return { conversionRate: null, viewsPerOrder: null };
  return { conversionRate: (orders/totalViews)*100, viewsPerOrder: totalViews/orders };
}

async function fetchNewProducts(start, end) {
  const { count } = await supabase.from("products").select("id",{count:"exact",head:true})
    .gte("created_date", start).lte("created_date", end);
  return { newProducts: count||0 };
}

async function fetchNicheData(start, end) {
  const { count: wn } = await supabase.from("products").select("id",{count:"exact",head:true}).not("niche_id","is",null);
  if (!wn || wn < 50) return { hasData: false };
  const { data: sd } = await supabase.from("sales").select("royalty_usd,product_id")
    .neq("status","canceled").gte("sale_date",start+"T00:00:00").lte("sale_date",end+"T23:59:59");
  const { data: pd } = await supabase.from("products").select("product_id,niche_id").not("niche_id","is",null);
  const { data: nd } = await supabase.from("niches").select("id,name");
  const nicheMap = {}; (nd||[]).forEach(n => nicheMap[n.id]=n.name);
  const pnMap = {}; (pd||[]).forEach(p => pnMap[p.product_id.replace(/-/g,"")]=p.niche_id);
  const earn = {};
  (sd||[]).forEach(s => { const nid=pnMap[s.product_id.replace(/-/g,"")]; if(nid) earn[nid]=(earn[nid]||0)+Number(s.royalty_usd||0); });
  const top = Object.entries(earn).sort(([,a],[,b])=>b-a).slice(0,5).map(([id,e])=>({name:nicheMap[id]||id,earnings:e}));
  return { hasData: true, topNiches: top };
}

export default function MonthlyReview() {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth()+1, 0).toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(lastOfMonth);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const runReport = useCallback(async () => {
    setLoading(true); setError(null); setReport(null);
    try {
      const { prevStart, prevEnd, yoyStart, yoyEnd } = computeComparisonPeriods(startDate, endDate);
      const [cur, prv, yy, curRef, prvRef, yyRef, curSR, prvSR, yySR, curCR, curNew, prvNew] = await Promise.all([
        fetchSalesMetrics(startDate, endDate), fetchSalesMetrics(prevStart, prevEnd), fetchSalesMetrics(yoyStart, yoyEnd),
        fetchReferralMetrics(startDate, endDate), fetchReferralMetrics(prevStart, prevEnd), fetchReferralMetrics(yoyStart, yoyEnd),
        fetchSuccessRate(startDate, endDate), fetchSuccessRate(prevStart, prevEnd), fetchSuccessRate(yoyStart, yoyEnd),
        fetchConversionRate(startDate, endDate), fetchNewProducts(startDate, endDate), fetchNewProducts(prevStart, prevEnd),
      ]);
      const nicheData = await fetchNicheData(startDate, endDate);
      setReport({ period:{start:startDate,end:endDate}, prevPeriod:{start:prevStart,end:prevEnd},
        yoyPeriod:{start:yoyStart,end:yoyEnd}, cur, prv, yy, curRef, prvRef, yyRef, curSR, prvSR, yySR, curCR, curNew, prvNew, nicheData });
    } catch(e) { setError(e.message); } finally { setLoading(false); }
  }, [startDate, endDate]);

  const buildText = () => {
    if (!report) return "";
    const { cur, prv, yy, curRef, prvRef, yyRef, curSR, prvSR, yySR, curCR, curNew, prvNew, nicheData } = report;
    const dMoM = (c,p) => { if(!p||p===0) return "n/a"; const d=((c-p)/Math.abs(p))*100; return (d>=0?"+":"")+d.toFixed(1)+"%"; };
    const totalCur = cur.revenue + curRef.referralEarnings;
    const totalPrv = prv.revenue + prvRef.referralEarnings;
    const totalYY = yy.revenue + yyRef.referralEarnings;
    let t = "MONTHLY REVIEW — " + periodLabel(report.period.start, report.period.end).toUpperCase() + "\n";
    t += "Generated: " + new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}) + "\n";
    t += "\n" + "─".repeat(50) + "\n";
    t += "SECTION 1 — EXECUTIVE DASHBOARD\n" + "─".repeat(50) + "\n\n";
    t += "Total Earnings:      " + fmt$(cur.revenue) + "  MoM: " + dMoM(cur.revenue,prv.revenue) + "  YoY: " + dMoM(cur.revenue,yy.revenue) + "\n";
    t += "Referral Earnings:   " + fmt$(curRef.referralEarnings) + "  MoM: " + dMoM(curRef.referralEarnings,prvRef.referralEarnings) + "  YoY: " + dMoM(curRef.referralEarnings,yyRef.referralEarnings) + "\n";
    t += "Total + Referrals:   " + fmt$(totalCur) + "  MoM: " + dMoM(totalCur,totalPrv) + "  YoY: " + dMoM(totalCur,totalYY) + "\n\n";
    t += "Orders:              " + cur.orders + "  MoM: " + dMoM(cur.orders,prv.orders) + "  YoY: " + dMoM(cur.orders,yy.orders) + "\n";
    t += "Unique Customers:    " + cur.uniqueCustomers + "  MoM: " + dMoM(cur.uniqueCustomers,prv.uniqueCustomers) + "  YoY: " + dMoM(cur.uniqueCustomers,yy.uniqueCustomers) + "\n";
    t += "AOV:                 " + fmt$(cur.aov) + "  MoM: " + dMoM(cur.aov,prv.aov) + "  YoY: " + dMoM(cur.aov,yy.aov) + "\n";
    t += "Success Rate:        " + fmtPct(curSR.successRate) + "  MoM: " + dMoM(curSR.successRate,prvSR.successRate) + "  YoY: " + dMoM(curSR.successRate,yySR.successRate) + "\n";
    if (curCR.conversionRate != null) {
      t += "Conversion Rate:     " + curCR.conversionRate.toFixed(3) + "%  (~" + Math.round(curCR.viewsPerOrder) + " views/order)\n";
    } else { t += "Conversion Rate:     No views data\n"; }
    t += "\n" + "─".repeat(50) + "\n";
    t += "SECTION 2 — INVENTORY\n" + "─".repeat(50) + "\n\n";
    t += "Products Created:    " + curNew.newProducts + "  MoM: " + dMoM(curNew.newProducts, prvNew.newProducts) + "\n";
    t += "Selling Products:    " + curSR.sellingProducts + " of " + curSR.totalProducts + "\n";
    t += "\n" + "─".repeat(50) + "\n";
    t += "SECTION 3 — NICHES\n" + "─".repeat(50) + "\n\n";
    if (!nicheData.hasData) { t += "No niche data. Assign niche_id in Product Master.\n"; }
    else { nicheData.topNiches.forEach((n,i) => { t += (i+1) + ". " + n.name + " — " + fmt$(n.earnings) + "\n"; }); }
    t += "\nComparison: prev=" + periodLabel(report.prevPeriod.start,report.prevPeriod.end);
    t += "  yoy=" + periodLabel(report.yoyPeriod.start,report.yoyPeriod.end) + "\n";
    return t;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(buildText()).then(() => { setCopied(true); setTimeout(()=>setCopied(false),2000); });
  };

  const s = {
    wrap: { padding:"24px", maxWidth:900, margin:"0 auto", fontFamily:"inherit" },
    title: { fontSize:22, fontWeight:700, color:"#1e293b", margin:0 },
    subtitle: { fontSize:14, color:"#64748b", marginTop:4 },
    controls: { display:"flex", gap:12, alignItems:"flex-end", flexWrap:"wrap", marginBottom:24, marginTop:16 },
    label: { fontSize:12, fontWeight:600, color:"#475569", display:"block", marginBottom:4 },
    input: { border:"1px solid #e2e8f0", borderRadius:8, padding:"8px 12px", fontSize:14, color:"#1e293b", background:"#fff" },
    btn: { background:"#1e293b", color:"#fff", border:"none", borderRadius:8, padding:"9px 20px", fontSize:14, fontWeight:600, cursor:"pointer" },
    btnSec: { background:"#f1f5f9", color:"#1e293b", border:"1px solid #e2e8f0", borderRadius:8, padding:"9px 20px", fontSize:14, fontWeight:600, cursor:"pointer" },
    card: { background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, padding:"20px 24px", marginBottom:16 },
    secTitle: { fontSize:13, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:16, paddingBottom:8, borderBottom:"1px solid #f1f5f9" },
    grid: { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))", gap:16 },
    mLabel: { fontSize:12, color:"#94a3b8", fontWeight:500, marginBottom:4 },
    mValue: { fontSize:22, fontWeight:700, color:"#1e293b" },
    mRow: { display:"flex", alignItems:"baseline", gap:4, flexWrap:"wrap", marginTop:4 },
    cLabel: { fontSize:11, color:"#94a3b8" },
    empty: { color:"#94a3b8", fontSize:14, fontStyle:"italic" },
    lmhBar: { display:"flex", gap:8, marginTop:8 },
    lmhItem: { flex:1, textAlign:"center", borderRadius:8, padding:"10px 4px" },
    error: { background:"#fee2e2", color:"#dc2626", borderRadius:8, padding:"12px 16px", fontSize:14, marginBottom:16 },
  };

  const Metric = ({ label, cur, prv, yy, fmt=fmt$ }) => (
    <div>
      <div style={s.mLabel}>{label}</div>
      <div style={s.mValue}>{fmt(cur)}</div>
      <div style={s.mRow}><span style={s.cLabel}>MoM</span>
        <DeltaBadge value={delta(cur,prv)}/>
      </div>
      <div style={s.mRow}><span style={s.cLabel}>YoY</span>
        <DeltaBadge value={delta(cur,yy)}/>
      </div>
    </div>
  );

  const lmh = { low:1895, medium:1439, high:407, total:3741 };

  return (
    <div style={s.wrap}>
      <h1 style={s.title}>Monthly Review</h1>
      <p style={s.subtitle}>Mintic Design Studio — Performance Report</p>
      <div style={s.controls}>
        <div><label style={s.label}>From</label>
          <input type="date" style={s.input} value={startDate} onChange={e=>setStartDate(e.target.value)}/>
        </div>
        <div><label style={s.label}>To</label>
          <input type="date" style={s.input} value={endDate} onChange={e=>setEndDate(e.target.value)}/>
        </div>
        <button style={s.btn} onClick={runReport} disabled={loading}>{loading?"Loading…":"Run Report"}</button>
        {report && <button style={s.btnSec} onClick={handleCopy}>{copied?"✓ Copied!":"Copy to Clipboard"}</button>}
      </div>
      {error && <div style={s.error}>Error: {error}</div>}
      {report && (() => {
        const { cur, prv, yy, curRef, prvRef, yyRef, curSR, prvSR, yySR, curCR, curNew, prvNew, nicheData } = report;
        const totalCur = cur.revenue + curRef.referralEarnings;
        const totalPrv = prv.revenue + prvRef.referralEarnings;
        const totalYY = yy.revenue + yyRef.referralEarnings;
        return (
          <>
            <div style={{marginBottom:16,fontSize:13,color:"#64748b"}}>
              <strong style={{color:"#1e293b"}}>{periodLabel(report.period.start,report.period.end)}</strong>
              {" vs "}<span>{periodLabel(report.prevPeriod.start,report.prevPeriod.end)}</span>
              {" · vs "}<span>{periodLabel(report.yoyPeriod.start,report.yoyPeriod.end)}</span>
            </div>
            <div style={s.card}>
              <div style={s.secTitle}>Executive Dashboard</div>
              <div style={s.grid}>
                <Metric label="Total Earnings" cur={cur.revenue} prv={prv.revenue} yy={yy.revenue}/>
                <Metric label="Referral Earnings" cur={curRef.referralEarnings} prv={prvRef.referralEarnings} yy={yyRef.referralEarnings}/>
                <Metric label="Total + Referrals" cur={totalCur} prv={totalPrv} yy={totalYY}/>
                <Metric label="Orders" cur={cur.orders} prv={prv.orders} yy={yy.orders} fmt={fmtN}/>
                <Metric label="Unique Customers" cur={cur.uniqueCustomers} prv={prv.uniqueCustomers} yy={yy.uniqueCustomers} fmt={fmtN}/>
                <Metric label="AOV" cur={cur.aov} prv={prv.aov} yy={yy.aov}/>
                <Metric label="Success Rate" cur={curSR.successRate} prv={prvSR.successRate} yy={yySR.successRate} fmt={fmtPct}/>
                <div>
                  <div style={s.mLabel}>Conversion Rate (approx)</div>
                  {curCR.conversionRate != null ? (
                    <><div style={s.mValue}>{curCR.conversionRate.toFixed(3)}%</div>
                    <div style={{fontSize:12,color:"#94a3b8",marginTop:4}}>~{Math.round(curCR.viewsPerOrder)} views/order</div></>
                  ) : <div style={s.empty}>No views data</div>}
                </div>
              </div>
            </div>
            <div style={s.card}>
              <div style={s.secTitle}>Inventory</div>
              <div style={s.grid}>
                <div>
                  <div style={s.mLabel}>Products Created</div>
                  <div style={s.mValue}>{fmtN(curNew.newProducts)}</div>
                  <div style={s.mRow}><span style={s.cLabel}>MoM</span><DeltaBadge value={delta(curNew.newProducts,prvNew.newProducts)}/></div>
                </div>
                <div>
                  <div style={s.mLabel}>Selling Products</div>
                  <div style={s.mValue}>{fmtN(curSR.sellingProducts)}</div>
                  <div style={{fontSize:12,color:"#94a3b8",marginTop:4}}>of {fmtN(curSR.totalProducts)} total</div>
                </div>
              </div>
              <div style={{marginTop:20}}>
                <div style={{...s.mLabel,marginBottom:8}}>LMH Distribution (Jun 22 snapshot)</div>
                <div style={s.lmhBar}>
                  <div style={{...s.lmhItem,background:"#dbeafe"}}>
                    <div style={{fontSize:18,fontWeight:700,color:"#1d4ed8"}}>{((lmh.low/lmh.total)*100).toFixed(0)}%</div>
                    <div style={{fontSize:11,color:"#3b82f6",marginTop:2}}>Low ({fmtN(lmh.low)})</div>
                  </div>
                  <div style={{...s.lmhItem,background:"#fef9c3"}}>
                    <div style={{fontSize:18,fontWeight:700,color:"#a16207"}}>{((lmh.medium/lmh.total)*100).toFixed(0)}%</div>
                    <div style={{fontSize:11,color:"#ca8a04",marginTop:2}}>Medium ({fmtN(lmh.medium)})</div>
                  </div>
                  <div style={{...s.lmhItem,background:"#dcfce7"}}>
                    <div style={{fontSize:18,fontWeight:700,color:"#15803d"}}>{((lmh.high/lmh.total)*100).toFixed(0)}%</div>
                    <div style={{fontSize:11,color:"#16a34a",marginTop:2}}>High ({fmtN(lmh.high)})</div>
                  </div>
                </div>
              </div>
            </div>
            <div style={s.card}>
              <div style={s.secTitle}>Niches</div>
              {!nicheData.hasData ? (
                <div style={s.empty}>No niche data yet. Assign niche_id in Product Master to enable this section.</div>
              ) : (
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}>
                  <thead><tr style={{borderBottom:"1px solid #f1f5f9"}}>
                    <th style={{textAlign:"left",padding:"6px 0",color:"#64748b",fontWeight:600,fontSize:12}}>#</th>
                    <th style={{textAlign:"left",padding:"6px 0",color:"#64748b",fontWeight:600,fontSize:12}}>Niche</th>
                    <th style={{textAlign:"right",padding:"6px 0",color:"#64748b",fontWeight:600,fontSize:12}}>Earnings</th>
                  </tr></thead>
                  <tbody>
                    {nicheData.topNiches.map((n,i) => (
                      <tr key={n.name} style={{borderBottom:"1px solid #f8fafc"}}>
                        <td style={{padding:"8px 0",color:"#94a3b8"}}>{i+1}</td>
                        <td style={{padding:"8px 0",color:"#1e293b",fontWeight:500}}>{n.name}</td>
                        <td style={{padding:"8px 0",textAlign:"right",fontWeight:600,color:"#1e293b"}}>{fmt$(n.earnings)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        );
      })()}
      {!report && !loading && (
        <div style={{...s.card,textAlign:"center",color:"#94a3b8",padding:"48px 24px"}}>
          Select a date range and click <strong>Run Report</strong>
        </div>
      )}
    </div>
  );
}