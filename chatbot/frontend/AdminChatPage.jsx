// ============================================================================
// POC chatbot — module isolé, activé par CHATBOT_ENABLED.
// Retrait : voir chatbot/README.md → "Procédure de désactivation / retrait".
// ============================================================================
import { useEffect, useRef, useState } from "react";
import { Send, RefreshCw, Power } from "lucide-react";
import { chatStyles } from "./chatStyles";
import { useAdminChat } from "./useChat";
import ChatMessage from "./ChatMessage";
import { styles } from "../../frontend/src/styles";
import { T } from "../../frontend/src/theme";
import PageHeader from "../../frontend/src/components/PageHeader";
import LoadingState from "../../frontend/src/components/LoadingState";

const STATUS_FILTERS = [
  { key: "escalated", label: "Escalations en attente" },
  { key: "open", label: "En cours" },
  { key: "closed", label: "Clôturées" },
  { key: "all", label: "Toutes" },
];

function statusBadgeStyle(status) {
  if (status === "escalated") return { ...chatStyles.statusBadge, ...chatStyles.statusBadgeEscalated };
  if (status === "closed") return { ...chatStyles.statusBadge, ...chatStyles.statusBadgeClosed };
  return { ...chatStyles.statusBadge, ...chatStyles.statusBadgeOpen };
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

      <div style={chatStyles.filterTabs}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatusFilter(f.key)}
            style={{
              ...chatStyles.filterTab,
              ...(statusFilter === f.key ? chatStyles.filterTabActive : {}),
            }}
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

      <div style={chatStyles.adminLayout}>
        <aside style={chatStyles.sessionsList}>
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
                  ...chatStyles.sessionItem,
                  ...(selectedId === s.id ? chatStyles.sessionItemActive : {}),
                  textAlign: "left",
                }}
              >
                <div style={chatStyles.sessionItemTitle}>
                  {s.company_name || s.user_email || `Session #${s.id}`}
                </div>
                <div style={{ fontSize: 12, color: T.textSoft, lineHeight: 1.3 }}>
                  {s.title || "(pas encore de message)"}
                </div>
                <div style={chatStyles.sessionItemMeta}>
                  <span style={statusBadgeStyle(s.status)}>{statusLabel(s.status)}</span>
                  <span>{s.message_count} msg</span>
                  <span>· {formatRelative(s.last_message_at)}</span>
                </div>
              </button>
            ))
          )}
        </aside>

        <section style={chatStyles.conversationPanel}>
          {!selectedId ? (
            <div style={{ padding: 32, color: T.textSoft }}>
              Sélectionnez une conversation pour voir le détail.
            </div>
          ) : !detail ? (
            <LoadingState message="Chargement de la conversation…" />
          ) : (
            <>
              <div style={chatStyles.conversationHeader}>
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

              <div style={{ ...chatStyles.messagesArea, background: "#fafafa", flex: 1 }} ref={messagesRef}>
                {detail.messages.length === 0 ? (
                  <div style={chatStyles.messageSystem}>(Pas encore de messages)</div>
                ) : detail.messages.map((m) => <ChatMessage key={m.id} message={m} />)}
              </div>

              {detail.session.status !== "closed" && (
                <div style={chatStyles.inputArea}>
                  <div style={chatStyles.inputRow}>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Répondre au client (Ctrl/Cmd + Entrée pour envoyer)…"
                      rows={3}
                      style={chatStyles.textarea}
                    />
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={!draft.trim()}
                      style={{
                        ...chatStyles.sendButton,
                        ...(!draft.trim() ? chatStyles.sendButtonDisabled : {}),
                      }}
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