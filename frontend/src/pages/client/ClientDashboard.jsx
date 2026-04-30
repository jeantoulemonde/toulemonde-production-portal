import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { PlusCircle, Package, ShoppingCart } from "lucide-react";
import atelierMachines from "../../assets/atelier-machines.png";
import { api } from "../../api/api";
import ClientOrdersTable from "../../components/ClientOrdersTable";
import PageContainer from "../../components/PageContainer";
import PageHeader from "../../components/PageHeader";
import SectionHeader from "../../components/SectionHeader";
import { styles } from "../../styles";
import { T } from "../../theme";
import { formatDateTime } from "../../utils/formatters";
import { useIsMobile } from "../../utils/useIsMobile";
import { getSession, userModules } from "../../auth/session";
import { readMercerieCart } from "../../utils/mercerieCart";

function ClientDashboard() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const modules = userModules(getSession("client").user);
  const isMixte = modules.yarn && modules.mercerie;
  const [orders, setOrders] = useState([]);
  const [mercerieOrders, setMercerieOrders] = useState([]);
  const [profile, setProfile] = useState(null);
  const [cartCount, setCartCount] = useState(modules.mercerie ? readMercerieCart().length : 0);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (modules.yarn) api("/api/client/orders").then(setOrders).catch((err) => setLoadError(err.message));
    if (modules.mercerie) api("/api/client/catalog/orders").then(setMercerieOrders).catch((err) => setLoadError(err.message));
    api("/api/client/profile").then(setProfile).catch(() => {});
  }, [modules.yarn, modules.mercerie]);

  const drafts = orders.filter((order) => order.status === "draft");
  const recentDrafts = drafts.slice(0, 3);
  const submitted = orders.filter((order) => ["submitted", "pending_approval"].includes(order.status));
  const pendingValidation = orders.filter((order) => order.status === "pending_validation");
  // Bug #8 : "En production" couvre désormais tout ce qui est validé jusqu'à prêt à livrer.
  const inProduction = orders.filter((order) => [
    "approved",
    "pending_sage_sync",
    "sent_to_sage",
    "imported_to_leon",
    "in_production",
    "ready",
  ].includes(order.status));
  const ongoingOrders = orders
    .filter((order) => !["draft", "delivered", "cancelled", "rejected"].includes(order.status))
    .slice(0, 5);
  const latestOrders = orders.filter((order) => order.status !== "draft").slice(0, 3);

  const mercerieOngoing = mercerieOrders.filter((o) => !["delivered", "cancelled"].includes(o.status));
  const mercerieDelivered = mercerieOrders.filter((o) => o.status === "delivered");

  const greeting = profile?.company_name || profile?.contact_name || "votre espace";

  const yarnMetrics = useMemo(() => [
    ["Brouillons", drafts.length],
    ["Demandes envoyées", submitted.length],
    ["En validation", pendingValidation.length],
    ["En production", inProduction.length],
  ], [drafts.length, submitted.length, pendingValidation.length, inProduction.length]);

  const mercerieMetrics = useMemo(() => [
    ["Panier", cartCount],
    ["Commandes en cours", mercerieOngoing.length],
    ["Commandes livrées", mercerieDelivered.length],
    ["Total commandes", mercerieOrders.length],
  ], [cartCount, mercerieOngoing.length, mercerieDelivered.length, mercerieOrders.length]);

  const heroSubtitle = modules.yarn && modules.mercerie
    ? "Suivez vos demandes de fil et vos commandes mercerie en un seul endroit."
    : modules.yarn
      ? "Suivez vos demandes, vos productions et vos documents en un seul endroit."
      : "Parcourez le catalogue mercerie et suivez vos commandes.";

  return (
    <PageContainer>
      {loadError && <div style={styles.error}>Chargement partiel : {loadError}</div>}
      <section style={styles.heroPanel}>
        <img src={atelierMachines} alt="" style={styles.heroImage} />
        <div style={styles.heroOverlay} />
        <div style={styles.heroContent}>
          <div style={styles.overlineLight}>Portail privé Toulemonde</div>
          <h2 style={styles.heroTitle}>Bonjour {greeting}</h2>
          <p style={styles.heroText}>{heroSubtitle}</p>
        </div>
        <div style={local.heroActions}>
          {modules.yarn && (
            <button style={styles.primaryButton} onClick={() => navigate("/client/orders/new")}>
              <PlusCircle size={16} /> Nouvelle demande
            </button>
          )}
          {modules.yarn && recentDrafts[0] && (
            <button style={local.heroSecondaryButton} onClick={() => navigate(`/client/orders/new?draftId=${recentDrafts[0].id}`)}>
              Reprendre un brouillon
            </button>
          )}
          {modules.mercerie && !modules.yarn && (
            <button style={styles.primaryButton} onClick={() => navigate("/client/mercerie")}>
              <Package size={16} /> Voir le catalogue
            </button>
          )}
          {modules.mercerie && cartCount > 0 && (
            <button style={local.heroSecondaryButton} onClick={() => navigate("/client/mercerie/cart")}>
              <ShoppingCart size={14} /> Panier ({cartCount})
            </button>
          )}
        </div>
      </section>

      <PageHeader
        kicker="Portail client"
        title="Mon espace"
        subtitle={modules.yarn && modules.mercerie
          ? "Pilotez vos demandes de fil, vos commandes mercerie et vos documents."
          : modules.yarn
            ? "Pilotez vos demandes de fil, vos productions et vos documents."
            : "Pilotez vos commandes mercerie et vos documents."}
      />

      {modules.yarn && (
        <>
          {isMixte && <SectionHeader type="industriel" />}
          {recentDrafts.length > 0 && (
            <section style={styles.cardWide}>
              <h2 style={styles.cardTitle}>À reprendre</h2>
              <div style={local.draftGrid}>
                {recentDrafts.map((draft) => (
                  <button key={draft.id} type="button" style={local.draftCard} onClick={() => navigate(`/client/orders/new?draftId=${draft.id}`)}>
                    <span style={styles.badge}>Brouillon</span>
                    <strong>{draft.order_number || `Brouillon ${draft.id}`}</strong>
                    <span style={styles.muted}>
                      {draft.line_count || 0} ligne(s)
                      {draft.total_quantity_kg ? ` · ${draft.total_quantity_kg} kg` : ""}
                      {draft.updated_at ? ` · modifié ${formatDateTime(draft.updated_at)}` : ""}
                    </span>
                    <span style={styles.linkButton}>Reprendre</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section style={{ ...local.metricsGrid, ...(isMobile ? local.metricsGridMobile : {}) }}>
            {yarnMetrics.map(([title, value]) => (
              <div key={title} style={{ ...local.metricCard, boxShadow: `inset 3px 0 0 ${T.industriel}, ${T.shadowSoft}` }}>
                <div style={styles.metricTitle}>{title}</div>
                <div style={{ ...styles.metricValue, color: T.industriel }}>{value}</div>
              </div>
            ))}
          </section>

          <div style={{ ...styles.dashboardGrid, ...(isMobile ? styles.dashboardGridMobile : {}) }}>
            <section style={{ ...styles.cardWide, boxShadow: `inset 0 2px 0 ${T.industriel}, ${T.shadowSoft}` }}>
              <h2 style={styles.cardTitle}>Demandes en cours</h2>
              <ClientOrdersTable orders={ongoingOrders} columns={["order", "reference", "lines", "quantity", "status", "date"]} empty="Aucune demande en cours." />
            </section>
            <section style={{ ...styles.cardWide, boxShadow: `inset 0 2px 0 ${T.industriel}, ${T.shadowSoft}` }}>
              <h2 style={styles.cardTitle}>Dernières demandes</h2>
              <ClientOrdersTable orders={latestOrders} columns={["order", "lines", "quantity", "status"]} empty="Aucune demande récente." />
            </section>
          </div>
        </>
      )}

      {modules.mercerie && (
        <>
          {isMixte && <SectionHeader type="mercerie" />}
          <section style={{ ...local.metricsGrid, ...(isMobile ? local.metricsGridMobile : {}) }}>
            {mercerieMetrics.map(([title, value]) => (
              <div key={title} style={{ ...local.metricCard, boxShadow: `inset 3px 0 0 ${T.mercerie}, ${T.shadowSoft}` }}>
                <div style={styles.metricTitle}>{title}</div>
                <div style={{ ...styles.metricValue, color: T.mercerie }}>{value}</div>
              </div>
            ))}
          </section>

          <section style={{ ...styles.cardWide, boxShadow: `inset 0 2px 0 ${T.mercerie}, ${T.shadowSoft}` }}>
            <h2 style={styles.cardTitle}>Accès rapide</h2>
            <div style={local.draftGrid}>
              <button type="button" style={local.draftCard} onClick={() => navigate("/client/mercerie")}>
                <span style={local.mercerieIconWrap}><Package size={20} color={T.mercerie} /></span>
                <strong>Catalogue</strong>
                <span style={styles.muted}>Articles standards mercerie.</span>
                <span style={{ ...styles.linkButton, color: T.mercerie }}>Parcourir</span>
              </button>
              <button type="button" style={local.draftCard} onClick={() => navigate("/client/mercerie/cart")}>
                <span style={local.mercerieIconWrap}><ShoppingCart size={20} color={T.mercerie} /></span>
                <strong>Mon panier</strong>
                <span style={styles.muted}>{cartCount} article(s) en attente.</span>
                <span style={{ ...styles.linkButton, color: T.mercerie }}>{cartCount > 0 ? "Finaliser" : "Vide"}</span>
              </button>
              <button type="button" style={local.draftCard} onClick={() => navigate("/client/mercerie/orders")}>
                <span style={local.mercerieIconWrap}><PlusCircle size={20} color={T.mercerie} /></span>
                <strong>Commandes mercerie</strong>
                <span style={styles.muted}>{mercerieOrders.length} commande(s) au total.</span>
                <span style={{ ...styles.linkButton, color: T.mercerie }}>Voir l'historique</span>
              </button>
            </div>
          </section>
        </>
      )}
    </PageContainer>
  );
}

const local = {
  heroActions: { position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  heroSecondaryButton: { border: "1px solid rgba(255,255,255,0.34)", background: "rgba(255,255,255,0.10)", color: "#fff", borderRadius: 6, padding: "12px 16px", cursor: "pointer", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" },
  draftGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 },
  draftCard: { display: "grid", gap: 10, textAlign: "left", border: `1px solid ${T.border}`, background: "#fff", borderRadius: 16, padding: 16, cursor: "pointer", boxShadow: "0 12px 28px rgba(0,0,0,0.05)", color: T.noir },
  metricsGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14 },
  metricsGridMobile: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
  metricCard: { background: "#fff", border: `1px solid ${T.border}`, borderRadius: 18, padding: 18, boxShadow: T.shadowSoft },
  mercerieIconWrap: {
    width: 36, height: 36, borderRadius: 8,
    background: T.mercerieLight,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
  },
};

export default ClientDashboard;
