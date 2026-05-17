// Module Actions — liste de toutes les échéances réglementaires

function Actions({ go }) {
  const all = buildActions();
  const [filter, setFilter] = React.useState("tout");

  const filters = [
    { k: "tout", l: "Tout", n: all.length },
    { k: "retard", l: "En retard", n: all.filter(a => a.status.key === "invalid").length },
    { k: "avenir", l: "À venir", n: all.filter(a => a.status.key === "warn").length },
    { k: "formation", l: "Formation", n: all.filter(a => a.category === "formation").length },
    { k: "controle", l: "Contrôle", n: all.filter(a => a.category === "controle").length },
    { k: "visite", l: "Visite médicale", n: all.filter(a => a.category === "visite").length },
  ];

  const rows = all.filter(a => {
    if (filter === "tout") return true;
    if (filter === "retard") return a.status.key === "invalid";
    if (filter === "avenir") return a.status.key === "warn";
    return a.category === filter;
  });

  return (
    <div className="page">
      <PageHead
        title="Actions"
        sub="Toutes les échéances réglementaires à effectuer"
        actions={<>
          <button className="btn"><I.Download className="ico"/> Exporter</button>
        </>}
      />

      <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:14, flexWrap:"wrap"}}>
        <div className="pill-filter">
          {filters.map(f => (
            <button key={f.k} className={filter===f.k?"active":""} onClick={() => setFilter(f.k)}>
              {f.l}
              <span className="mono" style={{marginLeft:6, opacity:0.6, fontSize:11.5}}>{f.n}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th style={{width:36}}></th>
              <th>Sujet</th>
              <th>Action</th>
              <th>Type</th>
              <th>Échéance</th>
              <th style={{textAlign:"right"}}>Statut</th>
              <th style={{width:50}}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a, i) => (
              <tr key={i} onClick={() => {
                if (a.ref.kind === "travailleur") go("travailleur", a.ref.id);
                else if (a.ref.kind === "appareil") go("appareil", a.ref.id);
              }}>
                <td><span className={`dot ${a.status.tone}`} /></td>
                <td className="name">{a.sujet}</td>
                <td className="muted">{a.detail}</td>
                <td>
                  <Badge tone="neutral">{a.type}</Badge>
                </td>
                <td>
                  <div className="mono" style={{fontSize:13}}>{fmt(a.due)}</div>
                  <div className="soft" style={{fontSize:11.5, marginTop:2}}>{relDay(a.due)}</div>
                </td>
                <td style={{textAlign:"right"}}><StatusBadge status={a.status} /></td>
                <td style={{textAlign:"right"}}><I.ChevronRight size={14} style={{color:"var(--text-soft)"}}/></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} style={{padding:"40px 14px", textAlign:"center", color:"var(--text-soft)"}}>
                  Aucune action pour ce filtre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

Object.assign(window, { Actions });
