// Module Appareils — liste + fiche

function Appareils({ selectedId, go }) {
  if (selectedId) {
    const a = APPAREILS.find(x => x.id === selectedId);
    if (a) return <FicheAppareil a={a} go={go} />;
  }
  return <ListeAppareils go={go} />;
}

function ListeAppareils({ go }) {
  const [q, setQ] = React.useState("");

  const rows = APPAREILS
    .map(a => ({ ...a, d: appareilDerived(a) }))
    .filter(a => {
      if (!q) return true;
      const s = `${a.designation} ${a.marque} ${a.serie} ${a.lieu}`.toLowerCase();
      return s.includes(q.toLowerCase());
    });

  return (
    <div className="page">
      <PageHead
        title="Appareils"
        sub={`${APPAREILS.length} appareils radiologiques sous contrôle réglementaire`}
        actions={
          <button className="btn primary"><I.Plus className="ico"/> Ajouter un appareil</button>
        }
      />

      <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:14}}>
        <div className="top-search" style={{width:340, background:"var(--surface)"}}>
          <I.Search size={14} />
          <input placeholder="Rechercher un appareil" value={q} onChange={e=>setQ(e.target.value)} />
        </div>
        <div style={{flex:1}} />
        <span className="soft" style={{fontSize:12.5}}>{rows.length} résultats</span>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Désignation</th>
              <th>Numéro de série</th>
              <th>Lieu</th>
              <th>Vérification technique</th>
              <th>Contrôle qualité</th>
              <th style={{width:60}}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(a => (
              <tr key={a.id} onClick={() => go("appareil", a.id)}>
                <td>
                  <div className="name">{a.designation}</div>
                  <div className="soft" style={{fontSize:12, marginTop:2}}>{a.marque} · {a.modele}</div>
                </td>
                <td className="num">{a.serie}</td>
                <td className="muted">
                  {a.lieu}
                  {a.partagee && <Badge tone="neutral" style={{marginLeft:6}}>partagé</Badge>}
                </td>
                <td>
                  <StatusBadge status={a.d.sVerif} />
                  <div className="soft mono" style={{fontSize:11.5, marginTop:4}}>
                    Échéance {fmt(pickEarliest(a.d.verifAnnuelleDue, a.d.verifTriennaleDue))}
                  </div>
                </td>
                <td>
                  <StatusBadge status={a.d.sCQ} />
                  <div className="soft mono" style={{fontSize:11.5, marginTop:4}}>
                    Prochain {fmt(pickEarliestPending(a))}
                  </div>
                </td>
                <td style={{textAlign:"right"}}><I.ChevronRight size={14} style={{color:"var(--text-soft)"}}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function pickEarliest(...dates) {
  return dates.slice().sort((a,b) => a-b)[0];
}
function pickEarliestPending(a) {
  const d = a.d;
  const futures = [d.partial3, d.complet6, d.partial9].filter(x => x >= TODAY);
  if (futures.length === 0) return [d.partial3, d.complet6, d.partial9].sort((a,b)=>a-b)[0];
  return futures.sort((a,b)=>a-b)[0];
}

// ---- Fiche appareil ----

function FicheAppareil({ a, go }) {
  const d = appareilDerived(a);

  return (
    <div className="page">
      <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:14, color:"var(--text-soft)", fontSize:13}}>
        <button className="btn ghost sm" onClick={() => go("appareils")}>
          <I.ArrowLeft className="ico"/> Appareils
        </button>
        <span>/</span>
        <span>{a.designation}</span>
      </div>

      <PageHead
        title={a.designation}
        sub={<><span>{a.marque} · {a.modele}</span> <span className="soft" style={{margin:"0 8px"}}>·</span> <span className="mono">{a.serie}</span></>}
        actions={
          <>
            <StatusBadge status={d.statutGlobal} />
            <button className="btn"><I.Edit className="ico"/> Modifier</button>
          </>
        }
      />

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:14}}>
        <Card title="Informations générales">
          <div className="form-grid">
            <ReadField label="Marque" value={a.marque} />
            <ReadField label="Modèle" value={a.modele} />
            <ReadField label="Numéro de série" value={a.serie} mono full />
            <ReadField label="Type" value={a.type} />
            <ReadField label="Année de mise en service" value={a.mise} />
            <ReadField label="Lieu d'utilisation" value={a.lieu} full />
            <ReadField label="Utilisation partagée" value={a.partagee ? "Oui" : "Non"} />
          </div>
        </Card>

        <Card title="Caractéristiques techniques">
          <div className="form-grid">
            <ReadField label="Tension nominale" value={a.tension} mono />
            <ReadField label="Intensité maximale" value={a.intensite} mono />
          </div>
        </Card>

        <Card title="Vérification technique" style={{gridColumn:"1 / -1"}}>
          <div className="stack" style={{gap:0}}>
            <VerifRow
              title="Vérification annuelle interne"
              sub="Réalisée par la PCR ou un organisme agréé · échéance 1 an"
              dateFait={a.verifAnnuelle}
              dateEch={d.verifAnnuelleDue}
              status={d.sVerifAnn}
            />
            <VerifRow
              title="Vérification triennale externe"
              sub="Réalisée par un organisme agréé · échéance 3 ans"
              dateFait={a.verifTriennale}
              dateEch={d.verifTriennaleDue}
              status={d.sVerifTri}
              last
            />
          </div>
        </Card>

        <Card title="Contrôle qualité" style={{gridColumn:"1 / -1"}}>
          <div className="stack" style={{gap:14}}>
            <div style={{
              display:"flex", alignItems:"center", gap:14,
              padding:"12px 14px",
              background:"var(--accent-soft)",
              border:"1px solid var(--accent-soft-border)",
              borderRadius:8,
            }}>
              <div style={{
                width:34, height:34, borderRadius:8,
                background:"white", border:"1px solid var(--accent-soft-border)",
                display:"grid", placeItems:"center", color:"var(--accent)",
              }}><I.Calendar size={16}/></div>
              <div style={{flex:1}}>
                <div style={{fontWeight:600, fontSize:14}}>Contrôle qualité externe — point de départ du cycle</div>
                <div className="soft" style={{fontSize:12.5, marginTop:2}}>
                  Dernier contrôle externe : <span className="mono">{fmt(a.cqExterne)}</span> · les contrôles internes sont calculés automatiquement
                </div>
              </div>
              <Badge tone="accent">Référence cycle</Badge>
            </div>

            <div className="stack" style={{gap:0}}>
              <CycleRow
                title="Contrôle qualité partiel interne (3 mois)"
                sub="Alerte 1 mois avant échéance"
                dateEch={d.partial3}
                status={d.sP3}
              />
              <CycleRow
                title="Contrôle qualité complet interne (6 mois)"
                sub="Alerte 3 mois avant échéance"
                dateEch={d.complet6}
                status={d.sC6}
              />
              <CycleRow
                title="Contrôle qualité partiel interne (9 mois)"
                sub="Alerte 1 mois avant échéance"
                dateEch={d.partial9}
                status={d.sP9}
                last
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function VerifRow({ title, sub, dateFait, dateEch, status, last }) {
  return (
    <div style={{
      display:"grid",
      gridTemplateColumns:"1fr auto auto auto",
      alignItems:"center", gap:24,
      padding:"14px 0",
      borderBottom: last ? "0" : "1px solid var(--border)",
    }}>
      <div>
        <div style={{fontWeight:600, fontSize:14}}>{title}</div>
        <div className="soft" style={{fontSize:12.5, marginTop:2}}>{sub}</div>
      </div>
      <div>
        <div className="soft" style={{fontSize:11, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:2}}>Dernier</div>
        <div className="mono" style={{fontSize:13}}>{fmt(dateFait)}</div>
      </div>
      <div>
        <div className="soft" style={{fontSize:11, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:2}}>Échéance</div>
        <div className="mono" style={{fontSize:13}}>{fmt(dateEch)}</div>
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

function CycleRow({ title, sub, dateEch, status, last }) {
  return (
    <div style={{
      display:"grid",
      gridTemplateColumns:"1fr auto auto",
      alignItems:"center", gap:24,
      padding:"12px 0",
      borderBottom: last ? "0" : "1px solid var(--border)",
    }}>
      <div>
        <div style={{fontWeight:600, fontSize:13.5}}>{title}</div>
        <div className="soft" style={{fontSize:12, marginTop:2}}>{sub}</div>
      </div>
      <div>
        <div className="mono" style={{fontSize:13}}>{fmt(dateEch)}</div>
        <div className="soft" style={{fontSize:11, marginTop:2}}>{relDay(dateEch)}</div>
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

Object.assign(window, { Appareils });
