// Service d'envoi d'emails transactionnels.
//
// API publique :
//   sendMail({ templateKey, to, variables, orderId? })
//     -> { success: bool, logId, error? } — ne throw JAMAIS.
//
//   renderTemplate({ template, variables })
//     -> { subject, html, text } — pure, sans I/O.
//
//   renderOrderLinesHtml(lines)
//     -> string HTML pré-rendu pour la variable {{{orderLines}}}
//
// Drivers :
//   EMAIL_DRIVER=console (défaut) -> log stdout
//   EMAIL_DRIVER=resend           -> envoi réel via Resend
//
// Échecs : loggés en base (mail_logs) + mailLogger, mais ne propagent jamais.

const { mailLogger } = require("./loggerCategories");
const logMessages = require("./logMessages");

let resendClient = null;
function getResendClient() {
  if (resendClient) return resendClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  try {
    const { Resend } = require("resend");
    resendClient = new Resend(apiKey);
    return resendClient;
  } catch (err) {
    mailLogger.error("Impossible de charger le SDK Resend", { error: err });
    return null;
  }
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Interpolation Mustache simplifiée :
//   {{var}}    -> HTML-échappé (sécurité par défaut)
//   {{{var}}}  -> raw HTML (pour blocs pré-rendus type orderLines)
function interpolate(str, variables) {
  if (!str) return "";
  // 1. {{{raw}}} doit être traité avant {{escaped}} sinon match collisionne
  let out = String(str).replace(/\{\{\{(\w+)\}\}\}/g, (_, key) => {
    return variables[key] !== undefined && variables[key] !== null ? String(variables[key]) : "";
  });
  out = out.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return escapeHtml(variables[key]);
  });
  return out;
}

function renderTemplate({ template, variables }) {
  return {
    subject: interpolate(template.subject, variables),
    html: interpolate(template.html_body, variables),
    text: interpolate(template.text_body || "", variables),
  };
}

