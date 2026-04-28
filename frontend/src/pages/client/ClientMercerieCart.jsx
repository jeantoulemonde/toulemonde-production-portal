import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Trash2 } from "lucide-react";
import { api } from "../../api/api";
import PageContainer from "../../components/PageContainer";
import PageHeader from "../../components/PageHeader";
import Field from "../../components/Field";
import { styles } from "../../styles";
import { T } from "../../theme";
import { backendAssetUrl } from "../../utils/assets";
import { useIsMobile } from "../../utils/useIsMobile";
import { clearMercerieCart, readMercerieCart, saveMercerieCart } from "../../utils/mercerieCart";

const local = {
  layout: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 20, alignItems: "start" },
  line: {
    display: "grid",
    gridTemplateColumns: "72px minmax(0, 1fr) 110px 100px 42px",
    gap: 14,
    alignItems: "center",
    padding: "14px 0",
    borderBottom: `1px solid ${T.border}`,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 14,
    objectFit: "cover",
    background: T.bleuPale,
    border: `1px solid ${T.border}`,
  },
  placeholder: {
    width: 72,
    height: 72,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background: T.bleuPale,
    color: T.bleu,
    fontWeight: 900,
    border: `1px solid ${T.bleuBorder}`,
  },
  summary: { position: "sticky", top: 96, display: "grid", gap: 12 },
};

function ClientMercerieCart() {
  const navigate = useNavigate();
  const [items, setItems] = useState(readMercerieCart());
  const [form, setForm] = useState({ customer_reference: "", requested_delivery_date: "", comment: "" });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const isMobile = useIsMobile(1000);

  const total = useMemo(() => (
    items.reduce((sum, item) => {
      if (item.unit_price === null || item.unit_price === undefined) return sum;
      return sum + Number(item.unit_price) * Number(item.quantity || 0);
    }, 0)
  ), [items]);

  function lineKey(item) {
    return `${item.product_id}-${item.color_variant_id || "base"}`;
  }

  function updateQuantity(targetKey, quantity) {
    const next = items.map((item) => (
      lineKey(item) === targetKey
        ? { ...item, quantity: Math.max(1, Number(quantity || 1)) }
        : item
    ));
    setItems(next);
    saveMercerieCart(next);
  }

  function removeItem(targetKey) {
    const next = items.filter((item) => lineKey(item) !== targetKey);
    setItems(next);
    saveMercerieCart(next);
  }

  async function submitOrder(event) {
    event.preventDefault();
    if (!items.length) {
      setMessage("Votre panier mercerie est vide.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await api("/api/client/catalog/orders", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          lines: items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            color_variant_id: item.color_variant_id || null,
            variant_reference: item.variant_reference || null,
          })),
        }),
      });
      clearMercerieCart();
      setItems([]);
      navigate("/client/mercerie/orders");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        kicker="Mercerie"
        title="Panier mercerie"
        subtitle="Vérifiez les articles standards avant de soumettre votre commande catalogue."
      >
        <button style={styles.ghostButton} onClick={() => navigate("/client/mercerie")}>Continuer le catalogue</button>
      </PageHeader>

      {message && <div style={message.includes("vide") ? styles.error : styles.success}>{message}</div>}

      <form style={{ ...local.layout, ...(isMobile ? { gridTemplateColumns: "1fr" } : {}) }} onSubmit={submitOrder}>
        <section style={styles.cardWide}>
          <h2 style={styles.cardTitle}>Articles sélectionnés</h2>
          {!items.length && <div style={styles.emptyState}>Votre panier mercerie est vide.</div>}
          {items.map((item) => (
            <div
              key={lineKey(item)}
              style={{
                ...local.line,
                ...(isMobile ? { gridTemplateColumns: "56px minmax(0, 1fr)", alignItems: "start" } : {}),
              }}
            >
              {item.image_url ? (
                <img src={backendAssetUrl(item.image_url)} alt={item.name} style={{ ...local.thumb, ...(isMobile ? { width: 56, height: 56 } : {}) }} />
              ) : (
                <div style={{ ...local.placeholder, ...(isMobile ? { width: 56, height: 56 } : {}) }}>M</div>
              )}
              <div style={{ minWidth: 0 }}>
                <strong>{item.name}</strong>
                <div style={{ color: T.textSoft, fontSize: 12, marginTop: 4 }}>{item.sku} · {item.unit_label}</div>
                {item.color_name && (
                  <div style={{ display: "flex", alignItems: "center", gap: 7, color: T.textSoft, fontSize: 12, marginTop: 6 }}>
                    <span style={{ width: 12, height: 12, borderRadius: "50%", background: item.color_hex || "#ddd", border: `1px solid ${T.borderMid}` }} />
                    {item.color_name}{item.variant_reference ? ` · ${item.variant_reference}` : ""}
                  </div>
                )}
                {isMobile && (
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                    <input
                      type="number"
                      min="1"
                      style={{ ...styles.input, width: 92 }}
                      value={item.quantity}
                      onChange={(event) => updateQuantity(lineKey(item), event.target.value)}
                    />
                    <strong>
                      {item.unit_price !== null && item.unit_price !== undefined
                        ? `${(Number(item.unit_price) * Number(item.quantity || 0)).toFixed(2)} ${item.currency}`
                        : "Sur demande"}
                    </strong>
                    <button type="button" style={styles.linkButton} onClick={() => removeItem(lineKey(item))}>Supprimer</button>
                  </div>
                )}
              </div>
              {!isMobile && (
                <>
                  <input
                    type="number"
                    min="1"
                    style={styles.input}
                    value={item.quantity}
                    onChange={(event) => updateQuantity(lineKey(item), event.target.value)}
                  />
                  <strong>
                    {item.unit_price !== null && item.unit_price !== undefined
                      ? `${(Number(item.unit_price) * Number(item.quantity || 0)).toFixed(2)} ${item.currency}`
                      : "Sur demande"}
                  </strong>
                  <button type="button" style={styles.linkButton} onClick={() => removeItem(lineKey(item))} aria-label="Supprimer">
                    <Trash2 size={17} />
                  </button>
                </>
              )}
            </div>
          ))}
        </section>

        <aside style={{ ...styles.cardWide, ...local.summary }}>
          <h2 style={styles.cardTitle}>Commande catalogue</h2>
          <Field label="Référence client">
            <input style={styles.input} value={form.customer_reference} onChange={(event) => setForm({ ...form, customer_reference: event.target.value })} />
          </Field>
          <Field label="Date souhaitée">
            <input type="date" style={styles.input} value={form.requested_delivery_date} onChange={(event) => setForm({ ...form, requested_delivery_date: event.target.value })} />
          </Field>
          <Field label="Commentaire">
            <textarea style={styles.textarea} value={form.comment} onChange={(event) => setForm({ ...form, comment: event.target.value })} />
          </Field>
          <div style={{ display: "grid", gap: 8, padding: "12px 0", borderTop: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Lignes</span><strong>{items.length}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Total connu</span><strong>{total.toFixed(2)} EUR</strong></div>
          </div>
          <button style={styles.primaryButton} disabled={saving || !items.length}>{saving ? "Envoi..." : "Soumettre la commande"}</button>
        </aside>
      </form>
    </PageContainer>
  );
}

export default ClientMercerieCart;
