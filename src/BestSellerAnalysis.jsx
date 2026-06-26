function getDateRange(preset, customFrom, customTo) {
  const now = new Date();
  const fmtD = (d) => d.toISOString().split('T')[0];
  if (preset === 'all') return { from: null, to: null };
  if (preset === 'month') { const d = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()); return { from: fmtD(d), to: fmtD(now) }; }
  if (preset === '3m') { const d = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()); return { from: fmtD(d), to: fmtD(now) }; }
  if (preset === 'custom') return { from: customFrom || null, to: customTo || null };
  return { from: null, to: null };
}

function DateRangeSelector({ preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo }) {
  const inp = { padding: '6px 10px', background: theme.bg, border: '1px solid ' + theme.border, borderRadius: 6, color: theme.text, fontSize: 12, outline: 'none' };
  const presets = [{ id: 'all', label: 'All Time' }, { id: 'month', label: 'Last Month' }, { id: '3m', label: 'Last 3M' }, { id: 'custom', label: 'Custom' }];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 2, background: theme.surface, padding: 3, borderRadius: 6, border: '1px solid ' + theme.border }}>
        {presets.map((p) => (
          <div key={p.id} onClick={() => setPreset(p.id)} style={{ padding: '5px 12px', borderRadius: 5, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: preset === p.id ? theme.accent : 'transparent', color: preset === p.id ? '#fff' : theme.muted, whiteSpace: 'nowrap' }}>{p.label}</div>
        ))}
      </div>
      {preset === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="date" style={inp} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          <span style={{ color: theme.muted, fontSize: 12 }}>to</span>
          <input type="date" style={inp} value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
        </div>
      )}
    </div>
  );
}