// Helper pour rendre les lignes de commande yarn ou mercerie en HTML.
// Format compact, lisible dans tous les clients mail.
function renderOrderLinesHtml(lines = []) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return "<p style=\"margin:0;color:#666;\">(Aucune ligne)</p>";
  }
  const rows = lines.map((line, idx) => {
    // Détection format yarn vs mercerie
    if (line.product_name || line.sku) {
      // mercerie
      const variant = line.color_name ? ` (${escapeHtml(line.color_name)})` : "";
      const qty = `${line.quantity || 0} ${escapeHtml(line.unit_label || "")}`.trim();
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${idx + 1}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;"><strong>${escapeHtml(line.product_name || line.sku)}</strong>${variant}<br/><span style="color:#666;font-size:12px;">${escapeHtml(line.sku || "")}</span></td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${escapeHtml(qty)}</td>
      </tr>`;
    }
    // yarn industriel
    const material = [line.material_family, line.material_quality].filter(Boolean).join(" - ");
    const count = line.yarn_count_nm || line.dtex || line.custom_count || "";
    const desc = [material, count, line.color_name].filter(Boolean).join(" · ");
    const qty = line.quantity_kg ? `${line.quantity_kg} kg` : "";
    return `<tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">${idx + 1}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(desc) || "(détails non précisés)"}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${escapeHtml(qty)}</td>
    </tr>`;
  }).join("");
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;font-size:14px;margin:16px 0;">
    <thead><tr style="background:#f5f0e8;">
      <th style="padding:8px;text-align:left;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#666;">#</th>
      <th style="padding:8px;text-align:left;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#666;">Article</th>
      <th style="padding:8px;text-align:right;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#666;">Quantité</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// Cache template 30s pour éviter de hammer la DB sur les volées de mails.
const templateCache = new Map();
const TEMPLATE_TTL_MS = 30_000;

async function getTemplate(getFn, templateKey) {
  const now = Date.now();
  const cached = templateCache.get(templateKey);
  if (cached && now - cached.fetchedAt < TEMPLATE_TTL_MS) return cached.data;
  const row = await getFn(`SELECT * FROM mail_templates WHERE template_key = ?`, [templateKey]);
  templateCache.set(templateKey, { data: row, fetchedAt: now });
  return row;
}

function clearTemplateCache(templateKey = null) {
  if (templateKey) templateCache.delete(templateKey);
  else templateCache.clear();
}

// Factory : reçoit run/get du wrapper PG.
// Permet de tester sans dépendre d'un module global, et garde le service découplé.
function createMailService({ run, get }) {
  async function logMail({ templateKey, recipient, subject, status, error, orderId }) {
    try {
      await run(
        `INSERT INTO mail_logs (template_key, recipient, subject, status, error_message, order_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [templateKey || null, recipient, subject || null, status, error || null, orderId || null]
      );
    } catch (logErr) {
      mailLogger.error("Échec d'écriture en base du journal des emails", {
        error: logErr,
        templateKey,
        recipient,
      });
    }
  }

  async function sendMail({ templateKey, to, variables = {}, orderId = null }) {
    if (!to) {
      await logMail({ templateKey, recipient: "(missing)", status: "skipped", error: "Adresse destinataire manquante" });
      return { success: false, error: "Adresse destinataire manquante" };
    }

    let template;
    try {
      template = await getTemplate(get, templateKey);
    } catch (err) {
      await logMail({ templateKey, recipient: to, status: "failed", error: `DB: ${err.message}`, orderId });
      mailLogger.error(logMessages.mail.failed({ to, templateKey, orderId }), {
        error: err,
        templateKey,
        to,
        orderId,
      });
      return { success: false, error: err.message };
    }
    if (!template) {
      await logMail({ templateKey, recipient: to, status: "skipped", error: "Template introuvable", orderId });
      mailLogger.warn(logMessages.mail.templateMissing({ templateKey }), { templateKey, to, orderId });
      return { success: false, error: "Template introuvable" };
    }
    if (!template.is_active) {
      await logMail({ templateKey, recipient: to, status: "skipped", error: "Template inactif", orderId });
      return { success: false, error: "Template inactif" };
    }

    const { subject, html, text } = renderTemplate({ template, variables });
    const driver = process.env.EMAIL_DRIVER || "console";
    const from = process.env.EMAIL_FROM || "onboarding@resend.dev";

    if (driver === "console") {
      // Mode dev : on n'envoie rien, on log et on enregistre comme "simulated".
      // Le message Winston ne contient PAS le mot "envoyé" pour ne pas tromper
      // les compteurs ni l'utilisateur.
      const { templateLabel } = require("./labels");
      mailLogger.info(`Email "${templateLabel(templateKey)}" simulé pour ${to} (mode console, aucun envoi réel)`, {
        to,
        templateKey,
        orderId,
        subject,
        simulated: true,
      });
      const result = await logMail({ templateKey, recipient: to, subject, status: "simulated", error: null, orderId });
      return { success: true, simulated: true, logId: result };
    }

    if (driver === "resend") {
      const client = getResendClient();
      if (!client) {
        await logMail({ templateKey, recipient: to, status: "failed", error: "RESEND_API_KEY manquante ou SDK indisponible", orderId });
        return { success: false, error: "RESEND_API_KEY manquante" };
      }
      try {
        const result = await client.emails.send({
          from,
          to,
          subject,
          html,
          text: text || undefined,
        });
        if (result.error) {
          await logMail({ templateKey, recipient: to, subject, status: "failed", error: result.error.message || JSON.stringify(result.error), orderId });
          mailLogger.error(logMessages.mail.failed({ to, templateKey, orderId }), {
            error: result.error,
            to,
            templateKey,
            orderId,
          });
          return { success: false, error: result.error.message };
        }
        await logMail({ templateKey, recipient: to, subject, status: "sent", error: null, orderId });
        mailLogger.info(logMessages.mail.sent({ to, templateKey, orderId }), {
          to,
          templateKey,
          orderId,
          providerId: result.data?.id,
        });
        return { success: true, providerId: result.data?.id };
      } catch (err) {
        await logMail({ templateKey, recipient: to, subject, status: "failed", error: err.message, orderId });
        mailLogger.error(logMessages.mail.failed({ to, templateKey, orderId }), {
          error: err,
          to,
          templateKey,
          orderId,
        });
        return { success: false, error: err.message };
      }
    }

    await logMail({ templateKey, recipient: to, status: "failed", error: `Driver inconnu : ${driver}`, orderId });
    return { success: false, error: `Driver inconnu : ${driver}` };
  }

  return {
    sendMail,
    renderTemplate,
    renderOrderLinesHtml,
    clearTemplateCache,
  };
}

module.exports = {
  createMailService,
  renderTemplate,
  renderOrderLinesHtml,
  interpolate,
  escapeHtml,
};
