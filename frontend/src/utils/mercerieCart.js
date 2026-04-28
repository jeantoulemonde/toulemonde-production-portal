const CART_KEY = "toulemonde_mercerie_cart";

export function readMercerieCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveMercerieCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function clearMercerieCart() {
  localStorage.removeItem(CART_KEY);
}

export function addMercerieCartItem(product, quantity) {
  const items = readMercerieCart();
  const nextQuantity = Math.max(1, Number(quantity || 1));
  const variantId = product.color_variant_id || product.selected_variant?.id || null;
  const existing = items.find((item) => (
    Number(item.product_id) === Number(product.id)
    && String(item.color_variant_id || "") === String(variantId || "")
  ));

  if (existing) {
    existing.quantity = Number(existing.quantity || 0) + nextQuantity;
  } else {
    items.push({
      product_id: product.id,
      color_variant_id: variantId,
      variant_reference: product.variant_reference || product.selected_variant?.reference || null,
      color_name: product.color_name || product.selected_variant?.color_name || null,
      color_hex: product.color_hex || product.selected_variant?.color_hex || null,
      sku: product.sku,
      name: product.name,
      image_url: product.image_url || null,
      unit_label: product.unit_label || "pièce",
      unit_price: product.price ?? null,
      currency: product.currency || "EUR",
      quantity: nextQuantity,
    });
  }

  saveMercerieCart(items);
  return items;
}