function BestSellerAnalysis({ showToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('revenue');
  const [preset, setPreset] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { from, to } = getDateRange(preset, customFrom, customTo);
      let salesQ = supabase.from('sales').select('product_id, order_id, royalty_usd, customer_id, sale_date').neq('status', 'canceled');
      if (from) salesQ = salesQ.gte('sale_date', from);
      if (to) salesQ = salesQ.lte('sale_date', to);
      const [{ data: salesRaw }, { data: prodsRaw }, { data: actionsRaw }] = await Promise.all([
        salesQ,
        supabase.from('products').select('id, product_id, name, high_signal_seller, repeat_seller, lifetime_orders'),
        supabase.from('best_seller_actions').select('product_id, product_name, date, action, buildout_phase, asset_status').order('date', { ascending: false }),
      ]);
      const sales = salesRaw || [];
      const prods = prodsRaw || [];
      const actions = actionsRaw || [];
      const prodByStripped = {};
      prods.forEach((p) => { const s = (p.product_id || '').replace(/-/g, ''); prodByStripped[s] = p; });
      const agg = {};
      sales.forEach((s) => {
        const stripped = (s.product_id || '').replace(/-/g, '');
        if (!agg[stripped]) agg[stripped] = { revenue: 0, units: 0, customers: new Set(), orders: new Set() };
        agg[stripped].revenue += Number(s.royalty_usd || 0);
        agg[stripped].units += 1;
        if (s.customer_id) agg[stripped].customers.add(s.customer_id);
        if (s.order_id) agg[stripped].orders.add(s.order_id);
      });
      const ranked = Object.entries(agg).map(([stripped, d]) => {
        const prod = prodByStripped[stripped] || null;
        const rawId = prod ? (prod.product_id || stripped) : stripped;
        const zazzleId = rawId.replace(/-/g, '');
        const prodActions = actions.filter((a) => (a.product_id || '').replace(/-/g, '') === stripped);
        return {
          stripped,
          zazzleId,
          name: prod ? prod.name : 'ID: ' + stripped,
          revenue: Math.round(d.revenue * 100) / 100,
          units: d.units,
          customers: d.customers.size,
          orders: d.orders.size,
          highSignal: prod ? !!prod.high_signal_seller : false,
          repeat: prod ? !!prod.repeat_seller : false,
          actions: prodActions,
        };
      });
      const priorityA = ranked.filter((r) => r.highSignal && r.repeat);
      setData({
        byRevenue: [...ranked].sort((a, b) => b.revenue - a.revenue).slice(0, 15),
        byUnits: [...ranked].sort((a, b) => b.units - a.units).slice(0, 15),
        byCustomers: [...ranked].sort((a, b) => b.customers - a.customers).slice(0, 15),
        highSignal: ranked.filter((r) => r.highSignal).sort((a, b) => b.revenue - a.revenue),
        repeat: ranked.filter((r) => r.repeat).sort((a, b) => b.revenue - a.revenue),
        priorityA: priorityA.sort((a, b) => b.revenue - a.revenue),
        allByRevenue: [...ranked].sort((a, b) => b.revenue - a.revenue),
        allByUnits: [...ranked].sort((a, b) => b.units - a.units),
        allByCustomers: [...ranked].sort((a, b) => b.customers - a.customers),
        totalProducts: ranked.length,
      });
      setLoading(false);
    }
    load();
  }, [preset, customFrom, customTo]);

  const dSign = String.fromCharCode(36);
  const fmtM = (n) => dSign + Number(n).toFixed(2);
  const zazzleUrl = (id) => 'https://www.zazzle.com/store/minticdesignstudio/products?ps=128&rf=238497919993468326&dp=' + id;

  const exportCSV = () => {
    if (!data) return;
    const allMap = { revenue: data.allByRevenue, units: data.allByUnits, customers: data.allByCustomers };
    const rows = tab === 'signals' ? data.priorityA : (allMap[tab] || data.allByRevenue);
    const headers = ['Rank', 'Product Name', 'Product ID', 'URL', 'Revenue', 'Units', 'Customers', 'Orders', 'High Signal', 'Repeat', 'Priority A'];
    const lines = [headers.join(',')];
    rows.forEach((r, i) => {
      lines.push([
        i + 1,
        '"' + (r.name || '').replace(/"/g, '""') + '"',
        r.zazzleId,
        '"' + zazzleUrl(r.zazzleId) + '"',
        r.revenue.toFixed(2),
        r.units,
        r.customers,
        r.orders,
        r.highSignal ? 'Yes' : 'No',
        r.repeat ? 'Yes' : 'No',
        (r.highSignal && r.repeat) ? 'Yes' : 'No',
      ].join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'best_sellers_' + tab + '_' + preset + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    if (showToast) showToast('CSV exportado');
  };

  const Bdg = ({ label, color, bg }) => <span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 700, color, background: bg, marginLeft: 4 }}>{label}</span>;
  const tabs = [{ id: 'revenue', label: 'Top Revenue' }, { id: 'units', label: 'Top Unidades' }, { id: 'customers', label: 'Top Clientes' }, { id: 'signals', label: 'Signals' }];

  const colCfg = {
    revenue:   { mainLabel: 'Revenue',  mainKey: 'revenue',   mainFmt: fmtM,     secLabel: 'Unidades', secKey: 'units',    secFmt: (n) => n },
    units:     { mainLabel: 'Unidades', mainKey: 'units',     mainFmt: (n) => n, secLabel: 'Revenue',  secKey: 'revenue',  secFmt: fmtM },
    customers: { mainLabel: 'Clientes', mainKey: 'customers', mainFmt: (n) => n, secLabel: 'Revenue',  secKey: 'revenue',  secFmt: fmtM },
  };

  const tableRows = tab === 'revenue' ? (data ? data.byRevenue : []) : tab === 'units' ? (data ? data.byUnits : []) : (data ? data.byCustomers : []);
  const cfg = colCfg[tab] || colCfg.revenue;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>Best Seller Analysis</div>
          <div style={{ fontSize: 13, color: theme.muted, marginTop: 4 }}>Que debo multiplicar?</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <DateRangeSelector preset={preset} setPreset={setPreset} customFrom={customFrom} setCustomFrom={setCustomFrom} customTo={customTo} setCustomTo={setCustomTo} />
          <div onClick={exportCSV} style={{ padding: '7px 14px', background: theme.accent, color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Export CSV</div>
        </div>
      </div>
      {loading && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh', color: theme.muted, fontSize: 14 }}>Cargando...</div>}
      {!loading && data && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
            <div style={{ background: theme.surface, border: '1px solid ' + theme.border, borderRadius: 8, padding: 20 }}><div style={{ fontSize: 11, fontWeight: 600, color: theme.muted, textTransform: 'uppercase', marginBottom: 8 }}>Selling Products</div><div style={{ fontSize: 32, fontWeight: 700, color: theme.text }}>{data.totalProducts}</div></div>
            <div style={{ background: theme.surface, border: '1px solid ' + theme.border, borderRadius: 8, padding: 20 }}><div style={{ fontSize: 11, fontWeight: 600, color: theme.muted, textTransform: 'uppercase', marginBottom: 8 }}>Priority A</div><div style={{ fontSize: 32, fontWeight: 700, color: theme.danger }}>{data.priorityA.length}</div></div>
            <div style={{ background: theme.surface, border: '1px solid ' + theme.border, borderRadius: 8, padding: 20 }}><div style={{ fontSize: 11, fontWeight: 600, color: theme.muted, textTransform: 'uppercase', marginBottom: 8 }}>High Signal</div><div style={{ fontSize: 32, fontWeight: 700, color: theme.accent }}>{data.highSignal.length}</div></div>
            <div style={{ background: theme.surface, border: '1px solid ' + theme.border, borderRadius: 8, padding: 20 }}><div style={{ fontSize: 11, fontWeight: 600, color: theme.muted, textTransform: 'uppercase', marginBottom: 8 }}>Repeat Sellers</div><div style={{ fontSize: 32, fontWeight: 700, color: theme.medium }}>{data.repeat.length}</div></div>
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: theme.surface, padding: 4, borderRadius: 6, width: 'fit-content', border: '1px solid ' + theme.border }}>
            {tabs.map((t) => (<div key={t.id} onClick={() => setTab(t.id)} style={{ padding: '6px 14px', borderRadius: 5, fontSize: 13, fontWeight: 500, cursor: 'pointer', background: tab === t.id ? theme.accent : 'transparent', color: tab === t.id ? '#fff' : theme.muted }}>{t.label}</div>))}
          </div>
          {tab !== 'signals' && (
            <div style={{ background: theme.surface, border: '1px solid ' + theme.border, borderRadius: 8, padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: theme.muted, textTransform: 'uppercase', marginBottom: 12 }}>Top 15 por {cfg.mainLabel}</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {['#', 'Producto', 'Product ID', cfg.mainLabel, cfg.secLabel, 'Clientes', 'Senales'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 600, color: theme.muted, textTransform: 'uppercase', borderBottom: '1px solid ' + theme.border, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((r, i) => (
                      <tr key={r.stripped}>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid ' + theme.border, color: theme.muted, fontWeight: 700, fontSize: 12 }}>{i + 1}</td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid ' + theme.border, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, color: theme.text }}>
                          <a href={zazzleUrl(r.zazzleId)} target="_blank" rel="noreferrer" style={{ color: theme.text, textDecoration: 'none' }} title={r.name}>{r.name}</a>
                        </td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid ' + theme.border, color: theme.muted, fontSize: 11, fontFamily: 'monospace' }}>
                          <a href={zazzleUrl(r.zazzleId)} target="_blank" rel="noreferrer" style={{ color: theme.muted, textDecoration: 'none' }}>{r.zazzleId}</a>
                        </td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid ' + theme.border, fontWeight: 700, color: theme.accent }}>{cfg.mainFmt(r[cfg.mainKey])}</td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid ' + theme.border, color: theme.muted }}>{cfg.secFmt(r[cfg.secKey])}</td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid ' + theme.border, color: theme.muted }}>{r.customers}</td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid ' + theme.border }}>
                          {r.highSignal && r.repeat && <Bdg label="Priority A" color="#fff" bg={theme.danger} />}
                          {r.highSignal && !r.repeat && <Bdg label="High Signal" color={theme.accent} bg="rgba(45,106,79,0.12)" />}
                          {r.repeat && !r.highSignal && <Bdg label="Repeat" color={theme.medium} bg="rgba(181,130,10,0.12)" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab === 'signals' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ background: theme.surface, border: '1px solid ' + theme.border, borderRadius: 8, padding: 20, gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: theme.muted, textTransform: 'uppercase' }}>Priority A</div>
                  <span style={{ padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, color: '#fff', background: theme.danger }}>{data.priorityA.length}</span>
                </div>
                {data.priorityA.length === 0
                  ? <div style={{ color: theme.muted, fontSize: 13 }}>Ningun producto clasifica como Priority A en este periodo.</div>
                  : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><thead><tr>{['Producto', 'Product ID', 'Revenue', 'Clientes', 'Ordenes', 'Acciones BS'].map((h) => (<th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: theme.muted, textTransform: 'uppercase', borderBottom: '1px solid ' + theme.border }}>{h}</th>))}</tr></thead><tbody>{data.priorityA.map((r) => (<tr key={r.stripped}><td style={{ padding: '10px 12px', borderBottom: '1px solid ' + theme.border, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: theme.text }}><a href={zazzleUrl(r.zazzleId)} target="_blank" rel="noreferrer" style={{ color: theme.text, textDecoration: 'none' }}>{r.name}</a></td><td style={{ padding: '10px 12px', borderBottom: '1px solid ' + theme.border, color: theme.muted, fontSize: 11, fontFamily: 'monospace' }}><a href={zazzleUrl(r.zazzleId)} target="_blank" rel="noreferrer" style={{ color: theme.muted, textDecoration: 'none' }}>{r.zazzleId}</a></td><td style={{ padding: '10px 12px', borderBottom: '1px solid ' + theme.border, fontWeight: 700, color: theme.accent }}>{fmtM(r.revenue)}</td><td style={{ padding: '10px 12px', borderBottom: '1px solid ' + theme.border, color: theme.muted }}>{r.customers}</td><td style={{ padding: '10px 12px', borderBottom: '1px solid ' + theme.border, color: theme.muted }}>{r.orders}</td><td style={{ padding: '10px 12px', borderBottom: '1px solid ' + theme.border }}>{r.actions.length > 0 ? <div><div style={{ fontSize: 11, color: theme.accent, fontWeight: 600 }}>{r.actions.length} registradas</div><div style={{ fontSize: 11, color: theme.muted }}>Ultima: {r.actions[0].date}</div></div> : <span style={{ fontSize: 11, color: theme.muted }}>Sin acciones</span>}</td></tr>))}</tbody></table></div>
                }
              </div>
              <div style={{ background: theme.surface, border: '1px solid ' + theme.border, borderRadius: 8, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><div style={{ fontSize: 11, fontWeight: 600, color: theme.muted, textTransform: 'uppercase' }}>High Signal Sellers</div><span style={{ padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, color: theme.accent, background: 'rgba(45,106,79,0.12)' }}>{data.highSignal.length}</span></div>
                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                  {data.highSignal.length === 0 && <div style={{ color: theme.muted, fontSize: 12 }}>Sin High Signal Sellers.</div>}
                  {data.highSignal.map((r) => (<div key={r.stripped} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid ' + theme.border, gap: 8 }}><div style={{ flex: 1, overflow: 'hidden' }}><div style={{ fontSize: 12, fontWeight: 500, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><a href={zazzleUrl(r.zazzleId)} target="_blank" rel="noreferrer" style={{ color: theme.text, textDecoration: 'none' }}>{r.name}</a></div>{r.repeat && <div style={{ fontSize: 10, color: theme.medium }}>+ Repeat</div>}</div><div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><div style={{ fontSize: 13, fontWeight: 700, color: theme.accent }}>{fmtM(r.revenue)}</div><div style={{ fontSize: 10, color: theme.muted }}>{r.customers} clientes</div></div></div>))}
                </div>
              </div>
              <div style={{ background: theme.surface, border: '1px solid ' + theme.border, borderRadius: 8, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><div style={{ fontSize: 11, fontWeight: 600, color: theme.muted, textTransform: 'uppercase' }}>Repeat Sellers</div><span style={{ padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, color: theme.medium, background: 'rgba(181,130,10,0.12)' }}>{data.repeat.length}</span></div>
                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                  {data.repeat.length === 0 && <div style={{ color: theme.muted, fontSize: 12 }}>Sin Repeat Sellers.</div>}
                  {data.repeat.map((r) => (<div key={r.stripped} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid ' + theme.border, gap: 8 }}><div style={{ flex: 1, overflow: 'hidden' }}><div style={{ fontSize: 12, fontWeight: 500, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><a href={zazzleUrl(r.zazzleId)} target="_blank" rel="noreferrer" style={{ color: theme.text, textDecoration: 'none' }}>{r.name}</a></div>{r.highSignal && <div style={{ fontSize: 10, color: theme.accent }}>+ High Signal</div>}</div><div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><div style={{ fontSize: 13, fontWeight: 700, color: theme.accent }}>{fmtM(r.revenue)}</div><div style={{ fontSize: 10, color: theme.muted }}>{r.orders} ordenes</div></div></div>))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}