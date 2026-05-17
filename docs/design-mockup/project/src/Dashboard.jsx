// Tableau de bord

function Dashboard({ go }) {
  const actions = buildActions();
  const retard = actions.filter(a => a.status.key === "invalid");
  const aPrev = actions.filter(a => a.status.key === "warn");

  // Source counts
  const bySource = (cat, statusKey) =>
    actions.filter(a => a.category === cat && a.status.key === statusKey).length;

  // Habilitation snapshot
  const habStats = TRAVAILLEURS.map(t => habilitationStatus(t));
  const habCounts = {
    validee: habStats.filter(h => h.key === "validee").length,
    partielle: habStats.filter(h => h.key === "partielle").length,
    non: habStats.filter(h => h.key === "non").length,
  };

  // Appareils snapshot
  const appStats = APPAREILS.map(a => appareilDerived(a).statutGlobal);
  const appCounts = {
    ok: appStats.filter(s => s.key === "ok").length,
    warn: appStats.filter(s => s.key === "warn").length,
    invalid: appStats.filter(s => s.key === "invalid").length,
  };

  // Upcoming list (next 10)
  const upcoming = actions.slice(0, 8);

  return (
    <div className="page">
      <PageHead
        title="Tableau de bord"
        sub={`État réglementaire du service au ${fmt(TODAY)}`}
        actions={<>
          <button className="btn"><I.Download className="ico" /> Exporter</button>
          <button className="btn primary"><I.RefreshCw className="ico" /> Actualiser</button>
        </>}
      />

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi danger">
          <div className="kpi-head">
            <div className="kpi-label">En retard</div>
            <Badge tone="danger">{retard.length} action{retard.length > 1 ? "s" : ""}</Badge>
          </div>
          <div className="kpi-value">{retard.length}</div>
          <div className="kpi-foot">Échéances réglementaires dépassées</div>
        </div>
        <div className="kpi warn">
          <div className="kpi-head">
            <div className="kpi-label">À prévoir</div>
            <Badge tone="warn">90 jours</Badge>
          </div>
          <div className="kpi-value">{aPrev.length}</div>
          <div className="kpi-foot">Échéances dans les 3 mois</div>
        </div>
        <div className="kpi ok">
          <div className="kpi-head">
            <div className="kpi-label">À jour</div>
            <Badge tone="ok">Conforme</Badge>
          </div>
          <div className="kpi-value">
            {TRAVAILLEURS.length - habCounts.non} / {TRAVAILLEURS.length}
          </div>
          <div className="kpi-foot">Travailleurs avec habilitation valide ou partielle</div>
        </div>
      </div>

      {/* Two-col content */}
      <div style={{display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:14}}>
        {/* Actions à traiter */}
        <Card
          title="Échéances prioritaires"
          action={
            <button className="btn sm ghost" onClick={() => go("actions")}>
              Voir toutes les actions <I.ChevronRight className="ico" />
            </button>
          }
        >
          <div className="table-wrap" style={{boxShadow:"none", border:"1px solid var(--border)"}}>
            <table className="data">
              <thead>
                <tr>
                  <th>Sujet</th>
                  <th>Type</th>
                  <th>Échéance</th>
                  <th style={{textAlign:"right"}}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((a, i) => (
                  <tr key={i} onClick={() => {
                    if (a.ref.kind === "travailleur") go("travailleur", a.ref.id);
                    else if (a.ref.kind === "appareil") go("appareil", a.ref.id);
                  }}>
                    <td>
                      <div className="name">{a.sujet}</div>
                      <div className="soft" style={{fontSize:12, marginTop:2}}>{a.detail}</div>
                    </td>
                    <td className="muted">{a.type}</td>
                    <td>
                      <div className="mono" style={{fontSize:12.5}}>{fmt(a.due)}</div>
                      <div className="soft" style={{fontSize:11.5}}>{relDay(a.due)}</div>
                    </td>
                    <td style={{textAlign:"right"}}><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Right column */}
        <div className="stack" style={{gap:14}}>
          <Card title="Sources des alertes">
            <div className="stack" style={{gap:10}}>
              <SourceRow
                icon={<I.GraduationCap size={16} />}
                label="Formations"
                invalid={bySource("formation","invalid")}
                warn={bySource("formation","warn")}
              />
              <SourceRow
                icon={<I.Stethoscope size={16} />}
                label="Visites médicales"
                invalid={bySource("visite","invalid")}
                warn={bySource("visite","warn")}
              />
              <SourceRow
                icon={<I.Shield size={16} />}
                label="Vérifications techniques"
                invalid={actions.filter(a => a.detail.includes("Vérification") && a.status.key==="invalid").length}
                warn={actions.filter(a => a.detail.includes("Vérification") && a.status.key==="warn").length}
              />
              <SourceRow
                icon={<I.Scan size={16} />}
                label="Contrôles qualité"
                invalid={actions.filter(a => a.detail.includes("Contrôle qualité") && a.status.key==="invalid").length}
                warn={actions.filter(a => a.detail.includes("Contrôle qualité") && a.status.key==="warn").length}
              />
              <SourceRow
                icon={<I.Activity size={16} />}
                label="Dosimétrie"
                invalid={0}
                warn={0}
              />
            </div>
          </Card>

          <Card title="Habilitations travailleurs">
            <div style={{display:"flex", gap:6, marginBottom:12}}>
              <Segment value={habCounts.validee} total={TRAVAILLEURS.length} tone="ok" />
              <Segment value={habCounts.partielle} total={TRAVAILLEURS.length} tone="warn" />
              <Segment value={habCounts.non} total={TRAVAILLEURS.length} tone="danger" />
            </div>
            <div className="stack" style={{gap:6}}>
              <Legend tone="ok" label="Validée" count={habCounts.validee} />
              <Legend tone="warn" label="Partielle" count={habCounts.partielle} />
              <Legend tone="danger" label="Non validée" count={habCounts.non} />
            </div>
          </Card>

          <Card title="Parc d'appareils">
            <div style={{display:"flex", gap:6, marginBottom:12}}>
              <Segment value={appCounts.ok} total={APPAREILS.length} tone="ok" />
              <Segment value={appCounts.warn} total={APPAREILS.length} tone="warn" />
              <Segment value={appCounts.invalid} total={APPAREILS.length} tone="danger" />
            </div>
            <div className="stack" style={{gap:6}}>
              <Legend tone="ok" label="Valide" count={appCounts.ok} />
              <Legend tone="warn" label="À prévoir" count={appCounts.warn} />
              <Legend tone="danger" label="Invalide" count={appCounts.invalid} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SourceRow({ icon, label, invalid, warn }) {
  const total = invalid + warn;
  return (
    <div style={{display:"flex", alignItems:"center", gap:10, padding:"6px 0"}}>
      <div style={{
        width:30, height:30, borderRadius:6,
        background:"var(--surface-2)", border:"1px solid var(--border)",
        display:"grid", placeItems:"center", color:"var(--text-muted)"
      }}>{icon}</div>
      <div style={{flex:1, fontWeight:500}}>{label}</div>
      {invalid > 0 && <Badge tone="danger">{invalid} retard</Badge>}
      {warn > 0 && <Badge tone="warn">{warn} à prévoir</Badge>}
      {total === 0 && <Badge tone="ok">À jour</Badge>}
    </div>
  );
}

function Segment({ value, total, tone }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  const colorMap = { ok: "var(--ok)", warn: "var(--warn)", danger: "var(--danger)" };
  return (
    <div style={{
      flex: pct,
      height: 8,
      background: colorMap[tone],
      borderRadius: 4,
      minWidth: value > 0 ? 12 : 0,
      opacity: value > 0 ? 1 : 0,
    }} />
  );
}

function Legend({ tone, label, count }) {
  return (
    <div style={{display:"flex", alignItems:"center", gap:8, fontSize:13}}>
      <span className={`dot ${tone}`} />
      <span style={{flex:1}}>{label}</span>
      <span className="mono" style={{color:"var(--text-muted)"}}>{count}</span>
    </div>
  );
}

Object.assign(window, { Dashboard });
