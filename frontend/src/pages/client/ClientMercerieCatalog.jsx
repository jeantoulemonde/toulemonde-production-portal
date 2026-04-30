import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Search, ShoppingCart } from "lucide-react";
import { api } from "../../api/api";
import PageContainer from "../../components/PageContainer";
import PageHeader from "../../components/PageHeader";
import SectionHeader from "../../components/SectionHeader";
import { styles } from "../../styles";
import { T } from "../../theme";
import { backendAssetUrl } from "../../utils/assets";
import { useIsMobile } from "../../utils/useIsMobile";
import { addMercerieCartItem, readMercerieCart } from "../../utils/mercerieCart";

const local = {
  toolbar: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 240px auto",
    gap: 12,
    alignItems: "center",
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    height: 48,
    padding: "0 14px",
    borderRadius: 16,
    border: `1px solid ${T.border}`,
    background: "#fff",
  },
  productGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: 18,
  },
  productCard: {
    display: "grid",
    gap: 14,
    padding: 16,
    borderRadius: 20,
    border: `1px solid ${T.border}`,
    background: "#fff",
    boxShadow: T.shadowSoft,
    minWidth: 0,
  },
  image: {
    width: "100%",
    aspectRatio: "4 / 3",
    borderRadius: 16,
    objectFit: "cover",
    background: T.bleuPale,
    border: `1px solid ${T.border}`,
  },
  imagePlaceholder: {
    width: "100%",
    aspectRatio: "4 / 3",
    borderRadius: 16,
    display: "grid",
    placeItems: "center",
    background: T.bleuPale,
    border: `1px solid ${T.bleuBorder}`,
    color: T.bleu,
    fontWeight: 900,
    letterSpacing: "0.08em",
  },
  meta: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" },
  sku: { color: T.textSoft, fontSize: 12, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase" },
  productTitle: { margin: 0, fontSize: 18, fontWeight: 900, color: T.noir },
  productText: { margin: 0, color: T.textSoft, fontSize: 13, lineHeight: 1.5 },
  buyRow: { display: "grid", gridTemplateColumns: "88px minmax(0, 1fr)", gap: 10 },
};

function ClientMercerieCatalog() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState(null);
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const [quantities, setQuantities] = useState({});
  const [cartCount, setCartCount] = useState(readMercerieCart().length);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isMobile = useIsMobile(900);

  async function load() {
    try {
      const [nextCategories, nextProducts] = await Promise.all([
        api("/api/client/catalog/categories"),
        api("/api/client/catalog/products"),
      ]);
      setCategories(nextCategories);
      setProducts(nextProducts);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredProducts = useMemo(() => {
    const lower = search.trim().toLowerCase();
    return (products || []).filter((product) => {
      const matchesCategory = !categoryId || String(product.category_id) === String(categoryId);
      const haystack = `${product.name} ${product.sku} ${product.short_description || ""}`.toLowerCase();
      return matchesCategory && (!lower || haystack.includes(lower));
    });
  }, [categoryId, products, search]);

  function addProduct(product) {
    const next = addMercerieCartItem({ ...product, image_url: backendAssetUrl(product.image_url) }, quantities[product.id] || 1);
    setCartCount(next.length);
    setMessage(`${product.name} ajouté au panier mercerie.`);
  }

  return (
    <PageContainer>
      <SectionHeader type="mercerie" />
      <PageHeader
        kicker="Portail client"
        title="Mercerie"
        subtitle="Commandez vos articles standards du catalogue Toulemonde Production."
      >
        <button style={styles.primaryButton} onClick={() => navigate("/client/mercerie/cart")}>
          <ShoppingCart size={17} /> Panier ({cartCount})
        </button>
      </PageHeader>

      {error && <div style={styles.error}>{error}</div>}
      {message && <div style={styles.success}>{message}</div>}

      <section style={styles.cardWide}>
        <div style={{ ...local.toolbar, ...(isMobile ? { gridTemplateColumns: "1fr" } : {}) }}>
          <label style={local.searchBox}>
            <Search size={17} color={T.textSoft} />
            <input
              style={{ ...styles.input, border: 0, height: 42, padding: 0, background: "transparent" }}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher une référence, un produit..."
            />
          </label>
          <select style={styles.input} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Toutes catégories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <button style={styles.ghostButton} onClick={() => navigate("/client/mercerie/orders")}>Mes commandes mercerie</button>
        </div>
      </section>

      <section style={local.productGrid}>
        {filteredProducts.map((product) => (
          <article key={product.id} style={local.productCard}>
            <button type="button" style={{ border: 0, padding: 0, background: "transparent", cursor: "pointer" }} onClick={() => navigate(`/client/mercerie/products/${product.id}`)}>
              {product.image_url ? (
                <img src={backendAssetUrl(product.image_url)} alt={product.name} style={local.image} />
              ) : (
                <div style={local.imagePlaceholder}>TOULEMONDE</div>
              )}
            </button>
            <div>
              <div style={local.meta}>
                <span style={local.sku}>{product.sku}</span>
                <span style={styles.badge}>{product.category_name || "Mercerie"}</span>
              </div>
              <button type="button" style={{ ...styles.linkButton, color: T.mercerie, padding: 0, textAlign: "left", justifyContent: "flex-start", textTransform: "none", letterSpacing: 0 }} onClick={() => navigate(`/client/mercerie/products/${product.id}`)}>
                <h2 style={local.productTitle}>{product.name}</h2>
              </button>
              <p style={local.productText}>{product.short_description || product.description || "Référence mercerie standard."}</p>
            </div>
            <div style={local.meta}>
              <strong>{product.price !== null ? `${Number(product.price).toFixed(2)} ${product.currency}` : "Prix sur demande"}</strong>
              <span style={local.productText}>{product.stock_quantity !== null ? `Stock ${product.stock_quantity}` : "Stock à confirmer"}</span>
            </div>
            <div style={local.buyRow}>
              <input
                type="number"
                min="1"
                style={styles.input}
                value={quantities[product.id] || 1}
                onChange={(event) => setQuantities({ ...quantities, [product.id]: event.target.value })}
              />
              <button style={styles.primaryButton} onClick={() => addProduct(product)}>Ajouter au panier</button>
            </div>
            <button style={styles.ghostButton} onClick={() => navigate(`/client/mercerie/products/${product.id}`)}>Voir fiche</button>
          </article>
        ))}
      </section>

      {products === null ? (
        <div style={styles.emptyState}>Chargement du catalogue...</div>
      ) : (
        !filteredProducts.length && <div style={styles.emptyState}>Aucun produit ne correspond à votre recherche.</div>
      )}
    </PageContainer>
  );
}

export default ClientMercerieCatalog;
