// App — wires navigation between modules

function App() {
  // route: { module: "dashboard"|"etablissement"|"travailleurs"|"appareils"|"actions", selectedId?: string }
  const [route, setRoute] = React.useState({ module: "dashboard" });

  const go = (target, id) => {
    if (target === "travailleur") return setRoute({ module: "travailleurs", selectedId: id });
    if (target === "appareil") return setRoute({ module: "appareils", selectedId: id });
    setRoute({ module: target });
    window.scrollTo({ top: 0 });
  };

  // Sidebar counters
  const actions = buildActions();
  const retardCount = actions.filter(a => a.status.key === "invalid").length;

  const navItems = [
    { k: "dashboard", l: "Tableau de bord", icon: <I.Dashboard className="nav-icon"/> },
    { k: "etablissement", l: "Établissement", icon: <I.Building className="nav-icon"/> },
    { k: "travailleurs", l: "Travailleurs", icon: <I.Users className="nav-icon"/>, count: TRAVAILLEURS.length },
    { k: "appareils", l: "Appareils", icon: <I.Scan className="nav-icon"/>, count: APPAREILS.length },
    { k: "actions", l: "Actions", icon: <I.ListChecks className="nav-icon"/>, count: retardCount, countTone: "danger" },
  ];

  const titleMap = {
    dashboard: "Tableau de bord",
    etablissement: "Établissement",
    travailleurs: "Travailleurs",
    appareils: "Appareils",
    actions: "Actions",
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">RP</div>
          <div>
            <div className="brand-name">Gestionnaire PCR</div>
            <div className="brand-sub">Suivi radioprotection</div>
          </div>
        </div>

        <nav className="nav">
          <div className="nav-section">Navigation</div>
          {navItems.map(n => (
            <button
              key={n.k}
              className={`nav-item ${route.module === n.k ? "active" : ""}`}
              onClick={() => go(n.k)}
            >
              {n.icon}
              {n.l}
              {n.count !== undefined && (
                <span className={`nav-count ${n.countTone || ""}`}>{n.count}</span>
              )}
            </button>
          ))}

          <div className="nav-section">Établissement</div>
          <div style={{
            padding:"10px 12px",
            background:"var(--surface-2)",
            border:"1px solid var(--border)",
            borderRadius:6,
            margin:"4px 6px",
          }}>
            <div style={{fontSize:12.5, fontWeight:600, marginBottom:4}}>{ETABLISSEMENT.denomination}</div>
            <div className="soft" style={{fontSize:11}}>{ETABLISSEMENT.ville}</div>
            <div className="mono soft" style={{fontSize:10.5, marginTop:4}}>SIRET {ETABLISSEMENT.siret}</div>
          </div>
        </nav>

        <div className="sidebar-foot">
          <div className="avatar">CL</div>
          <div style={{minWidth:0, flex:1}}>
            <div className="who">Dr. Cécile Lambert</div>
            <div className="role">PCR · Cardiologie</div>
          </div>
          <button className="btn icon ghost"><I.Settings size={14}/></button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="crumb">
            <span>{ETABLISSEMENT.denomination}</span>
            <I.ChevronRight size={12} className="sep" />
            <span className="current">{titleMap[route.module]}</span>
          </div>
          <div className="topbar-spacer" />
          <div className="top-search">
            <I.Search size={14} />
            <input placeholder="Rechercher travailleur, appareil, document…" />
            <kbd>⌘K</kbd>
          </div>
          <button className="btn icon ghost" style={{position:"relative"}}>
            <I.Bell size={14}/>
            {retardCount > 0 && (
              <span style={{
                position:"absolute", top:2, right:2,
                width:8, height:8, borderRadius:"50%",
                background:"var(--danger)",
                border:"2px solid white",
              }} />
            )}
          </button>
        </header>

        {route.module === "dashboard" && <Dashboard go={go} />}
        {route.module === "etablissement" && <Etablissement />}
        {route.module === "travailleurs" && <Travailleurs selectedId={route.selectedId} go={go} />}
        {route.module === "appareils" && <Appareils selectedId={route.selectedId} go={go} />}
        {route.module === "actions" && <Actions go={go} />}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
