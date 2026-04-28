import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { PlusCircle } from "lucide-react";
import atelierMachines from "../../assets/atelier-machines.png";
import { api } from "../../api/api";
import ClientOrdersTable from "../../components/ClientOrdersTable";
import PageContainer from "../../components/PageContainer";
import PageHeader from "../../components/PageHeader";
import { styles } from "../../styles";
import { T } from "../../theme";
import { formatDateTime } from "../../utils/formatters";
import { useIsMobile } from "../../utils/useIsMobile";

function ClientDashboard() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [orders, setOrders] = useState([]);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    api("/api/client/orders").then(setOrders).catch(console.error);
    api("/api/client/profile").then(setProfile).catch(() => {});
  }, []);

  const drafts = orders.filter((order) => order.status === "draft");
  const recentDrafts = drafts.slice(0, 3);
  const submitted = orders.filter((order) => ["submitted", "pending_approval"].includes(order.status));
  const pendingValidation = orders.filter((order) => order.status === "pending_validation");
  const inProduction = orders.filter((order) => ["approved", "in_production"].includes(order.status));
  const ongoingOrders = orders
    .filter((order) => !["draft", "delivered", "cancelled"].includes(order.status))
    .slice(0, 5);
  const latestOrders = orders.filter((order) => order.status !== "draft").slice(0, 3);

  const greeting = profile?.company_name || profile?.contact_name || "votre espace production";

  const metrics = useMemo(() => [
    ["Brouillons", drafts.length],
    ["Demandes envoyées", submitted.length],
    ["En validation", pendingValidation.length],
    ["En production", inProduction.length],
  ], [drafts.length, submitted.length, pendingValidation.length, inProduction.length]);

  return (
    <PageContainer>
      
    <section style={styles.heroPanel}>
        <img src={atelierMachines} alt="" style={styles.heroImage} />
        <div style={styles.heroOverlay} />
        <div style={styles.heroContent}>
          <div style={styles.overlineLight}>Portail privé filature</div>
          <h2 style={styles.heroTitle}>Bonjour {greeting}</h2>
          <p style={styles.heroText}>Suivez vos demandes, vos productions et vos documents en un seul endroit.</p>
        </div>
        <div style={local.heroActions}>
          <button style={styles.primaryButton} onClick={() => navigate("/client/orders/new")}>
            <PlusCircle size={16} /> Nouvelle demande
          </button>
          {recentDrafts[0] && (
            <button style={local.heroSecondaryButton} onClick={() => navigate(`/client/orders/new?draftId=${recentDrafts[0].id}`)}>
              Reprendre un brouillon
            </button>
          )}
        </div>
      </section>
<PageHeader
        kicker="Portail client"
        title="Mon espace production"
        subtitle="Pilotez vos demandes de fil, vos productions en cours et vos documents."
      />
      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>À reprendre</h2>
        {recentDrafts.length ? (
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
        ) : (
          <div style={styles.emptyState}>Aucun brouillon en cours.</div>
        )}
      </section>

      <section style={{ ...local.metricsGrid, ...(isMobile ? local.metricsGridMobile : {}) }}>
        {metrics.map(([title, value]) => (
          <div key={title} style={local.metricCard}>
            <div style={styles.metricTitle}>{title}</div>
            <div style={styles.metricValue}>{value}</div>
          </div>
        ))}
      </section>

      <div style={{ ...styles.dashboardGrid, ...(isMobile ? styles.dashboardGridMobile : {}) }}>
        <section style={styles.cardWide}>
          <h2 style={styles.cardTitle}>Demandes en cours</h2>
          <ClientOrdersTable orders={ongoingOrders} columns={["order", "reference", "lines", "quantity", "status", "date"]} empty="Aucune demande en cours." />
        </section>

        <section style={styles.cardWide}>
          <h2 style={styles.cardTitle}>Documents récents</h2>
          <div style={styles.emptyState}>Vos documents de commande apparaîtront ici.</div>
        </section>

        <section style={styles.cardWide}>
          <h2 style={styles.cardTitle}>Dernières demandes</h2>
          <ClientOrdersTable orders={latestOrders} columns={["order", "lines", "quantity", "status"]} empty="Aucune demande récente." />
        </section>
      </div>
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
};

export default ClientDashboard;
