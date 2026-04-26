import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { api } from "../../api/api";
import PageHeader from "../../components/PageHeader";
import PageContainer from "../../components/PageContainer";
import { styles } from "../../styles";
import { clientStatus, formatDate } from "../../utils/formatters";

function ClientOrderDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/api/client/orders/${id}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [id]);

  const specs = useMemo(() => {
    const raw = data?.specs?.[0]?.specs_json;
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }, [data]);

  if (error) return <div style={styles.error}>{error}</div>;
  if (!data) return <div style={styles.cardWide}>Chargement...</div>;

  const { order } = data;
  const lines = data.lines?.length ? data.lines : specs.lines || [];
  const totalQuantity = lines.reduce((sum, line) => sum + Number(line.quantity_kg || 0), 0) || order.quantity_kg || 0;
  const requestRows = [
    ["N° demande", order.order_number],
    ["Référence client", order.client_reference || specs.customer_reference || specs.client_reference],
    ["Statut", clientStatus(order.status)],
    ["Date souhaitée", formatDate(order.requested_delivery_date || order.requested_date)],
    ["Nombre de lignes", lines.length || "—"],
    ["Quantité totale", totalQuantity ? `${totalQuantity} kg` : ""],
    ["Adresse", order.delivery_address_choice === "specific" ? order.delivery_address : "Adresse du profil"],
    ["Urgence", order.urgency === "urgent" ? "Oui" : "Non"],
    ["Commentaire", order.comment || specs.general_comment],
  ];

  return (
    <PageContainer>
      <PageHeader
        kicker="Portail client"
        title={order.order_number || "Détail demande"}
        subtitle="Résumé métier de votre demande de production."
      />

      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Résumé de la demande</h2>
        <div style={styles.summaryGrid}>
          {requestRows.map(([label, value]) => (
            <div key={label} style={styles.summaryItem}>
              <div style={styles.label}>{label}</div>
              <div>{value || "—"}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Lignes de demande</h2>
        {lines.length ? lines.map((line, index) => (
          <div key={`${line.id || index}`} style={{ display: "grid", gap: 12, padding: 16, border: "1px solid rgba(17,24,39,0.10)", borderRadius: 14, background: "#FAF8F4" }}>
            <h3 style={styles.cardTitle}>Ligne {index + 1} — {[line.material_family, line.yarn_count_nm || line.dtex || line.custom_count].filter(Boolean).join(" ") || "Configuration fil"}</h3>
            <div style={styles.summaryGrid}>
              {lineRows(line).map(([label, value]) => (
                <div key={`${index}-${label}`} style={styles.summaryItem}>
                  <div style={styles.label}>{label}</div>
                  <div>{value || "—"}</div>
                </div>
              ))}
            </div>
          </div>
        )) : <div style={styles.emptyState}>Aucune ligne de demande enregistrée.</div>}
      </section>

      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Documents liés</h2>
        {data.documents?.length ? (
          <div style={styles.summaryGrid}>
            {data.documents.map((document) => (
              <div key={document.id} style={styles.summaryItem}>
                <div style={styles.label}>{document.document_type || "Document"}</div>
                <div>{document.filename}</div>
                <div style={styles.helpText}>{document.storage_url ? "Disponible au téléchargement" : "Document enregistré"}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.emptyState}>Aucun document disponible pour cette commande.</div>
        )}
      </section>
    </PageContainer>
  );
}

function lineRows(line) {
  const count = line.count_system === "dtex" ? (line.dtex && `${line.dtex} dtex`) : line.yarn_count_nm || line.custom_count;
  return [
    ["Application", line.application_type],
    ["Matière", [line.material_family, line.material_quality].filter(Boolean).join(" - ")],
    ["Titrage", count],
    ["Nombre de bouts", line.ply_number],
    ["Retordage", [line.twist_type, line.twist_direction].filter(Boolean).join(" / ")],
    ["Finition", line.finish],
    ["Couleur", [line.color_mode, line.color_name, line.color_reference].filter(Boolean).join(" - ")],
    ["Teinture requise", line.dyeing_required ? "Oui" : "Non"],
    ["Conditionnement", line.packaging],
    ["Quantité", line.quantity_kg ? `${line.quantity_kg} kg` : ""],
    ["Métrage/support", line.meterage_per_unit],
    ["Tolérance", line.tolerance_percent !== null && line.tolerance_percent !== undefined ? `${line.tolerance_percent}%` : ""],
    ["Livraison partielle", line.partial_delivery_allowed ? "Oui" : "Non"],
    ["Commentaire", [line.dyeing_comment, line.production_comment].filter(Boolean).join(" / ")],
  ];
}

export default ClientOrderDetail;
