import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { api } from "../../api/api";
import PageHeader from "../../components/PageHeader";
import SimpleTable from "../../components/SimpleTable";
import { styles } from "../../styles";
import { adminFieldLabel, clientStatus, formatDate } from "../../utils/formatters";

function AdminOrderDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [message, setMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [internalComment, setInternalComment] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveComment, setApproveComment] = useState("");

  async function load() {
    const next = await api(`/api/admin/orders/${id}`);
    setData(next);
    setInternalComment(next.order?.internal_comment || "");
  }

  useEffect(() => { load().catch(console.error); }, [id]);

  const specs = useMemo(() => {
    const raw = data?.specs?.[0]?.specs_json;
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }, [data]);

  if (!data) return <div style={styles.cardWide}>Chargement...</div>;

  const { order } = data;
  const lines = data.lines?.length ? data.lines : specs.lines || [];
  const totalQuantity = lines.reduce((sum, line) => sum + Number(line.quantity_kg || 0), 0) || order.quantity_kg || 0;

  async function updateStatus(status, defaultMessage) {
    await api(`/api/admin/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
        message: statusMessage || defaultMessage,
        internal_comment: internalComment,
      }),
    });
    setMessage("Statut mis à jour.");
    setStatusMessage("");
    await load();
  }

  async function approveOrder() {
    await api(`/api/orders/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ comment: approveComment }),
    });
    setMessage("Commande approuvée.");
    setApproveOpen(false);
    setApproveComment("");
    await load();
  }

  async function sendToSageNow() {
    const result = await api(`/api/admin/orders/${id}/force-sync`, { method: "POST" });
    const processed = result.sync?.processed || 0;
    const failed = result.sync?.failed || 0;
    setMessage(`Envoi Sage lancé. Traitées : ${processed}, erreurs : ${failed}.`);
    await load();
  }

  const requestSections = [
    ["Informations générales", [
      ["order_number", order.order_number],
      ["client_reference", order.client_reference || specs.customer_reference],
      ["company_name", order.company_name],
      ["status", clientStatus(order.status)],
      ["line_count", lines.length || null],
      ["total_quantity_kg", totalQuantity ? `${totalQuantity} kg` : null],
      ["requested_delivery_date", formatDate(order.requested_delivery_date || order.requested_date)],
      ["delivery_address_choice", order.delivery_address_choice || specs.delivery_address_choice],
      ["delivery_address", order.delivery_address || specs.delivery_address],
      ["delivery_comment", order.delivery_comment || specs.delivery_comment],
      ["urgent", order.urgency === "urgent" ? "Oui" : "Non"],
    ]],
    ["Commentaires", [
      ["comment", order.comment],
      ["technical_file_name", order.technical_file_name || specs.technical_file_name],
      ["sage_order_number", order.sage_order_number],
      ["sage_status", order.sage_status || "not_sent"],
      ["sage_error_message", order.sage_error_message],
      ["sage_sent_at", order.sage_sent_at],
      ["invoice_total_ht", order.invoice_total_ht ? `${order.invoice_total_ht} €` : null],
      ["invoice_total_ttc", order.invoice_total_ttc ? `${order.invoice_total_ttc} €` : null],
      ["internal_comment", order.internal_comment],
    ]],
  ];

  return (
    <div style={styles.pageStack}>
      <PageHeader
        variant="admin"
        kicker="Administration"
        title={order.order_number || `Commande ${id}`}
        subtitle={order.company_name || "Commande portail"}
      />

      {message && <div style={styles.success}>{message}</div>}

      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Validation admin</h2>
        <div style={styles.formGrid}>
          <label style={styles.field}>
            <span style={styles.label}>Message / commentaire interne</span>
            <textarea
              style={styles.textarea}
              value={statusMessage || internalComment}
              onChange={(event) => {
                setStatusMessage(event.target.value);
                setInternalComment(event.target.value);
              }}
              placeholder="Commentaire interne, motif de refus ou demande de correction"
            />
          </label>
        </div>
        <div style={styles.formActions}>
          <button type="button" style={styles.primaryButton} onClick={() => setApproveOpen(true)}>Approuver</button>
          <button type="button" style={styles.ghostButton} onClick={() => updateStatus("rejected", "Commande refusée")}>Refuser</button>
          <button type="button" style={styles.ghostButton} onClick={() => updateStatus("pending_validation", "Correction demandée")}>Demander correction</button>
          <button type="button" style={styles.ghostButton} onClick={() => updateStatus(order.status, "Commentaire interne mis à jour")}>Ajouter commentaire interne</button>
          {order.status === "approved" && <button type="button" style={styles.ghostButton} onClick={sendToSageNow}>Envoyer vers Sage maintenant</button>}
        </div>
      </section>

      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Détails de la demande</h2>
        {requestSections.map(([title, rows]) => (
          <div key={title} style={{ display: "grid", gap: 12 }}>
            <h3 style={styles.cardTitle}>{title}</h3>
            <div style={styles.summaryGrid}>
              {rows.map(([field, value]) => (
                <div key={`${title}-${field}`} style={styles.summaryItem}>
                  <div style={styles.label}>{adminFieldLabel(field)}</div>
                  <div>{value || "—"}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Lignes de demande</h2>
        {lines.length ? lines.map((line, index) => (
          <div key={`${line.id || index}`} style={{ display: "grid", gap: 12, padding: 16, border: "1px solid rgba(17,24,39,0.10)", borderRadius: 14, background: "#FAF8F4" }}>
            <h3 style={styles.cardTitle}>Ligne {index + 1}</h3>
            <div style={styles.summaryGrid}>
              {lineRows(line).map(([field, value]) => (
                <div key={`${index}-${field}`} style={styles.summaryItem}>
                  <div style={styles.label}>{adminFieldLabel(field)}</div>
                  <div>{value || "—"}</div>
                </div>
              ))}
            </div>
          </div>
        )) : <div style={styles.emptyState}>Aucune ligne de demande enregistrée.</div>}
      </section>

      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Historique statut</h2>
        <SimpleTable columns={["old_status", "new_status", "source", "message", "created_at"]} rows={data.history || []} />
      </section>

      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Documents</h2>
        <SimpleTable columns={["document_type", "filename", "source", "sage_reference", "created_at"]} rows={data.documents || []} />
      </section>

      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Logs sync</h2>
        <SimpleTable columns={["system", "direction", "status", "message", "created_at"]} rows={data.logs || []} />
      </section>

      {approveOpen && (
        <div style={local.modalOverlay} role="dialog" aria-modal="true">
          <div style={local.modal}>
            <h2 style={styles.cardTitle}>Valider la commande</h2>
            <p style={styles.muted}>Êtes-vous sûr de vouloir valider cette commande ?</p>
            <label style={styles.field}>
              <span style={styles.label}>Commentaire facultatif</span>
              <textarea
                style={styles.textarea}
                value={approveComment}
                onChange={(event) => setApproveComment(event.target.value)}
                placeholder="Commentaire interne de validation"
              />
            </label>
            <div style={styles.formActions}>
              <button type="button" style={styles.ghostButton} onClick={() => setApproveOpen(false)}>Annuler</button>
              <button type="button" style={styles.primaryButton} onClick={approveOrder}>Confirmer la validation</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const local = {
  modalOverlay: { position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.32)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  modal: { width: "min(560px, 100%)", background: "#fff", borderRadius: 18, padding: 22, display: "grid", gap: 16, boxShadow: "0 28px 80px rgba(0,0,0,0.28)" },
};

function lineRows(line) {
  const count = line.count_system === "dtex" ? (line.dtex && `${line.dtex} dtex`) : line.yarn_count_nm || line.custom_count;
  return [
    ["application_type", line.application_type],
    ["material_family", line.material_family],
    ["material_quality", line.material_quality],
    ["count_system", line.count_system],
    ["yarn_count", count],
    ["ply_number", line.ply_number],
    ["twist_type", line.twist_type],
    ["twist_direction", line.twist_direction],
    ["finish", line.finish],
    ["color_mode", line.color_mode],
    ["color_name", line.color_name],
    ["color_reference", line.color_reference],
    ["dyeing_required", line.dyeing_required ? "Oui" : "Non"],
    ["dyeing_comment", line.dyeing_comment],
    ["packaging", line.packaging],
    ["quantity_kg", line.quantity_kg ? `${line.quantity_kg} kg` : null],
    ["meterage_per_unit", line.meterage_per_unit],
    ["tolerance_percent", line.tolerance_percent !== null && line.tolerance_percent !== undefined ? `${line.tolerance_percent}%` : null],
    ["partial_delivery_allowed", line.partial_delivery_allowed ? "Oui" : "Non"],
    ["production_comment", line.production_comment],
  ];
}

export default AdminOrderDetail;
