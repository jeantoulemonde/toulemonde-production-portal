const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3010";

export function backendAssetUrl(value) {
  if (!value) return null;
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith("/")) return `${API_URL}${value}`;
  return `${API_URL}/${value}`;
}
