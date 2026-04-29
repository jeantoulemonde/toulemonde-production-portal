import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/api";
import { styles } from "../../styles";
import { T } from "../../theme";
import PageHeader from "../../components/PageHeader";
import LoadingState from "../../components/LoadingState";
import {
  CATEGORY_TABS,
  LEVEL_META,
  describeContext,
  formatTimestamp,
  formatTimestampLong,
  levelMeta,
} from "../../utils/logFormatters";

const LEVEL_FILTERS = [
  { key: "all", label: "Tout" },
  { key: "warn+", label: "À surveiller" },
  { key: "error+", label: "Erreurs seules" },
];

function LevelBadge({ level }) {
  const meta = levelMeta(level);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 999,
        background: meta.bg,
        color: meta.color,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      <span aria-hidden="true">{meta.icon}</span>
      {meta.label}
    </span>
  );
}

function LogRow({ entry, onOpen }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "92px 150px 1fr auto",
        gap: 14,
        alignItems: "center",
        padding: "12px 14px",
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <div style={{ color: T.textSoft, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
        {formatTimestamp(entry.timestamp)}
      </div>
      <LevelBadge level={entry.level} />
      <div style={{ minWidth: 0 }}>
        <div style={{ color: T.noir, fontWeight: 600, lineHeight: 1.4 }}>{entry.message}</div>
        <div style={{ color: T.textSoft, fontSize: 12, marginTop: 4 }}>
          {describeContext(entry) || "—"}
        </div>
      </div>
      <button
        type="button"
        style={{ ...styles.ghostButton, minHeight: 32, padding: "0 12px", fontSize: 11 }}
        onClick={() => onOpen(entry)}
      >
        Détail
      </button>
    </div>
  );
}

function DetailModal({ entry, onClose }) {
  if (!entry) return null;
  const meta = levelMeta(entry.level);
  return (
    <div
      style={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-detail-title"
      onClick={onClose}
    >
      <div
        style={{ ...styles.modal, width: "min(640px, 100%)", maxHeight: "85vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="log-detail-title" style={styles.cardTitle}>
          {entry.message}
        </h2>
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <Field label="Quand" value={formatTimestampLong(entry.timestamp)} />
          <Field label="Catégorie" value={entry.category || "—"} />
          <Field label="Gravité" value={<LevelBadge level={entry.level} />} />
          {entry.userId && <Field label="Utilisateur" value={`#${entry.userId}`} />}
          {entry.orderId && <Field label="Commande" value={entry.orderId} />}
          {entry.clientId && <Field label="Client" value={`#${entry.clientId}`} />}
          {entry.ip && <Field label="Adresse IP" value={entry.ip} />}
          {entry.url && <Field label="Adresse" value={`${entry.method || ""} ${entry.url}`.trim()} />}
          {entry.statusCode !== undefined && <Field label="Code HTTP" value={String(entry.statusCode)} />}
          {entry.duration !== undefined && <Field label="Durée" value={`${entry.duration} ms`} />}
          {entry.error?.message && (
            <Field
              label="Cause"
              value={<span style={{ color: meta.color, fontWeight: 600 }}>{entry.error.message}</span>}
            />
          )}
        </div>
        <details style={{ marginTop: 18 }}>
          <summary style={{ cursor: "pointer", color: T.textSoft, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Données techniques
          </summary>
          <pre
            style={{
              marginTop: 10,
              padding: 12,
              background: T.ecru,
              borderRadius: 12,
              border: `1px solid ${T.border}`,
              fontSize: 12,
              overflow: "auto",
              maxHeight: 320,
            }}
          >
            {JSON.stringify(entry, null, 2)}
          </pre>
        </details>
        <div style={{ ...styles.formActions, marginTop: 18 }}>
          <button type="button" style={styles.primaryButton} onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12, alignItems: "baseline" }}>
      <div style={styles.label}>{label}</div>
      <div>{value}</div>
    </div>
  );
}

function OverviewPanel({ overview, onJumpTo }) {
  if (!overview) return <LoadingState message="Chargement de la vue d'ensemble..." />;
  const c = overview.counters;
  const cards = [
    { label: "Connexions réussies", value: c.loginSuccess, tone: "info" },
    { label: "Échecs de connexion", value: c.loginFailed, tone: c.loginFailed > 0 ? "warn" : "info" },
    { label: "Commandes soumises", value: c.ordersSubmitted, tone: "info" },
    { label: "Emails envoyés", value: c.mailsSent, tone: "info" },
    ...(c.mailsSimulated > 0
      ? [{ label: "Emails simulés (dev)", value: c.mailsSimulated, tone: "warn" }]
      : []),
    { label: "Emails échoués", value: c.mailsFailed, tone: c.mailsFailed > 0 ? "warn" : "info" },
    { label: "Sync Sage réussies", value: c.sageSyncs, tone: "info" },
    { label: "Sync Sage échouées", value: c.sageSyncFailed, tone: c.sageSyncFailed > 0 ? "error" : "info" },
    { label: "Erreurs serveur", value: c.serverErrors, tone: c.serverErrors > 0 ? "error" : "info" },
  ];
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Dernières 24 heures</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginTop: 16,
          }}
        >
          {cards.map((card) => {
            const meta = LEVEL_META[card.tone === "warn" ? "warn" : card.tone === "error" ? "error" : "info"];
            return (
              <div
                key={card.label}
                style={{
                  border: `1px solid ${T.border}`,
                  borderRadius: 14,
                  padding: 16,
                  background: meta.bg,
                }}
              >
                <div style={{ ...styles.label, marginBottom: 6 }}>{card.label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: meta.color }}>{card.value}</div>
              </div>
            );
          })}
        </div>
      </section>
      {overview.watchlist?.length > 0 && (
        <section style={styles.cardWide}>
          <h2 style={styles.cardTitle}>Activité à surveiller</h2>
          <div style={{ marginTop: 8 }}>
            {overview.watchlist.map((entry, i) => (
              <LogRow key={i} entry={entry} onOpen={() => onJumpTo("error", entry)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function AdminLogs() {
  const [tab, setTab] = useState("overview");
  const [level, setLevel] = useState("all");
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState(null);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const params = useMemo(() => {
    const q = new URLSearchParams();
    q.set("lines", "200");
    if (level !== "all") q.set("level", level);
    if (search) q.set("search", search);
    return q.toString();
  }, [level, search]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setError("");
        if (tab === "overview") {
          setOverview(null);
          const data = await api("/api/admin/logs/overview");
          if (!cancelled) setOverview(data);
        } else {
          setEntries(null);
          const data = await api(`/api/admin/logs/${tab}?${params}`);
          if (!cancelled) setEntries(data.entries || []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [tab, params, refreshTick]);

  // Debounce de la recherche : on ne déclenche le useEffect que via setSearch.
  // Pour un debounce strict, on pourrait wrappir, mais le coût du fetch est OK.

  function handleJumpTo(targetTab, entry) {
    setTab(targetTab);
    setDetail(entry);
  }

  return (
    <div style={styles.pageStack}>
      <PageHeader
        variant="admin"
        kicker="Administration"
        title="Activité du portail"
        subtitle="Connexions, commandes, synchronisations Sage, emails et erreurs serveur."
      >
        <button type="button" style={styles.ghostButton} onClick={() => setRefreshTick((n) => n + 1)}>
          Actualiser
        </button>
      </PageHeader>

      {error && <div style={styles.error}>{error}</div>}

      {/* Onglets */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {CATEGORY_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border: `1px solid ${tab === t.key ? T.bleu : T.border}`,
              background: tab === t.key ? T.bleuPale : T.blanc,
              color: tab === t.key ? T.bleu : T.noir,
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <OverviewPanel overview={overview} onJumpTo={handleJumpTo} />
      ) : (
        <>
          {/* Filtres */}
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {LEVEL_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setLevel(f.key)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: `1px solid ${level === f.key ? T.noir : T.border}`,
                    background: level === f.key ? T.noir : "transparent",
                    color: level === f.key ? "#fff" : T.noir,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <input
              type="search"
              placeholder="Rechercher (utilisateur, commande, IP...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...styles.input, maxWidth: 360 }}
            />
          </div>

          {/* Liste */}
          <section style={styles.cardWide}>
            {entries === null ? (
              <LoadingState message="Chargement..." />
            ) : entries.length === 0 ? (
              <div style={styles.emptyState}>Aucune entrée pour ces filtres.</div>
            ) : (
              <div>
                {entries.map((entry, i) => (
                  <LogRow key={i} entry={entry} onOpen={setDetail} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <DetailModal entry={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

export default AdminLogs;
