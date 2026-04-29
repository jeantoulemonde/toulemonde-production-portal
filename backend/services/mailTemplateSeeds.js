// Templates HTML initiaux. L'admin peut les modifier ensuite via le back-office.
// Design sobre : header bandeau bleu Toulemonde, corps neutre, footer ecru.
// Inline styles uniquement (les <style> sont strippés par certains clients mail).

const T_BLEU = "#0000FE";
const T_ECRU = "#f5f0e8";
const T_NOIR = "#0a0a0a";
const T_TEXT_SOFT = "#666666";

function wrap(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:${T_ECRU};font-family:'Helvetica Neue',Arial,sans-serif;color:${T_NOIR};">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${T_ECRU};padding:32px 16px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.06);">
        <tr><td style="background:${T_BLEU};padding:22px 32px;">
          <span style="color:${T_ECRU};font-size:14px;font-weight:800;letter-spacing:0.20em;text-transform:uppercase;">Toulemonde &amp; Fils</span>
        </td></tr>
        <tr><td style="padding:32px;font-size:15px;line-height:1.55;color:${T_NOIR};">
${bodyHtml}
        </td></tr>
        <tr><td style="background:${T_ECRU};padding:18px 32px;font-size:12px;color:${T_TEXT_SOFT};text-align:center;">
          <a href="{{portalLink}}" style="color:${T_BLEU};text-decoration:none;font-weight:700;">Accéder au portail</a>
          <br><br>
          <span>Toulemonde &amp; Fils — Filature B2B textile</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(href, label) {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td>
    <a href="${href}" style="display:inline-block;background:${T_BLEU};color:${T_ECRU};padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:800;letter-spacing:0.05em;text-transform:uppercase;font-size:13px;">${label}</a>
  </td></tr></table>`;
}

const MAIL_TEMPLATES = [
  {
    template_key: "invite_user",
    label: "Invitation nouvel utilisateur",
    subject: "Votre accès au portail Toulemonde & Fils",
    html_body: wrap(`
<h1 style="margin:0 0 16px;font-size:22px;font-weight:900;letter-spacing:-0.02em;color:${T_NOIR};">Bienvenue {{fullName}}</h1>
<p style="margin:0 0 12px;">Un accès au portail client Toulemonde &amp; Fils a été créé pour <strong>{{companyName}}</strong>.</p>
<p style="margin:0 0 12px;">Pour activer votre compte, cliquez sur le bouton ci-dessous et choisissez votre mot de passe :</p>
${btn("{{invitationLink}}", "Activer mon compte")}
<p style="margin:0 0 12px;color:${T_TEXT_SOFT};font-size:13px;">Ce lien est valable {{expiresIn}}. Au-delà, contactez votre interlocuteur Toulemonde pour qu'il génère un nouveau lien.</p>
<p style="margin:0;color:${T_TEXT_SOFT};font-size:13px;">Si vous n'attendiez pas cette invitation, vous pouvez ignorer ce message.</p>`),
    text_body: `Bienvenue {{fullName}},

Un accès au portail client Toulemonde & Fils a été créé pour {{companyName}}.
Pour activer votre compte, ouvrez ce lien :

{{invitationLink}}

Validité : {{expiresIn}}.
Si vous n'attendiez pas cette invitation, ignorez ce message.`,
    variables: JSON.stringify(["fullName", "companyName", "invitationLink", "expiresIn", "portalLink"]),
  },

  {
    template_key: "reset_password",
    label: "Réinitialisation mot de passe",
    subject: "Réinitialisation de votre mot de passe",
    html_body: wrap(`
<h1 style="margin:0 0 16px;font-size:22px;font-weight:900;letter-spacing:-0.02em;color:${T_NOIR};">Bonjour {{fullName}}</h1>
<p style="margin:0 0 12px;">Une réinitialisation de mot de passe a été demandée pour votre compte sur le portail Toulemonde &amp; Fils.</p>
<p style="margin:0 0 12px;">Pour choisir un nouveau mot de passe :</p>
${btn("{{resetLink}}", "Réinitialiser mon mot de passe")}
<p style="margin:0 0 12px;color:${T_TEXT_SOFT};font-size:13px;">Ce lien est valable {{expiresIn}}.</p>
<p style="margin:0;color:${T_TEXT_SOFT};font-size:13px;">Si vous n'êtes pas à l'origine de cette demande, ignorez ce message — votre mot de passe actuel reste valable.</p>`),
    text_body: `Bonjour {{fullName}},

Une réinitialisation de mot de passe a été demandée. Pour la confirmer :

{{resetLink}}

Validité : {{expiresIn}}.
Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
    variables: JSON.stringify(["fullName", "resetLink", "expiresIn", "portalLink"]),
  },

  {
    template_key: "order_submitted",
    label: "Confirmation de commande",
    subject: "Commande {{orderNumber}} bien reçue",
    html_body: wrap(`
<h1 style="margin:0 0 16px;font-size:22px;font-weight:900;letter-spacing:-0.02em;color:${T_NOIR};">Bonjour {{fullName}}</h1>
<p style="margin:0 0 12px;">Nous avons bien reçu votre demande de commande <strong>{{orderNumber}}</strong> pour {{companyName}}, soumise le {{submittedAt}}.</p>
<p style="margin:0 0 8px;font-weight:700;">Récapitulatif :</p>
{{{orderLines}}}
<p style="margin:0 0 12px;">Notre équipe va l'examiner et vous reviendra rapidement avec une validation ou des précisions.</p>
${btn("{{portalLink}}", "Suivre ma commande")}`),
    text_body: `Bonjour {{fullName}},

Votre demande de commande {{orderNumber}} pour {{companyName}} a bien été reçue (soumise le {{submittedAt}}).

Notre équipe vous reviendra rapidement.

Suivi : {{portalLink}}`,
    variables: JSON.stringify(["fullName", "companyName", "orderNumber", "orderLines", "submittedAt", "portalLink"]),
  },

  {
    template_key: "order_approved",
    label: "Commande validée",
    subject: "Votre commande {{orderNumber}} a été validée",
    html_body: wrap(`
<h1 style="margin:0 0 16px;font-size:22px;font-weight:900;letter-spacing:-0.02em;color:${T_NOIR};">Bonne nouvelle, {{fullName}}</h1>
<p style="margin:0 0 12px;">Votre commande <strong>{{orderNumber}}</strong> pour {{companyName}} vient d'être validée par notre équipe.</p>
<div style="background:${T_ECRU};border-left:4px solid ${T_BLEU};padding:14px 16px;margin:18px 0;border-radius:4px;">
  <span style="color:${T_TEXT_SOFT};font-size:11px;letter-spacing:0.10em;text-transform:uppercase;font-weight:800;">Commentaire commercial</span>
  <p style="margin:6px 0 0;font-size:14px;">{{adminComment}}</p>
</div>
<p style="margin:0 0 12px;">Elle est maintenant transmise à la production. Vous serez notifié à chaque étape clé.</p>
${btn("{{portalLink}}", "Voir le détail")}`),
    text_body: `Bonne nouvelle {{fullName}},

Votre commande {{orderNumber}} pour {{companyName}} a été validée par notre équipe.
Commentaire : {{adminComment}}

Elle est transmise à la production.

Détail : {{portalLink}}`,
    variables: JSON.stringify(["fullName", "companyName", "orderNumber", "adminComment", "portalLink"]),
  },

  {
    template_key: "order_status_changed",
    label: "Mise à jour statut commande",
    subject: "Mise à jour de votre commande {{orderNumber}}",
    html_body: wrap(`
<h1 style="margin:0 0 16px;font-size:22px;font-weight:900;letter-spacing:-0.02em;color:${T_NOIR};">Bonjour {{fullName}}</h1>
<p style="margin:0 0 12px;">Le statut de votre commande <strong>{{orderNumber}}</strong> ({{companyName}}) vient d'évoluer :</p>
<table cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;font-size:14px;">
  <tr>
    <td style="padding:6px 12px;background:${T_ECRU};border-radius:4px;color:${T_TEXT_SOFT};">{{oldStatus}}</td>
    <td style="padding:0 12px;color:${T_BLEU};font-size:18px;">→</td>
    <td style="padding:6px 12px;background:${T_BLEU};color:${T_ECRU};border-radius:4px;font-weight:700;">{{newStatus}}</td>
  </tr>
</table>
<div style="background:${T_ECRU};border-left:4px solid ${T_BLEU};padding:14px 16px;margin:18px 0;border-radius:4px;">
  <span style="color:${T_TEXT_SOFT};font-size:11px;letter-spacing:0.10em;text-transform:uppercase;font-weight:800;">Message de notre équipe</span>
  <p style="margin:6px 0 0;font-size:14px;">{{adminComment}}</p>
</div>
${btn("{{portalLink}}", "Voir la commande")}`),
    text_body: `Bonjour {{fullName}},

Le statut de votre commande {{orderNumber}} ({{companyName}}) vient d'évoluer :
{{oldStatus}} → {{newStatus}}

Message : {{adminComment}}

Détail : {{portalLink}}`,
    variables: JSON.stringify(["fullName", "companyName", "orderNumber", "oldStatus", "newStatus", "adminComment", "portalLink"]),
  },

  {
    template_key: "document_ready",
    label: "Document disponible",
    subject: "Un document est disponible pour {{orderNumber}}",
    html_body: wrap(`
<h1 style="margin:0 0 16px;font-size:22px;font-weight:900;letter-spacing:-0.02em;color:${T_NOIR};">Bonjour {{fullName}}</h1>
<p style="margin:0 0 12px;">Un document est disponible pour votre commande <strong>{{orderNumber}}</strong> ({{companyName}}) :</p>
<div style="background:${T_ECRU};padding:16px;border-radius:6px;margin:16px 0;">
  <strong style="font-size:15px;">{{documentType}}</strong>
</div>
${btn("{{downloadLink}}", "Télécharger le document")}
<p style="margin:24px 0 0;color:${T_TEXT_SOFT};font-size:13px;">Vous retrouverez tous les documents associés à vos commandes dans votre espace, section <em>Documents</em>.</p>`),
    text_body: `Bonjour {{fullName}},

Un document est disponible pour votre commande {{orderNumber}} ({{companyName}}) :
{{documentType}}

Téléchargement : {{downloadLink}}`,
    variables: JSON.stringify(["fullName", "companyName", "orderNumber", "documentType", "downloadLink", "portalLink"]),
  },
];

module.exports = { MAIL_TEMPLATES };
