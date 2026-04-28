import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ShoppingCart } from "lucide-react";
import { api } from "../../api/api";
import PageContainer from "../../components/PageContainer";
import PageHeader from "../../components/PageHeader";
import { styles } from "../../styles";
import { T } from "../../theme";
import { backendAssetUrl } from "../../utils/assets";
import { addMercerieCartItem, readMercerieCart } from "../../utils/mercerieCart";
import { useIsMobile } from "../../utils/useIsMobile";

const local = {
  layout: { display: "grid", gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)", gap: 24, alignItems: "start" },
  image: { width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 22, border: `1px solid ${T.border}`, background: T.bleuPale },
  imagePlaceholder: { width: "100%", aspectRatio: "4 / 3", borderRadius: 22, border: `1px solid ${T.bleuBorder}`, background: T.bleuPale, color: T.bleu, display: "grid", placeItems: "center", fontWeight: 900, letterSpacing: "0.08em" },
  meta: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  title: { margin: "8px 0", fontSize: "clamp(30px, 4vw, 44px)", lineHeight: 1, fontWeight: 900, letterSpacing: "-0.04em", color: T.noir },
  text: { margin: 0, color: T.textSoft, lineHeight: 1.6 },
  swatches: { display: "flex", gap: 12, flexWrap: "wrap" },
  swatchButton: { display: "flex", alignItems: "center", gap: 8, minHeight: 42, padding: "0 12px", borderRadius: 999, border: `1px solid ${T.border}`, background: "#fff", cursor: "pointer", fontWeight: 800 },
  swatch: { width: 24, height: 24, borderRadius: "50%", border: `1px solid ${T.borderMid}`, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.45)" },
  buyRow: { display: "grid", gridTemplateColumns: "96px minmax(0, 1fr)", gap: 12 },
};

function ClientMercerieProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile(900);
  const [product, setProduct] = useState(null);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [cartCount, setCartCount] = useState(readMercerieCart().length);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api(`/api/client/catalog/products/${id}`)
      .then((data) => {
        setProduct(data);
        const firstVariant = data.color_variants?.[0];
        setSelectedVariantId(firstVariant ? String(firstVariant.id) : "");
      })
      .catch(console.error);
  }, [id]);

  const selectedVariant = useMemo(() => (
    product?.color_variants?.find((variant) => String(variant.id) === String(selectedVariantId)) || null
  ), [product, selectedVariantId]);

  if (!product) {
    return (
      <PageContainer>
        <div style={styles.emptyState}>Chargement de la fiche article...</div>
      </PageContainer>
    );
  }

  const imageUrl = backendAssetUrl(selectedVariant?.image_url || product.image_url);

  function addToCart() {
    const next = addMercerieCartItem({
      ...product,
      image_url: imageUrl,
      color_variant_id: selectedVariant?.id || null,
      variant_reference: selectedVariant?.reference || null,
      color_name: selectedVariant?.color_name || null,
      color_hex: selectedVariant?.color_hex || null,
    }, quantity);
    setCartCount(next.length);
    setMessage(`${product.name}${selectedVariant ? ` - ${selectedVariant.color_name}` : ""} ajouté au panier.`);
  }

  return (
    <PageContainer>
      <PageHeader
        kicker="Mercerie"
        title="Fiche article"
        subtitle="Consultez les détails et choisissez une couleur avant ajout au panier."
      >
        <button style={styles.ghostButton} onClick={() => navigate("/client/mercerie")}>Retour catalogue</button>
        <button style={styles.primaryButton} onClick={() => navigate("/client/mercerie/cart")}>
          <ShoppingCart size={17} /> Panier ({cartCount})
        </button>
      </PageHeader>

      {message && <div style={styles.success}>{message}</div>}

      <section style={{ ...local.layout, ...(isMobile ? { gridTemplateColumns: "1fr" } : {}) }}>
        <div style={styles.cardWide}>
          {imageUrl ? (
            <img src={imageUrl} alt={selectedVariant?.color_name ? `${product.name} ${selectedVariant.color_name}` : product.name} style={local.image} />
          ) : (
            <div style={local.imagePlaceholder}>TOULEMONDE</div>
          )}
        </div>

        <div style={{ ...styles.cardWide, display: "grid", gap: 18 }}>
          <div>
            <div style={local.meta}>
              <span style={styles.badge}>{product.category_name || "Mercerie"}</span>
              <span style={{ color: T.textSoft, fontSize: 12, fontWeight: 900, letterSpacing: "0.12em" }}>{product.sku}</span>
            </div>
            <h1 style={local.title}>{product.name}</h1>
            <p style={local.text}>{product.description || product.short_description || "Référence catalogue standard."}</p>
          </div>

          <div style={local.meta}>
            <strong>{product.price !== null ? `${Number(product.price).toFixed(2)} ${product.currency}` : "Prix sur demande"}</strong>
            <span style={{ color: T.textSoft }}>{product.stock_quantity !== null ? `Stock ${product.stock_quantity}` : "Stock à confirmer"}</span>
          </div>

          {!!product.color_variants?.length && (
            <div style={{ display: "grid", gap: 10 }}>
              <h2 style={styles.cardTitle}>Couleur</h2>
              <div style={local.swatches}>
                {product.color_variants.map((variant) => {
                  const active = String(variant.id) === String(selectedVariantId);
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      style={{
                        ...local.swatchButton,
                        borderColor: active ? T.bleu : T.border,
                        boxShadow: active ? "0 0 0 3px rgba(0,0,254,0.10)" : "none",
                      }}
                      onClick={() => setSelectedVariantId(String(variant.id))}
                      title={variant.reference}
                    >
                      <span style={{ ...local.swatch, background: variant.color_hex || "#ddd" }} />
                      {variant.color_name}
                    </button>
                  );
                })}
              </div>
              <div style={{ color: T.textSoft, fontSize: 13 }}>
                Couleur sélectionnée : <strong style={{ color: T.noir }}>{selectedVariant?.color_name || "Standard"}</strong>
                {selectedVariant?.reference && <> · Référence : <strong style={{ color: T.noir }}>{selectedVariant.reference}</strong></>}
              </div>
            </div>
          )}

          <div style={local.buyRow}>
            <input type="number" min="1" style={styles.input} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            <button style={styles.primaryButton} onClick={addToCart}>Ajouter au panier</button>
          </div>
        </div>
      </section>
    </PageContainer>
  );
}

export default ClientMercerieProductDetail;
