export const theme = {
  primary_color: "rgb(0,0,254)",
  background: "#f5f0e8",
  surface: "#faf8f4",
  text_primary: "#0a0a0a",
  text_secondary: "#666666",
  card_radius: "16px",
  shadow_soft: "0 18px 45px rgba(0,0,0,0.08)",
};

export const T = {
  // Couleurs
  lin: "#e8dcc8",
  linDark: "#c9b99a",
  ecru: theme.background,
  ecruDark: "#ede5d6",
  noir: theme.text_primary,
  noirMid: "#2a2a2a",
  deepBlack: "#050505",        // utilisé pour hero, profileHero, adminSidebar
  blanc: theme.surface,
  text: "#111111",
  textSoft: theme.text_secondary,
  border: "rgba(0,0,0,0.10)",
  borderMid: "rgba(0,0,0,0.18)",
  bleu: theme.primary_color,
  bleuPale: "rgba(0,0,254,0.06)",
  bleuBorder: "rgba(0,0,254,0.22)",
  danger: "#9f1d1d",
  green: "#236b38",
  success: "#236b38",          // alias de green pour cohérence sémantique

  // Sections (distinction visuelle yarn vs mercerie sur dashboard + nav)
  industriel: "#185fa5",
  industrielLight: "#e6f1fb",
  industrielBorder: "#b5d4f4",
  industrielText: "#0c447c",
  mercerie: "#ba7517",
  mercerieLight: "#faeeda",
  mercerieBorder: "#fac775",
  mercerieText: "#633806",

  // Échelle de radius
  radiusXs: 6,
  radiusS: 10,
  radiusM: 14,
  radiusL: 18,
  radiusXl: 24,
  radiusFull: 999,
  cardRadius: theme.card_radius,

  // Échelle d'élévation
  shadowS: "0 8px 18px rgba(0,0,0,0.04)",
  shadowM: "0 12px 28px rgba(0,0,0,0.05)",
  shadowL: theme.shadow_soft,                    // = "0 18px 45px rgba(0,0,0,0.08)"
  shadowSoft: theme.shadow_soft,                 // alias historique conservé
  shadowModal: "0 28px 80px rgba(0,0,0,0.28)",
  shadowFocusBlue: "0 0 0 4px rgba(0,0,254,0.12)",

  // Hauteurs de contrôle
  inputHeight: 46,
  buttonHeight: 44,

  // Typographie
  fontBody: "'Raleway', sans-serif",
  fontTitle: "'Raleway', sans-serif",
  fontDisplay: "'Raleway', sans-serif",
};
