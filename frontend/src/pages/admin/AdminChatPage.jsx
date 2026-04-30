// ============================================================================
// Admin chatbot page — self-contained version after extraction du module
// chatbot vers son propre projet (~/toulemonde-chatbot, port 3020).
// La page reste dans le portail mais consomme l'API chatbot externe via
// VITE_CHATBOT_URL.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, RefreshCw, Power } from "lucide-react";
import PageHeader from "../../components/PageHeader";
import LoadingState from "../../components/LoadingState";
import { styles } from "../../styles";
import { T } from "../../theme";

// ─── Configuration ─────────────────────────────────────────────────────────

const CHATBOT_URL = import.meta.env.VITE_CHATBOT_URL || "http://localhost:3020";

const STATUS_FILTERS = [
  { key: "escalated", label: "Escalations en attente" },
  { key: "open",      label: "En cours" },
  { key: "closed",    label: "Clôturées" },
  { key: "all",       label: "Toutes" },
];

// ─── Styles locaux à la page admin chatbot ─────────────────────────────────
// (anciennement importés depuis chatbot/frontend/chatStyles.js).

const local = {
  filterTabs: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 },
  filterTab: {
    padding: "6px 12px", borderRadius: 999, border: `1px solid ${T.border}`,
    background: "transparent", color: T.noir, cursor: "pointer",
    fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
  },
  filterTabActive: { background: T.noir, color: "#fff", borderColor: T.noir },

  statusBadge: {
    display: "inline-block", padding: "1px 8px", borderRadius: 999,
    fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase",
  },
  statusBadgeOpen:       { background: "rgba(35,107,56,0.12)", color: T.success },
  statusBadgeEscalated:  { background: "rgba(168,90,7,0.16)",  color: "#a85a07" },
  statusBadgeClosed:     { background: "rgba(0,0,0,0.08)",     color: T.textSoft },

  adminLayout: {
    display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)",
    gap: 18, minHeight: "calc(100vh - 200px)",
  },
  sessionsList: {
    background: "#fff", border: `1px solid ${T.border}`, borderRadius: T.radiusL,
    padding: 14, display: "flex", flexDirection: "column", gap: 8,
    minHeight: 0, overflowY: "auto", maxHeight: "calc(100vh - 220px)",
  },
  sessionItem: {
    padding: "12px 14px", border: `1px solid ${T.border}`, borderRadius: 12,
    cursor: "pointer", background: "#fff", display: "grid", gap: 4,
    transition: "background 0.15s ease, border-color 0.15s ease",
  },
  sessionItemActive: { background: T.bleuPale, borderColor: T.bleuBorder },
  sessionItemTitle: {
    fontWeight: 700, fontSize: 13, color: T.noir,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  sessionItemMeta: { fontSize: 11, color: T.textSoft, display: "flex", gap: 8, flexWrap: "wrap" },

  conversationPanel: {
    background: "#fff", border: `1px solid ${T.border}`, borderRadius: T.radiusL,
    display: "flex", flexDirection: "column", minHeight: 0,
    maxHeight: "calc(100vh - 220px)", overflow: "hidden",
  },
  conversationHeader: {
    padding: "14px 18px", borderBottom: `1px solid ${T.border}`,
    display: "flex", justifyContent: "space-between", alignItems: "center",
    gap: 10, flexWrap: "wrap",
  },

  messagesArea: {
    flex: 1, overflowY: "auto", padding: "16px 14px",
    display: "flex", flexDirection: "column", gap: 10, background: "#fafafa",
  },
  messageBase: {
    maxWidth: "85%", padding: "10px 14px", borderRadius: 14,
    fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
  },
  messageUser:      { alignSelf: "flex-end",   background: T.bleu, color: "#fff", borderBottomRightRadius: 4 },
  messageAssistant: { alignSelf: "flex-start", background: "#fff", color: T.noir, border: `1px solid ${T.border}`, borderBottomLeftRadius: 4 },
  messageAdmin:     { alignSelf: "flex-start", background: "rgba(35,107,56,0.10)", color: T.noir, border: `1px solid rgba(35,107,56,0.32)`, borderBottomLeftRadius: 4 },
  messageSystem:    { alignSelf: "center", background: "transparent", color: T.textSoft, fontStyle: "italic", fontSize: 12, padding: "4px 8px" },
  messageMeta:      { fontSize: 10, color: T.textSoft, marginTop: 4, letterSpacing: "0.02em" },
  messageMetaLight: { fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: 4 },

  inputArea: {
    padding: 12, borderTop: `1px solid ${T.border}`, background: "#fff",
    display: "flex", flexDirection: "column", gap: 8,
  },
  inputRow: { display: "flex", gap: 8, alignItems: "flex-end" },
  textarea: {
    flex: 1, minHeight: 40, maxHeight: 120, padding: "10px 12px",
    border: `1px solid ${T.border}`, borderRadius: 12,
    font: "inherit", fontSize: 14, resize: "none", outline: "none",
  },
  sendButton: {
    minHeight: 40, padding: "0 16px", border: "none",
    background: T.bleu, color: "#fff", borderRadius: 12, cursor: "pointer",
    fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
    fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "center",
  },
  sendButtonDisabled: { background: T.borderMid, cursor: "not-allowed" },
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function statusBadgeStyle(status) {
  if (status === "escalated") return { ...local.statusBadge, ...local.statusBadgeEscalated };
  if (status === "closed")    return { ...local.statusBadge, ...local.statusBadgeClosed };
  return { ...local.statusBadge, ...local.statusBadgeOpen };
}
function statusLabel(status) {
  if (status === "escalated") return "À traiter";
  if (status === "closed") return "Clôturée";
  return "En cours";
}
function formatRelative(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("fr-BE", { day: "2-digit", month: "2-digit" });
}
function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });
}

