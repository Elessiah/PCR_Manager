// Module Travailleurs — liste + fiche détaillée

function Travailleurs({ selectedId, go }) {
  if (selectedId) {
    const t = TRAVAILLEURS.find(x => x.id === selectedId);
    if (t) return <FicheTravailleur t={t} go={go} />;
  }
  return <ListeTravailleurs go={go} />;
}

function ListeTravailleurs({ go }) {
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState("tous");
  const rows = TRAVAILLEURS
    .map(t => ({ ...t, hab: habilitationStatus(t) }))
    .filter(t => {
      if (filter !== "tous" && t.hab.key !== filter) return false;
      if (!q) return true;
      const s = `${t.nom} ${t.prenom} ${t.fonction}`.toLowerCase();
      return s.includes(q.toLowerCase());
    });

  return (
    <div className="page">
      <PageHead
        title="Travailleurs"
        sub={`${TRAVAILLEURS.length} travailleurs sous suivi radioprotection`}
        actions={
          <button className="btn primary"><I.Plus className="ico"/> Ajouter un travailleur</button>
        }
      />

      <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:14}}>
        <div className="top-search" style={{width:320, background:"var(--surface)"}}>
          <I.Search size={14} />
          <input
            placeholder="Rechercher un travailleur"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <div className="pill-filter">
          {[
            ["tous","Tous"],
            ["validee","Validée"],
            ["partielle","Partielle"],
            ["non","Non validée"],
          ].map(([k,l]) => (
            <button key={k} className={filter===k?"active":""} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <div style={{flex:1}} />
        <span className="soft" style={{fontSize:12.5}}>{rows.length} résultats</span>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th style={{width:40}}></th>
              <th>Nom</th>
              <th>Prénom</th>
              <th>Fonction</th>
              <th>Catégorie</th>
              <th>Habilitation</th>
              <th style={{width:80, textAlign:"right"}}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(t => (
              <tr key={t.id} onClick={() => go("travailleur", t.id)}>
                <td>
                  <Avatar name={`${t.prenom} ${t.nom}`} />
                </td>
                <td className="name">{t.nom.toUpperCase()}</td>
                <td>{t.prenom}</td>
                <td className="muted">{t.fonction}</td>
                <td><Badge tone="neutral">Cat. {t.categorie}</Badge></td>
                <td><StatusBadge status={t.hab} /></td>
                <td style={{textAlign:"right"}}>
                  <button className="btn sm ghost"><I.ChevronRight className="ico"/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Avatar({ name }) {
  const initials = name.split(" ").map(s => s[0]).slice(0,2).join("").toUpperCase();
  // Subtle hashed hue
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return (
    <div style={{
      width:30, height:30, borderRadius:"50%",
      background:`oklch(0.92 0.04 ${h})`,
      color:`oklch(0.4 0.1 ${h})`,
      display:"grid", placeItems:"center",
      fontSize:11, fontWeight:700,
    }}>{initials}</div>
  );
}

// ----- Fiche -----

function FicheTravailleur({ t, go }) {
  const [tab, setTab] = React.useState("perso");
  const [comps, setComps] = React.useState(t.items.competences);

  const live = { ...t, items: { ...t.items, competences: comps } };
  const hab = habilitationStatus(live);

  return (
    <div className="page">
      <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:14, color:"var(--text-soft)", fontSize:13}}>
        <button className="btn ghost sm" onClick={() => go("travailleurs")}>
          <I.ArrowLeft className="ico"/> Travailleurs
        </button>
        <span>/</span>
        <span>{t.prenom} {t.nom}</span>
      </div>

      <div style={{display:"flex", alignItems:"flex-start", gap:18, marginBottom:24}}>
        <div style={{
          width:64, height:64, borderRadius:"50%",
          background:"oklch(0.92 0.04 245)", color:"var(--accent)",
          display:"grid", placeItems:"center",
          fontSize:22, fontWeight:700,
        }}>{t.prenom[0]}{t.nom[0]}</div>
        <div style={{flex:1}}>
          <h1 className="page-title">{t.prenom} {t.nom.toUpperCase()}</h1>
          <div className="page-sub" style={{marginTop:6, display:"flex", gap:10, alignItems:"center", flexWrap:"wrap"}}>
            <span>{t.fonction}</span>
            <span className="soft">·</span>
            <span>Catégorie {t.categorie}</span>
            <span className="soft">·</span>
            <span className="mono" style={{fontSize:12.5}}>ADELI {t.adeli}</span>
          </div>
        </div>
        <div style={{display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6}}>
          <div style={{fontSize:11, fontWeight:600, color:"var(--text-soft)", textTransform:"uppercase", letterSpacing:"0.05em"}}>
            Habilitation
          </div>
          <StatusBadge status={hab} />
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab==="perso"?"active":""}`} onClick={() => setTab("perso")}>
          <I.Users size={14}/> Données personnelles
        </button>
        <button className={`tab ${tab==="hab"?"active":""}`} onClick={() => setTab("hab")}>
          <I.Shield size={14}/> Habilitation
        </button>
      </div>

      {tab === "perso" && <DonneesPersonnelles t={t} />}
      {tab === "hab" && <Habilitation t={t} comps={comps} setComps={setComps} />}
    </div>
  );
}

function DonneesPersonnelles({ t }) {
  return (
    <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:14}}>
      <Card title="Identité">
        <div className="form-grid">
          <ReadField label="Nom" value={t.nom.toUpperCase()} />
          <ReadField label="Prénom" value={t.prenom} />
          <ReadField label="Sexe" value={t.sexe === "M" ? "Masculin" : "Féminin"} />
          <ReadField label="Date de naissance" value={fmt(t.naissance)} />
          <ReadField label="Lieu de naissance" value={t.lieuNaissance} />
          <ReadField label="Pays de naissance" value={t.paysNaissance} />
        </div>
      </Card>

      <Card title="Activité professionnelle">
        <div className="form-grid">
          <ReadField label="Fonction" value={t.fonction} />
          <ReadField label="Date de début d'activité" value={fmt(t.debut)} />
          <ReadField label="Catégorie réglementaire" value={`Catégorie ${t.categorie}`} />
          <ReadField label="Numéro ADELI / RPPS" value={t.adeli} mono />
        </div>
      </Card>

      <Card title="Coordonnées">
        <div className="form-grid">
          <ReadField label="Adresse mail" value={t.mail} full />
          <ReadField label="Numéro de téléphone" value={t.tel} mono full />
        </div>
      </Card>

      <Card title="Suivi réglementaire">
        <div className="form-grid">
          <ReadField label="Numéro sécurité sociale" value={t.ss} mono full />
          <ReadField label="Numéro porteur dosimétrie passive" value={t.dosimPassive} mono />
          <ReadField label="Numéro suivi médical" value={t.suiviMedical} mono />
        </div>
      </Card>
    </div>
  );
}

function Habilitation({ t, comps, setComps }) {
  const i = t.items;
  const formTravDue = addYears(i.formationTravailleurs, 3);
  const formPatDue = addYears(i.formationPatients, 7);
  const compStat = competenceStatus(comps);

  const toggle = (idx) => {
    const next = comps.slice();
    next[idx] = !next[idx];
    setComps(next);
  };

  return (
    <div className="stack" style={{gap:14}}>
      <Card title="Items d'habilitation">
        <div className="stack" style={{gap:0}}>
          <HabRow
            icon={<I.Activity size={16}/>}
            title="Dosimétrie passive"
            sub={`Validée le ${fmt(i.dosimPassive)} · porteur ${t.dosimPassive}`}
            status={statusFromDue(addYears(i.dosimPassive, 2), 3)}
          />
          <HabRow
            icon={<I.Pulse size={16}/>}
            title="Dosimétrie opérationnelle"
            sub={`Validée le ${fmt(i.dosimOperationnelle)}`}
            status={statusFromDue(addYears(i.dosimOperationnelle, 2), 3)}
          />
          <HabRow
            icon={<I.GraduationCap size={16}/>}
            title="Formation radioprotection travailleurs"
            sub={`Dernière formation : ${fmt(i.formationTravailleurs)} · renouvellement tous les 3 ans · échéance ${fmt(formTravDue)}`}
            status={statusFromDue(formTravDue)}
          />
          <HabRow
            icon={<I.GraduationCap size={16}/>}
            title="Formation radioprotection patients"
            sub={`Dernière formation : ${fmt(i.formationPatients)} · renouvellement tous les 7 ans · échéance ${fmt(formPatDue)}`}
            status={statusFromDue(formPatDue)}
          />
          <HabRow
            icon={<I.Stethoscope size={16}/>}
            title="Visite médicale"
            sub={`Prochaine visite : ${fmt(i.visiteMedicale)}`}
            status={statusFromDue(i.visiteMedicale, 2)}
            last
          />
        </div>
      </Card>

      <Card
        title="Formation à l'utilisation des appareils"
        action={
          <div style={{display:"flex", alignItems:"center", gap:10}}>
            <span className="soft mono" style={{fontSize:12.5}}>{compStat.count}/9</span>
            <StatusBadge status={{tone: compStat.tone, label: compStat.label}} />
          </div>
        }
      >
        <div style={{
          display:"grid", gridTemplateColumns:"1fr 1fr",
          gap:0,
        }}>
          {COMPETENCES.map((c, idx) => (
            <CompetenceRow
              key={idx}
              n={idx + 1}
              label={c}
              checked={comps[idx]}
              onToggle={() => toggle(idx)}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}

function HabRow({ icon, title, sub, status, last }) {
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:14,
      padding:"14px 0",
      borderBottom: last ? "0" : "1px solid var(--border)",
    }}>
      <div style={{
        width:34, height:34, borderRadius:8,
        background:"var(--surface-2)", border:"1px solid var(--border)",
        display:"grid", placeItems:"center", color:"var(--text-muted)",
      }}>{icon}</div>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontWeight:600, fontSize:14}}>{title}</div>
        <div className="soft" style={{fontSize:12.5, marginTop:2}}>{sub}</div>
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

function CompetenceRow({ n, label, checked, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display:"flex", alignItems:"center", gap:12,
        padding:"10px 12px",
        border:"1px solid var(--border)",
        background: checked ? "var(--ok-bg)" : "var(--surface)",
        borderRadius:6,
        margin: "4px",
        cursor:"pointer",
        textAlign:"left",
        transition:"background 0.1s ease",
      }}
    >
      <div style={{
        width:20, height:20, borderRadius:4,
        border:`1.5px solid ${checked ? "var(--ok)" : "var(--border-strong)"}`,
        background: checked ? "var(--ok)" : "white",
        display:"grid", placeItems:"center", color:"white",
        flexShrink:0,
      }}>
        {checked && <I.Check size={12} sw={3} />}
      </div>
      <div style={{flex:1, minWidth:0}}>
        <div className="soft mono" style={{fontSize:11, marginBottom:2}}>{String(n).padStart(2,"0")}</div>
        <div style={{fontSize:13.5, fontWeight: checked ? 600 : 500, color: checked ? "var(--ok)" : "var(--text)"}}>{label}</div>
      </div>
    </button>
  );
}

Object.assign(window, { Travailleurs });
