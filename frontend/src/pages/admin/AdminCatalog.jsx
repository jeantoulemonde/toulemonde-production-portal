import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/api";
import Field from "../../components/Field";
import PageHeader from "../../components/PageHeader";
import Select from "../../components/Select";
import SimpleTable from "../../components/SimpleTable";
import { styles } from "../../styles";
import { T } from "../../theme";
import { backendAssetUrl } from "../../utils/assets";

const emptyCategory = { name: "", slug: "", description: "", display_order: 0, is_active: true };
const emptyProduct = {
  category_id: "",
  sku: "",
  name: "",
  short_description: "",
  description: "",
  unit_label: "pièce",
  price: "",
  currency: "EUR",
  stock_quantity: "",
  is_active: true,
  is_featured: false,
  image_url: "",
  image_data_url: "",
  image_file_name: "",
};
const emptyVariant = {
  reference: "",
  color_name: "",
  color_hex: "#1E3A8A",
  image_url: "",
  image_data_url: "",
  image_file_name: "",
  availability_status: "available",
};

const local = {
  categoryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 },
  categoryCard: { display: "grid", gap: 8, padding: 16, borderRadius: 16, border: `1px solid ${T.border}`, background: "#fff", cursor: "pointer", textAlign: "left" },
  productDetail: { display: "grid", gridTemplateColumns: "220px minmax(0, 1fr)", gap: 18, alignItems: "start" },
  swatches: { display: "flex", gap: 10, flexWrap: "wrap" },
  swatch: { width: 28, height: 28, borderRadius: "50%", border: `1px solid ${T.borderMid}`, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.45)" },
  variantImage: { width: 56, height: 56, objectFit: "cover", borderRadius: 12, border: `1px solid ${T.border}` },
};

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function AdminCatalog() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [categoryForm, setCategoryForm] = useState(emptyCategory);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [productForm, setProductForm] = useState(emptyProduct);
  const [editingProductId, setEditingProductId] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [variantForm, setVariantForm] = useState(emptyVariant);
  const [editingVariantId, setEditingVariantId] = useState(null);
  const [message, setMessage] = useState("");

  async function load() {
    const [nextCategories, nextProducts] = await Promise.all([
      api("/api/admin/catalog/categories"),
      api("/api/admin/catalog/products"),
    ]);
    setCategories(nextCategories);
    setProducts(nextProducts);
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const categoryOptions = useMemo(() => [
    { value: "", label: "Sélectionner une catégorie" },
    ...categories.map((category) => ({ value: String(category.id), label: category.name })),
  ], [categories]);

  const visibleProducts = useMemo(() => (
    selectedCategoryId
      ? products.filter((product) => String(product.category_id) === String(selectedCategoryId))
      : products
  ), [products, selectedCategoryId]);

  const selectedCategory = useMemo(() => (
    categories.find((category) => String(category.id) === String(selectedCategoryId)) || null
  ), [categories, selectedCategoryId]);

  async function saveCategory(event) {
    event.preventDefault();
    const path = editingCategoryId ? `/api/admin/catalog/categories/${editingCategoryId}` : "/api/admin/catalog/categories";
    await api(path, { method: editingCategoryId ? "PUT" : "POST", body: JSON.stringify(categoryForm) });
    setCategoryForm(emptyCategory);
    setEditingCategoryId(null);
    setMessage(editingCategoryId ? "Catégorie modifiée." : "Catégorie créée.");
    await load();
  }

  function editCategory(category) {
    setSelectedCategoryId(String(category.id));
    setEditingCategoryId(category.id);
    setCategoryForm({
      name: category.name || "",
      slug: category.slug || "",
      description: category.description || "",
      display_order: category.display_order ?? 0,
      is_active: Boolean(category.is_active),
    });
  }

  function resetCategoryForm() {
    setEditingCategoryId(null);
    setCategoryForm(emptyCategory);
  }

  async function saveProduct(event) {
    event.preventDefault();
    const path = editingProductId ? `/api/admin/catalog/products/${editingProductId}` : "/api/admin/catalog/products";
    await api(path, { method: editingProductId ? "PUT" : "POST", body: JSON.stringify(productForm) });
    setProductForm(emptyProduct);
    setEditingProductId(null);
    setMessage(editingProductId ? "Produit modifié." : "Produit créé.");
    await load();
    if (editingProductId) await loadProductDetail(editingProductId);
  }

  function editProduct(product) {
    setEditingProductId(product.id);
    loadProductDetail(product.id).catch(console.error);
    setProductForm({
      category_id: product.category_id ? String(product.category_id) : "",
      sku: product.sku || "",
      name: product.name || "",
      short_description: product.short_description || "",
      description: product.description || "",
      unit_label: product.unit_label || "pièce",
      price: product.price ?? "",
      currency: product.currency || "EUR",
      stock_quantity: product.stock_quantity ?? "",
      is_active: Boolean(product.is_active),
      is_featured: Boolean(product.is_featured),
      image_url: product.image_url || "",
      image_data_url: "",
      image_file_name: "",
    });
  }

  async function loadProductDetail(productId) {
    const detail = await api(`/api/admin/catalog/products/${productId}`);
    setSelectedProduct(detail);
    return detail;
  }

  function handleProductImageFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setProductForm((current) => ({
        ...current,
        image_data_url: reader.result,
        image_file_name: file.name,
        image_url: "",
      }));
    };
    reader.readAsDataURL(file);
  }

  function handleVariantImageFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setVariantForm((current) => ({
        ...current,
        image_data_url: reader.result,
        image_file_name: file.name,
        image_url: "",
      }));
    };
    reader.readAsDataURL(file);
  }

  async function saveVariant(event) {
    event.preventDefault();
    if (!selectedProduct) return;
    const path = editingVariantId
      ? `/api/product-variants/${editingVariantId}`
      : `/api/products/${selectedProduct.id}/variants`;
    await api(path, { method: editingVariantId ? "PUT" : "POST", body: JSON.stringify(variantForm) });
    setVariantForm(emptyVariant);
    setEditingVariantId(null);
    setMessage(editingVariantId ? "Variante couleur modifiée." : "Variante couleur ajoutée.");
    await loadProductDetail(selectedProduct.id);
  }

  function editVariant(variant) {
    setEditingVariantId(variant.id);
    setVariantForm({
      reference: variant.reference || "",
      color_name: variant.color_name || "",
      color_hex: variant.color_hex || "#1E3A8A",
      image_url: variant.image_url || "",
      image_data_url: "",
      image_file_name: "",
      availability_status: variant.availability_status || "available",
    });
  }

  async function deleteVariant(variant) {
    if (!selectedProduct) return;
    await api(`/api/product-variants/${variant.id}`, { method: "DELETE" });
    setMessage("Variante couleur supprimée.");
    await loadProductDetail(selectedProduct.id);
  }

  async function disableProduct(product) {
    await api(`/api/admin/catalog/products/${product.id}`, { method: "DELETE" });
    setMessage("Produit désactivé.");
    await load();
  }

  const productImagePreview = productForm.image_data_url || backendAssetUrl(productForm.image_url);
  const variantImagePreview = variantForm.image_data_url || backendAssetUrl(variantForm.image_url);

  return (
    <div style={styles.pageStack}>
      <PageHeader
        variant="admin"
        kicker="Administration"
        title="Catalogue mercerie"
        subtitle="Gérez les catégories et articles standards visibles dans le portail client."
      />

      {message && <div style={styles.success}>{message}</div>}

      <section style={styles.cardWide}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h2 style={styles.cardTitle}>Catégories</h2>
            <p style={{ margin: "6px 0 0", color: T.textSoft }}>Sélectionnez une catégorie pour voir et éditer ses produits.</p>
          </div>
          {selectedCategory && <span style={styles.badge}>Sélection : {selectedCategory.name}</span>}
        </div>

        <div style={local.categoryGrid}>
          <button
            type="button"
            style={{
              ...local.categoryCard,
              borderColor: selectedCategoryId === "" ? T.bleu : T.border,
              background: selectedCategoryId === "" ? T.bleuPale : "#fff",
            }}
            onClick={() => setSelectedCategoryId("")}
          >
            <strong>Toutes les catégories</strong>
            <span style={{ color: T.textSoft }}>{products.length} produits</span>
          </button>
          {categories.map((category) => {
            const count = products.filter((product) => String(product.category_id) === String(category.id)).length;
            const active = String(selectedCategoryId) === String(category.id);
            return (
              <button
                key={category.id}
                type="button"
                style={{
                  ...local.categoryCard,
                  borderColor: active ? T.bleu : T.border,
                  background: active ? T.bleuPale : "#fff",
                }}
                onClick={() => setSelectedCategoryId(String(category.id))}
              >
                <strong>{category.name}</strong>
                <span style={{ color: T.textSoft }}>{count} produits liés</span>
                <span style={{ fontSize: 12, color: category.is_active ? T.success : T.textSoft }}>{category.is_active ? "Visible" : "Masquée"}</span>
              </button>
            );
          })}
        </div>

        {selectedCategory && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" style={styles.ghostButton} onClick={() => editCategory(selectedCategory)}>Modifier la catégorie</button>
            <button
              type="button"
              style={styles.ghostButton}
              onClick={() => {
                setProductForm({ ...emptyProduct, category_id: String(selectedCategory.id) });
                setEditingProductId(null);
              }}
            >
              Ajouter un produit dans {selectedCategory.name}
            </button>
          </div>
        )}
      </section>

      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>{editingCategoryId ? "Modifier la catégorie" : "Créer une catégorie"}</h2>
        <form style={styles.formGrid} onSubmit={saveCategory}>
          <Field label="Nom">
            <input
              style={styles.input}
              value={categoryForm.name}
              onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value, slug: categoryForm.slug || slugify(event.target.value) })}
            />
          </Field>
          <Field label="Slug">
            <input style={styles.input} value={categoryForm.slug} onChange={(event) => setCategoryForm({ ...categoryForm, slug: event.target.value })} />
          </Field>
          <Field label="Ordre">
            <input type="number" style={styles.input} value={categoryForm.display_order} onChange={(event) => setCategoryForm({ ...categoryForm, display_order: event.target.value })} />
          </Field>
          <Field label="Active">
            <label style={{ display: "flex", gap: 10, alignItems: "center", minHeight: 48 }}>
              <input type="checkbox" checked={categoryForm.is_active} onChange={(event) => setCategoryForm({ ...categoryForm, is_active: event.target.checked })} />
              Visible côté client
            </label>
          </Field>
          <Field label="Description">
            <textarea style={styles.textarea} value={categoryForm.description} onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })} />
          </Field>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button style={styles.primaryButton}>{editingCategoryId ? "Enregistrer catégorie" : "Créer catégorie"}</button>
            {editingCategoryId && (
              <button type="button" style={styles.ghostButton} onClick={resetCategoryForm}>Annuler</button>
            )}
          </div>
        </form>
      </section>

      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>{editingProductId ? "Modifier le produit" : "Créer un produit"}</h2>
        <form style={styles.formGrid} onSubmit={saveProduct}>
          <Field label="Catégorie">
            <Select
              value={productForm.category_id}
              onChange={(value) => setProductForm({ ...productForm, category_id: value })}
              options={categoryOptions}
            />
          </Field>
          <Field label="Référence">
            <input style={styles.input} value={productForm.sku} onChange={(event) => setProductForm({ ...productForm, sku: event.target.value })} />
          </Field>
          <Field label="Nom produit">
            <input style={styles.input} value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} />
          </Field>
          <Field label="Unité">
            <input style={styles.input} value={productForm.unit_label} onChange={(event) => setProductForm({ ...productForm, unit_label: event.target.value })} />
          </Field>
          <Field label="Prix">
            <input type="number" step="0.01" style={styles.input} value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} />
          </Field>
          <Field label="Stock">
            <input type="number" step="0.01" style={styles.input} value={productForm.stock_quantity} onChange={(event) => setProductForm({ ...productForm, stock_quantity: event.target.value })} />
          </Field>
          <Field label="Image URL">
            <input style={styles.input} value={productForm.image_url} onChange={(event) => setProductForm({ ...productForm, image_url: event.target.value })} />
          </Field>
          <Field label="Upload image">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={styles.input}
              onChange={(event) => handleProductImageFile(event.target.files?.[0])}
            />
            {productForm.image_file_name && (
              <span style={{ color: T.textSoft, fontSize: 12 }}>Image sélectionnée : {productForm.image_file_name}</span>
            )}
          </Field>
          {productImagePreview && (
            <div style={{ display: "grid", gap: 8 }}>
              <span style={styles.label}>Aperçu image</span>
              <img
                src={productImagePreview}
                alt={productForm.name || "Aperçu produit"}
                style={{ width: "100%", maxWidth: 220, aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 14, border: `1px solid ${T.border}` }}
              />
            </div>
          )}
          <Field label="Options">
            <div style={{ display: "grid", gap: 8, minHeight: 48 }}>
              <label><input type="checkbox" checked={productForm.is_active} onChange={(event) => setProductForm({ ...productForm, is_active: event.target.checked })} /> Actif</label>
              <label><input type="checkbox" checked={productForm.is_featured} onChange={(event) => setProductForm({ ...productForm, is_featured: event.target.checked })} /> Mis en avant</label>
            </div>
          </Field>
          <Field label="Description courte">
            <textarea style={styles.textarea} value={productForm.short_description} onChange={(event) => setProductForm({ ...productForm, short_description: event.target.value })} />
          </Field>
          <Field label="Description">
            <textarea style={styles.textarea} value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} />
          </Field>
          <div style={{ display: "flex", alignItems: "end", gap: 10 }}>
            <button style={styles.primaryButton}>{editingProductId ? "Enregistrer" : "Créer produit"}</button>
            {editingProductId && (
              <button type="button" style={styles.ghostButton} onClick={() => { setEditingProductId(null); setProductForm(emptyProduct); }}>
                Annuler
              </button>
            )}
          </div>
        </form>
      </section>

      {selectedProduct && (
        <section style={styles.cardWide}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
            <div>
              <h2 style={styles.cardTitle}>Fiche produit</h2>
              <p style={{ margin: "6px 0 0", color: T.textSoft }}>
                {selectedProduct.name} · {selectedProduct.category_name || "Sans catégorie"}
              </p>
            </div>
            <button type="button" style={styles.ghostButton} onClick={() => setSelectedProduct(null)}>Fermer</button>
          </div>

          <div style={local.productDetail}>
            {selectedProduct.image_url ? (
              <img
                src={backendAssetUrl(selectedProduct.image_url)}
                alt={selectedProduct.name}
                style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 18, border: `1px solid ${T.border}` }}
              />
            ) : (
              <div style={{ width: "100%", aspectRatio: "4 / 3", display: "grid", placeItems: "center", borderRadius: 18, background: T.bleuPale, color: T.bleu, fontWeight: 900 }}>TOULEMONDE</div>
            )}
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={styles.badge}>{selectedProduct.sku}</span>
                <span style={styles.badge}>{selectedProduct.price !== null ? `${Number(selectedProduct.price).toFixed(2)} ${selectedProduct.currency}` : "Prix sur demande"}</span>
                <span style={styles.badge}>{selectedProduct.is_active ? "Actif" : "Inactif"}</span>
              </div>
              <p style={{ margin: 0, color: T.textSoft, lineHeight: 1.6 }}>
                {selectedProduct.description || selectedProduct.short_description || "Aucune description renseignée."}
              </p>
              <h3 style={{ ...styles.cardTitle, fontSize: 20 }}>Variantes couleur</h3>
              <SimpleTable
                columns={["reference", "color_hex", "color_name", "product_image", "availability_status"]}
                rows={(selectedProduct.color_variants || []).map((variant) => ({
                  ...variant,
                  color_hex: (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span style={{ ...local.swatch, background: variant.color_hex || "#ddd" }} />
                      {variant.color_hex || "—"}
                    </span>
                  ),
                  product_image: variant.image_url ? (
                    <img src={backendAssetUrl(variant.image_url)} alt={variant.color_name} style={local.variantImage} />
                  ) : "Image principale",
                  availability_status: variant.availability_status === "unavailable" ? "Indisponible" : variant.availability_status === "limited" ? "Stock limité" : "Disponible",
                }))}
                actions={(variant) => (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" style={styles.linkButton} onClick={() => editVariant(variant)}>Modifier</button>
                    <button type="button" style={{ ...styles.linkButton, color: T.danger }} onClick={() => deleteVariant(variant)}>Supprimer</button>
                  </div>
                )}
              />
            </div>
          </div>

          <form style={styles.formGrid} onSubmit={saveVariant}>
            <Field label="Référence variante">
              <input style={styles.input} value={variantForm.reference} onChange={(event) => setVariantForm({ ...variantForm, reference: event.target.value })} />
            </Field>
            <Field label="Nom couleur">
              <input style={styles.input} value={variantForm.color_name} onChange={(event) => setVariantForm({ ...variantForm, color_name: event.target.value })} />
            </Field>
            <Field label="Code HEX">
              <div style={{ display: "grid", gridTemplateColumns: "58px minmax(0, 1fr)", gap: 10 }}>
                <input type="color" style={{ ...styles.input, padding: 4 }} value={variantForm.color_hex || "#1E3A8A"} onChange={(event) => setVariantForm({ ...variantForm, color_hex: event.target.value })} />
                <input style={styles.input} value={variantForm.color_hex} onChange={(event) => setVariantForm({ ...variantForm, color_hex: event.target.value })} />
              </div>
            </Field>
            <Field label="Image couleur URL">
              <input style={styles.input} value={variantForm.image_url} onChange={(event) => setVariantForm({ ...variantForm, image_url: event.target.value })} />
            </Field>
            <Field label="Disponibilité">
              <Select
                value={variantForm.availability_status}
                onChange={(value) => setVariantForm({ ...variantForm, availability_status: value })}
                options={[
                  { value: "available", label: "Disponible" },
                  { value: "limited", label: "Stock limité" },
                  { value: "unavailable", label: "Indisponible" },
                ]}
              />
            </Field>
            <Field label="Upload image couleur">
              <input type="file" accept="image/png,image/jpeg,image/webp" style={styles.input} onChange={(event) => handleVariantImageFile(event.target.files?.[0])} />
              {variantForm.image_file_name && <span style={{ color: T.textSoft, fontSize: 12 }}>Image sélectionnée : {variantForm.image_file_name}</span>}
            </Field>
            {variantImagePreview && (
              <div style={{ display: "grid", gap: 8 }}>
                <span style={styles.label}>Aperçu</span>
                <img src={variantImagePreview} alt={variantForm.color_name || "Aperçu couleur"} style={{ width: "100%", maxWidth: 180, aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 14, border: `1px solid ${T.border}` }} />
              </div>
            )}
            <div style={{ display: "flex", alignItems: "end", gap: 10, flexWrap: "wrap" }}>
              <button style={styles.primaryButton}>{editingVariantId ? "Enregistrer couleur" : "Ajouter couleur"}</button>
              {editingVariantId && (
                <>
                  <button type="button" style={styles.ghostButton} onClick={() => { setEditingVariantId(null); setVariantForm(emptyVariant); }}>Annuler</button>
                  <button
                    type="button"
                    style={{ ...styles.ghostButton, color: T.danger }}
                    onClick={() => {
                      const variant = selectedProduct.color_variants.find((item) => Number(item.id) === Number(editingVariantId));
                      if (variant) deleteVariant(variant);
                    }}
                  >
                    Supprimer
                  </button>
                </>
              )}
            </div>
          </form>
        </section>
      )}

      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>{selectedCategory ? `Produits - ${selectedCategory.name}` : "Tous les produits"}</h2>
        <SimpleTable
          columns={["product_image", "sku", "name", "category_name", "price", "stock_quantity", "is_active", "is_featured"]}
          rows={visibleProducts.map((product) => ({
            ...product,
            product_image: product.image_url ? (
              <img
                src={backendAssetUrl(product.image_url)}
                alt={product.name}
                style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 12, border: `1px solid ${T.border}` }}
              />
            ) : (
              <div style={{ width: 56, height: 56, display: "grid", placeItems: "center", borderRadius: 12, background: T.bleuPale, color: T.bleu, fontWeight: 900 }}>M</div>
            ),
            price: product.price !== null ? `${Number(product.price).toFixed(2)} ${product.currency}` : "Sur demande",
            is_active: product.is_active ? "Actif" : "Inactif",
            is_featured: product.is_featured ? "Oui" : "Non",
          }))}
          actions={(product) => (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={styles.linkButton} onClick={() => loadProductDetail(product.id)}>Fiche</button>
              <button style={styles.linkButton} onClick={() => editProduct(product)}>Modifier</button>
              <button style={{ ...styles.linkButton, color: T.danger }} onClick={() => disableProduct(product)}>Désactiver</button>
            </div>
          )}
        />
      </section>
    </div>
  );
}

export default AdminCatalog;
