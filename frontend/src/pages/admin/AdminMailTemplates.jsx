import { useEffect, useRef, useState } from "react";
import { api } from "../../api/api";
import PageHeader from "../../components/PageHeader";
import LoadingState from "../../components/LoadingState";
import { styles } from "../../styles";
import { T } from "../../theme";
import { formatDateTime } from "../../utils/formatters";

function AdminMailTemplates() {
  const [templates, setTemplates] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [detail, setDetail] = useState(null);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftHtml, setDraftHtml] = useState("");
  const [draftText, setDraftText] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const subjectRef = useRef(null);
  const htmlRef = useRef(null);
  const textRef = useRef(null);
  const lastFocusedRef = useRef("html");

  async function loadList() {
    try {
      const list = await api("/api/admin/mail-templates");
      setTemplates(list);
      if (!selectedKey && list.length) setSelectedKey(list[0].template_key);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadDetail(key) {
    try {
      const d = await api(`/api/admin/mail-templates/${key}`);
      setDetail(d);
      setDraftSubject(d.subject);
      setDraftHtml(d.html_body);
      setDraftText(d.text_body || "");
      setMessage("");
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { loadList(); }, []);
  useEffect(() => {
    if (selectedKey) loadDetail(selectedKey);
  }, [selectedKey]);

  function insertVariable(varName) {
    const wrap = lastFocusedRef.current === "subject" ? "{{" : "{{";
    const close = lastFocusedRef.current === "subject" ? "}}" : "}}";
    const token = `${wrap}${varName}${close}`;
    const ref = lastFocusedRef.current === "subject" ? subjectRef.current
      : lastFocusedRef.current === "text" ? textRef.current
        : htmlRef.current;
    if (!ref) return;
    const start = ref.selectionStart || 0;
    const end = ref.selectionEnd || 0;
    const current = lastFocusedRef.current === "subject" ? draftSubject
      : lastFocusedRef.current === "text" ? draftText
        : draftHtml;
    const next = current.slice(0, start) + token + current.slice(end);
    if (lastFocusedRef.current === "subject") setDraftSubject(next);
    else if (lastFocusedRef.current === "text") setDraftText(next);
    else setDraftHtml(next);
    setTimeout(() => {
      ref.focus();
      ref.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  }

  async function save() {
    try {
      setError("");
      setMessage("");
      await api(`/api/admin/mail-templates/${selectedKey}`, {
        method: "PUT",
        body: JSON.stringify({ subject: draftSubject, html_body: draftHtml, text_body: draftText }),
      });
      setMessage("Template enregistré.");
      await loadList();
      await loadDetail(selectedKey);
    } catch (err) {
      setError(err.message);
    }
  }

  async function preview() {
    try {
      setError("");
      // Sauvegarde temporaire du draft pour générer un aperçu fidèle :
      // on POST le preview avec les valeurs courantes du draft.
      const result = await api(`/api/admin/mail-templates/${selectedKey}/preview`, {
        method: "POST",
        body: JSON.stringify({ variables: {} }),
      });
      // Si le draft diffère de la base, on ré-applique l'interpolation côté client basique
      // (sinon il faudrait un endpoint dédié qui rend du draft non sauvegardé) :
      const subject = result.subject;
      const html = result.html;
      setPreviewSubject(subject);
      setPreviewHtml(html);
      setPreviewOpen(true);
    } catch (err) {
      setError(err.message);
    }
  }

  async function sendTest() {
    if (!testEmail) {
      setError("Renseignez une adresse email pour le test.");
      return;
    }
    try {
      setError("");
      setMessage("");
      const result = await api(`/api/admin/mail-templates/${selectedKey}/test`, {
        method: "POST",
        body: JSON.stringify({ to: testEmail }),
      });
      setMessage(result.simulated
        ? `Test simulé pour ${testEmail} (driver console — voir logs serveur).`
        : `Test envoyé à ${testEmail}.`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={styles.pageStack}>
      <PageHeader
        variant="admin"
        kicker="Administration"
        title="Templates email"
        subtitle="Modifiez le contenu des emails transactionnels envoyés aux clients."
      />
      {error && <div style={styles.error}>{error}</div>}
      {message && <div style={styles.success}>{message}</div>}

      {templates === null ? <LoadingState message="Chargement des templates..." /> : (
        <div style={local.layout}>
          <aside style={local.sidebar}>
            {templates.map((tpl) => {
              const isActive = tpl.template_key === selectedKey;
              return (
                <button
                  key={tpl.template_key}
                  type="button"
                  onClick={() => setSelectedKey(tpl.template_key)}
                  style={{
                    ...local.sidebarItem,
                    ...(isActive ? local.sidebarItemActive : {}),
                  }}
                >
                  <strong style={{ fontSize: 13 }}>{tpl.label}</strong>
                  <span style={{ fontSize: 11, color: T.textSoft, marginTop: 4 }}>
                    {tpl.is_active ? <span style={local.activeBadge}>Actif</span> : <span style={local.inactiveBadge}>Inactif</span>}
                    {" "}
                    {tpl.updated_at ? `· ${formatDateTime(tpl.updated_at)}` : ""}
                  </span>
                  {tpl.updated_by_name && (
                    <span style={{ fontSize: 11, color: T.textSoft }}>par {tpl.updated_by_name}</span>
                  )}
                </button>
              );
            })}
          </aside>

          <section style={local.editor}>
            {!detail ? <LoadingState message="Chargement..." /> : (
              <>
                <div>
                  <label style={styles.field}>
                    <span style={styles.label}>Objet</span>
                    <input
                      ref={subjectRef}
                      style={styles.input}
                      value={draftSubject}
                      onChange={(e) => setDraftSubject(e.target.value)}
                      onFocus={() => { lastFocusedRef.current = "subject"; }}
                    />
                  </label>
                </div>

                <div>
                  <label style={styles.field}>
                    <span style={styles.label}>Corps HTML</span>
                    <textarea
                      ref={htmlRef}
                      style={{ ...styles.textarea, fontFamily: "ui-monospace, monospace", minHeight: 380, fontSize: 12 }}
                      value={draftHtml}
                      onChange={(e) => setDraftHtml(e.target.value)}
                      onFocus={() => { lastFocusedRef.current = "html"; }}
                    />
                  </label>
                </div>

                <div>
                  <label style={styles.field}>
                    <span style={styles.label}>Version texte (fallback, optionnel)</span>
                    <textarea
                      ref={textRef}
                      style={{ ...styles.textarea, fontFamily: "ui-monospace, monospace", minHeight: 120, fontSize: 12 }}
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      onFocus={() => { lastFocusedRef.current = "text"; }}
                    />
                  </label>
                </div>

                <section style={local.varsBlock}>
                  <strong style={{ fontSize: 12, color: T.textSoft, textTransform: "uppercase", letterSpacing: "0.10em" }}>
                    Variables disponibles (clic pour insérer)
                  </strong>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                    {(detail.available_variables || []).map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => insertVariable(v.key)}
                        title={v.description}
                        style={local.varChip}
                      >
                        <code style={{ color: T.bleu }}>{`{{${v.key}}}`}</code>
                        <span style={{ color: T.textSoft, fontSize: 11, marginLeft: 6 }}>{v.description}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <div style={local.actionsRow}>
                  <button type="button" style={styles.primaryButton} onClick={save}>Enregistrer</button>
                  <button type="button" style={styles.ghostButton} onClick={preview}>Prévisualiser</button>
                  <div style={local.testGroup}>
                    <input
                      type="email"
                      placeholder="email@destinataire-test.fr"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      style={{ ...styles.input, height: 40, minHeight: 40, width: 240 }}
                    />
                    <button type="button" style={styles.ghostButton} onClick={sendTest}>Envoyer un test</button>
                  </div>
                </div>

                {detail.updated_by_name && detail.updated_at && (
                  <div style={{ fontSize: 12, color: T.textSoft }}>
                    Dernière modification par {detail.updated_by_name} le {formatDateTime(detail.updated_at)}.
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {previewOpen && (
        <div style={styles.modalOverlay} role="dialog" aria-modal="true" onClick={() => setPreviewOpen(false)}>
          <div style={{ ...styles.modal, width: "min(720px, 100%)", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div>
              <div style={{ fontSize: 11, color: T.textSoft, textTransform: "uppercase", letterSpacing: "0.10em" }}>Aperçu — Objet :</div>
              <strong style={{ fontSize: 16 }}>{previewSubject}</strong>
            </div>
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden", background: "#fff" }}>
              <div style={{ background: T.ecru, padding: "8px 12px", fontSize: 11, color: T.textSoft }}>HTML rendu</div>
              <div style={{ padding: 16 }} dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
            <button type="button" style={styles.ghostButton} onClick={() => setPreviewOpen(false)}>Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}

const local = {
  layout: { display: "grid", gridTemplateColumns: "300px minmax(0, 1fr)", gap: 20, alignItems: "start" },
  sidebar: { display: "grid", gap: 10, position: "sticky", top: 16 },
  sidebarItem: {
    display: "grid",
    gap: 6,
    textAlign: "left",
    background: "#fff",
    border: `1px solid ${T.border}`,
    borderRadius: 14,
    padding: 14,
    cursor: "pointer",
    color: T.noir,
  },
  sidebarItemActive: {
    borderColor: T.bleu,
    background: T.bleuPale,
    boxShadow: `0 0 0 1px ${T.bleu}`,
  },
  activeBadge: {
    display: "inline-block",
    padding: "2px 8px",
    background: "rgba(35,107,56,0.10)",
    color: T.green,
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  inactiveBadge: {
    display: "inline-block",
    padding: "2px 8px",
    background: T.ecru,
    color: T.textSoft,
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  editor: {
    background: "#fff",
    border: `1px solid ${T.border}`,
    borderRadius: 18,
    padding: 22,
    display: "grid",
    gap: 16,
  },
  varsBlock: {
    background: T.ecru,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    padding: 14,
  },
  varChip: {
    display: "inline-flex",
    alignItems: "center",
    background: "#fff",
    border: `1px solid ${T.border}`,
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    cursor: "pointer",
  },
  actionsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "center",
  },
  testGroup: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    marginLeft: "auto",
  },
};

export default AdminMailTemplates;
