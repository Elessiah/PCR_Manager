// Module Établissement

function Etablissement() {
  const [e, setE] = React.useState(ETABLISSEMENT);
  const [editing, setEditing] = React.useState(false);

  const set = (k, v) => setE({ ...e, [k]: v });

  return (
    <div className="page">
      <PageHead
        title="Établissement"
        sub="Informations administratives et documents réglementaires"
        actions={
          editing ? (
            <>
              <button className="btn" onClick={() => { setE(ETABLISSEMENT); setEditing(false); }}>Annuler</button>
              <button className="btn primary" onClick={() => setEditing(false)}><I.Check className="ico"/> Enregistrer</button>
            </>
          ) : (
            <button className="btn" onClick={() => setEditing(true)}><I.Edit className="ico"/> Modifier</button>
          )
        }
      />

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:14}}>
        <Card title="Identification">
          <div className="form-grid">
            <Field label="Dénomination / raison sociale" full>
              {editing
                ? <input value={e.denomination} onChange={ev => set("denomination", ev.target.value)} />
                : <ReadOnlyInline value={e.denomination} />
              }
            </Field>
            <Field label="Statut juridique">
              {editing
                ? <select value={e.statut} onChange={ev => set("statut", ev.target.value)}>
                    <option>SAS</option><option>SA</option><option>SARL</option>
                    <option>SCM</option><option>Association</option><option>Établissement public</option>
                  </select>
                : <ReadOnlyInline value={e.statut} />
              }
            </Field>
            <Field label="Numéro SIRET">
              {editing
                ? <input className="mono" maxLength={14} value={e.siret} onChange={ev => set("siret", ev.target.value.replace(/\D/g,""))} />
                : <ReadOnlyInline value={e.siret} mono />
              }
            </Field>
          </div>
        </Card>

        <Card title="Coordonnées">
          <div className="form-grid">
            <Field label="Téléphone">
              {editing
                ? <input value={e.tel} onChange={ev => set("tel", ev.target.value)} />
                : <ReadOnlyInline value={e.tel} icon={<I.Phone size={13} />} />
              }
            </Field>
            <Field label="Adresse mail">
              {editing
                ? <input type="email" value={e.mail} onChange={ev => set("mail", ev.target.value)} />
                : <ReadOnlyInline value={e.mail} icon={<I.Mail size={13} />} />
              }
            </Field>
            <Field label="Site internet" full>
              {editing
                ? <input value={e.site} onChange={ev => set("site", ev.target.value)} />
                : <ReadOnlyInline value={e.site} icon={<I.Globe size={13} />} />
              }
            </Field>
          </div>
        </Card>

        <Card title="Adresse" style={{gridColumn:"1 / -1"}}>
          <div className="form-grid">
            <Field label="Adresse" full>
              {editing
                ? <input value={e.adresse} onChange={ev => set("adresse", ev.target.value)} />
                : <ReadOnlyInline value={e.adresse} icon={<I.Pin size={13} />} />
              }
            </Field>
            <Field label="Code postal">
              {editing
                ? <input className="mono" value={e.cp} onChange={ev => set("cp", ev.target.value)} />
                : <ReadOnlyInline value={e.cp} mono />
              }
            </Field>
            <Field label="Ville">
              {editing
                ? <input value={e.ville} onChange={ev => set("ville", ev.target.value)} />
                : <ReadOnlyInline value={e.ville} />
              }
            </Field>
          </div>
        </Card>

        {/* K-Bis */}
        <Card title="Document K-Bis" style={{gridColumn:"1 / -1"}}>
          <div className="stack" style={{gap:14}}>
            {/* Ligne SIRET large */}
            <div style={{
              display:"flex", alignItems:"center", gap:14,
              padding:"12px 14px",
              background:"var(--surface-2)",
              border:"1px solid var(--border)",
              borderRadius:8,
            }}>
              <div style={{fontWeight:600, color:"var(--text-muted)", fontSize:12, textTransform:"uppercase", letterSpacing:"0.05em", minWidth:60}}>SIRET</div>
              <input
                className="mono"
                value={e.siret}
                readOnly={!editing}
                maxLength={14}
                onChange={ev => set("siret", ev.target.value.replace(/\D/g,""))}
                style={{
                  flex:1,
                  background:"white",
                  border:"1px solid var(--border-strong)",
                  borderRadius:6,
                  padding:"8px 12px",
                  fontSize:16,
                  letterSpacing:"0.08em",
                  fontWeight:500,
                  outline:0,
                }}
              />
              <Badge tone="ok">SIRET valide</Badge>
            </div>

            {/* Ligne K-Bis */}
            <div style={{
              display:"flex", alignItems:"center", gap:12,
              padding:"12px 14px",
              background:"var(--surface-2)",
              border:"1px solid var(--border)",
              borderRadius:8,
            }}>
              <div style={{
                width:36, height:44, borderRadius:4,
                background:"white", border:"1px solid var(--border-strong)",
                display:"grid", placeItems:"center",
                color:"var(--danger)", fontSize:10, fontWeight:700, letterSpacing:"0.04em",
              }}>PDF</div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontWeight:600, fontSize:13.5}}>{e.kbis.nom}</div>
                <div className="soft" style={{fontSize:12, marginTop:2}}>
                  Mis à jour le {fmt(e.kbis.date)} · {e.kbis.taille}
                </div>
              </div>
              <button className="btn"><I.Upload className="ico"/> Remplacer</button>
              <button className="btn primary"><I.Eye className="ico"/> Ouvrir</button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ReadOnlyInline({ value, mono, icon }) {
  return (
    <div style={{
      padding:"7px 10px",
      background:"var(--surface-2)",
      border:"1px solid var(--border)",
      borderRadius:6,
      fontSize:13.5,
      display:"flex", alignItems:"center", gap:8,
      color:"var(--text)",
      fontFamily: mono ? "JetBrains Mono, monospace" : undefined,
      letterSpacing: mono ? "0.05em" : undefined,
    }}>
      {icon && <span style={{color:"var(--text-soft)"}}>{icon}</span>}
      {value}
    </div>
  );
}

Object.assign(window, { Etablissement });