// chatbotFetch : wrapper fetch vers le serveur chatbot avec admin token.
async function chatbotFetch(path, opts = {}) {
  const token = (typeof window !== "undefined" && window.localStorage.getItem("portal_admin_access_token")) || "";
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(opts.headers || {}),
  };
  const url = path.startsWith("http") ? path : `${CHATBOT_URL}${path}`;
  const response = await fetch(url, { ...opts, headers });
  let data = null;
  try { data = await response.json(); } catch { /* ignore */ }
  if (!response.ok) {
    const error = new Error(data?.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

// ─── Hook admin chatbot ────────────────────────────────────────────────────

function useAdminChat() {
  const [sessions, setSessions] = useState([]);
  const [statusFilter, setStatusFilter] = useState("escalated");
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingCount, setPendingCount] = useState(0);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      const data = await chatbotFetch(`/api/chat/admin/sessions?${params}`);
      setSessions(data.sessions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const loadDetail = useCallback(async (id) => {
    if (!id) return;
    try {
      const data = await chatbotFetch(`/api/chat/admin/sessions/${id}`);
      setDetail(data);
    } catch (err) { setError(err.message); }
  }, []);

  const loadPendingCount = useCallback(async () => {
    try {
      const data = await chatbotFetch("/api/chat/admin/escalations/pending-count");
      setPendingCount(data.count || 0);
    } catch { /* silencieux */ }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);
  useEffect(() => { if (selectedId) loadDetail(selectedId); }, [selectedId, loadDetail]);
  useEffect(() => {
    loadPendingCount();
    const t = setInterval(loadPendingCount, 30_000);
    return () => clearInterval(t);
  }, [loadPendingCount]);

  const reply = useCallback(async (content) => {
    if (!selectedId) return;
    setError("");
    try {
      await chatbotFetch(`/api/chat/admin/sessions/${selectedId}/reply`, {
        method: "POST", body: JSON.stringify({ content }),
      });
      await loadDetail(selectedId);
      await loadSessions();
      await loadPendingCount();
    } catch (err) { setError(err.message); }
  }, [selectedId, loadDetail, loadSessions, loadPendingCount]);

  const close = useCallback(async () => {
    if (!selectedId) return;
    try {
      await chatbotFetch(`/api/chat/admin/sessions/${selectedId}/close`, { method: "POST" });
      await loadDetail(selectedId);
      await loadSessions();
      await loadPendingCount();
    } catch (err) { setError(err.message); }
  }, [selectedId, loadDetail, loadSessions, loadPendingCount]);

  return {
    sessions, statusFilter, setStatusFilter,
    selectedId, setSelectedId,
    detail, loading, error, pendingCount,
    reply, close,
    refresh: () => { loadSessions(); if (selectedId) loadDetail(selectedId); loadPendingCount(); },
  };
}

// ─── Bulle de message (rendu admin simplifié — pas de citations, pas de typing) ───

function AdminChatMessage({ message }) {
  const role = message.role || "assistant";
  if (role === "system") return <div style={local.messageSystem}>{message.content}</div>;

  const baseStyle = role === "user"
    ? { ...local.messageBase, ...local.messageUser }
    : role === "admin"
      ? { ...local.messageBase, ...local.messageAdmin }
      : { ...local.messageBase, ...local.messageAssistant };
  const metaStyle = role === "user" ? local.messageMetaLight : local.messageMeta;
  const senderLabel = role === "admin" ? "Conseiller" : role === "assistant" ? "Assistant" : null;

  return (
    <div style={baseStyle}>
      {senderLabel && <div style={{ ...metaStyle, marginTop: 0, marginBottom: 4, fontWeight: 700 }}>{senderLabel}</div>}
      <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
      {message.created_at && <div style={metaStyle}>{formatTime(message.created_at)}</div>}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

function AdminChatPage() {
  const {
    sessions, statusFilter, setStatusFilter,
    selectedId, setSelectedId,
    detail, loading, error, pendingCount,
    reply, close, refresh,
  } = useAdminChat();
  const [draft, setDraft] = useState("");
  const messagesRef = useRef(null);

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [detail?.messages?.length]);

  async function handleSend() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await reply(text);
  }
  function handleKeyDown(e) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div style={styles.pageStack}>
      <PageHeader
        variant="admin"
        kicker="Administration"
        title="Conversations chatbot"
        subtitle={pendingCount > 0
          ? `${pendingCount} demande(s) de prise en charge en attente`
          : "Suivi des conversations IA et reprise en main par un conseiller."}
      >
        <button type="button" style={styles.ghostButton} onClick={refresh}>
          <RefreshCw size={16} style={{ marginRight: 8 }} />
          Actualiser
        </button>
      </PageHeader>

      {error && <div style={styles.error}>{error}</div>}

      <div style={local.filterTabs}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatusFilter(f.key)}
            style={{ ...local.filterTab, ...(statusFilter === f.key ? local.filterTabActive : {}) }}
          >
            {f.label}
            {f.key === "escalated" && pendingCount > 0 && (
              <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 999, background: T.danger, color: "#fff", fontSize: 10 }}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={local.adminLayout}>
        <aside style={local.sessionsList}>
          {loading && sessions.length === 0 ? (
            <LoadingState message="Chargement…" />
          ) : sessions.length === 0 ? (
            <div style={styles.emptyState}>Aucune conversation pour ce filtre.</div>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                style={{
                  ...local.sessionItem,
                  ...(selectedId === s.id ? local.sessionItemActive : {}),
                  textAlign: "left",
                }}
              >
                <div style={local.sessionItemTitle}>
                  {s.company_name || s.user_email || `Session #${s.id}`}
                </div>
                <div style={{ fontSize: 12, color: T.textSoft, lineHeight: 1.3 }}>
                  {s.title || "(pas encore de message)"}
                </div>
                <div style={local.sessionItemMeta}>
                  <span style={statusBadgeStyle(s.status)}>{statusLabel(s.status)}</span>
                  <span>{s.message_count} msg</span>
                  <span>· {formatRelative(s.last_message_at)}</span>
                </div>
              </button>
            ))
          )}
        </aside>

        <section style={local.conversationPanel}>
          {!selectedId ? (
            <div style={{ padding: 32, color: T.textSoft }}>
              Sélectionnez une conversation pour voir le détail.
            </div>
          ) : !detail ? (
            <LoadingState message="Chargement de la conversation…" />
          ) : (
            <>
              <div style={local.conversationHeader}>
                <div>
                  <div style={{ fontWeight: 800 }}>{detail.session.company_name || detail.session.user_email}</div>
                  <div style={{ fontSize: 12, color: T.textSoft, marginTop: 2 }}>
                    {detail.session.user_name || detail.session.user_email}
                    {" · "}
                    <span style={statusBadgeStyle(detail.session.status)}>{statusLabel(detail.session.status)}</span>
                    {" · "}créée le {formatRelative(detail.session.created_at)}
                  </div>
                </div>
                {detail.session.status !== "closed" && (
                  <button type="button" style={styles.ghostButton} onClick={close}>
                    <Power size={14} style={{ marginRight: 8 }} />
                    Clore
                  </button>
                )}
              </div>

              <div style={local.messagesArea} ref={messagesRef}>
                {detail.messages.length === 0 ? (
                  <div style={local.messageSystem}>(Pas encore de messages)</div>
                ) : detail.messages.map((m) => <AdminChatMessage key={m.id} message={m} />)}
              </div>

              {detail.session.status !== "closed" && (
                <div style={local.inputArea}>
                  <div style={local.inputRow}>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Répondre au client (Ctrl/Cmd + Entrée pour envoyer)…"
                      rows={3}
                      style={local.textarea}
                    />
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={!draft.trim()}
                      style={{ ...local.sendButton, ...(!draft.trim() ? local.sendButtonDisabled : {}) }}
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default AdminChatPage;
