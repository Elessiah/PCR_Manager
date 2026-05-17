// Shared components

const Badge = ({ tone = "neutral", icon, children }) => {
  const iconMap = {
    ok: <I.Check size={12} />,
    warn: <I.Clock size={12} />,
    danger: <I.AlertTriangle size={12} />,
    neutral: <I.Circle size={12} />,
    accent: <I.Circle size={12} />,
  };
  return (
    <span className={`badge ${tone}`}>
      <span className="b-ico" style={{display:"inline-flex"}}>{icon ?? iconMap[tone]}</span>
      {children}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  if (!status) return null;
  return <Badge tone={status.tone}>{status.label}</Badge>;
};

const Card = ({ title, action, children, style }) => (
  <div className="card" style={style}>
    {(title || action) && (
      <div className="card-head">
        <div className="card-title">{title}</div>
        {action}
      </div>
    )}
    <div className="card-body">{children}</div>
  </div>
);

const PageHead = ({ title, sub, actions }) => (
  <div className="page-head">
    <div>
      <h1 className="page-title">{title}</h1>
      {sub && <div className="page-sub">{sub}</div>}
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </div>
);

const Field = ({ label, children, full }) => (
  <div className={`field${full ? " full" : ""}`}>
    <label>{label}</label>
    {children}
  </div>
);

const ReadField = ({ label, value, mono, full }) => (
  <Field label={label} full={full}>
    <div style={{
      padding: "7px 10px",
      background: "var(--surface-2)",
      border: "1px solid var(--border)",
      borderRadius: 6,
      fontSize: 13.5,
      color: value ? "var(--text)" : "var(--text-soft)",
      fontFamily: mono ? "JetBrains Mono, monospace" : undefined,
    }}>
      {value ?? "—"}
    </div>
  </Field>
);

Object.assign(window, { Badge, StatusBadge, Card, PageHead, Field, ReadField });
