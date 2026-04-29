// ============================================================================
// POC chatbot — module isolé, activé par CHATBOT_ENABLED.
// Retrait : voir chatbot/README.md → "Procédure de désactivation / retrait".
// ============================================================================
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { X, Send, Square, UserPlus } from "lucide-react";
import { chatStyles } from "./chatStyles";
import { useChat } from "./useChat";
import ChatMessage from "./ChatMessage";
import ChatIcon from "./ChatIcon";

const HIDDEN_PATHS = [
  /^\/client\/login/,
  /^\/client\/forgot-password/,
  /^\/client\/reset-password/,
  /^\/admin/,
  /^\/login/,
  /^\/forgot-password/,
  /^\/reset-password/,
];

function shouldHide(pathname) {
  return HIDDEN_PATHS.some((rx) => rx.test(pathname));
}

function ChatBubbleClient() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [hovered, setHovered] = useState(false);
  const [confirmEscalate, setConfirmEscalate] = useState(false);
  const messagesRef = useRef(null);

  const { session, messages, sending, error, send, escalate, abort, sendFeedback } = useChat({ enabled: open });

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, open]);

  if (shouldHide(location.pathname)) return null;

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    await send(text);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleEscalate() {
    if (sending) return;
    await escalate(draft || null);
    setConfirmEscalate(false);
  }

  const isEscalated = session?.status === "escalated";

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          aria-label="Ouvrir le chat d'assistance"
          title="Assistance Toulemonde"
          style={{ ...chatStyles.bubbleButton, ...(hovered ? chatStyles.bubbleButtonHover : {}) }}
        >
          <ChatIcon />
        </button>
      )}
      {open && (
        <div style={chatStyles.panel} role="dialog" aria-label="Assistance Toulemonde">
          <div style={chatStyles.panelHeader}>
            <div>
              <div style={chatStyles.panelTitle}>Assistance Toulemonde</div>
              <div style={chatStyles.panelSubtitle}>
                {isEscalated ? "Conseiller en route" : "Assistant en ligne"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={chatStyles.panelClose}
              aria-label="Fermer le chat"
              title="Fermer"
            >
              <X size={16} />
            </button>
          </div>

          <div style={chatStyles.messagesArea} ref={messagesRef}>
            {messages.length === 0 && !sending && (
              <div style={chatStyles.messageSystem}>
                Bonjour 👋 Je suis l'assistant virtuel Toulemonde.
                Comment puis-je vous aider ?
              </div>
            )}
            {messages.map((m) => <ChatMessage key={m.id} message={m} onFeedback={sendFeedback} />)}
            {sending && <div style={chatStyles.typingIndicator}>L'assistant écrit…</div>}
          </div>

          {error && <div style={chatStyles.errorBanner}>{error}</div>}

          <div style={chatStyles.inputArea}>
            <div style={chatStyles.inputRow}>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isEscalated ? "Écrivez à votre conseiller…" : "Posez une question…"}
                rows={2}
                style={chatStyles.textarea}
                disabled={sending}
              />
              {sending ? (
                <button
                  type="button"
                  onClick={abort}
                  style={chatStyles.sendButton}
                  aria-label="Stopper la génération"
                  title="Stopper"
                >
                  <Square size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!draft.trim()}
                  style={{
                    ...chatStyles.sendButton,
                    ...(!draft.trim() ? chatStyles.sendButtonDisabled : {}),
                  }}
                  aria-label="Envoyer"
                  title="Envoyer (Entrée)"
                >
                  <Send size={16} />
                </button>
              )}
            </div>
            {!isEscalated && (
              confirmEscalate ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#666" }}>Demander un conseiller ?</span>
                  <button type="button" style={chatStyles.escalateButton} onClick={() => setConfirmEscalate(false)}>
                    Annuler
                  </button>
                  <button
                    type="button"
                    style={{ ...chatStyles.escalateButton, ...chatStyles.escalateButtonActive }}
                    onClick={handleEscalate}
                    disabled={sending}
                  >
                    Confirmer
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  style={chatStyles.escalateButton}
                  onClick={() => setConfirmEscalate(true)}
                >
                  <UserPlus size={12} style={{ marginRight: 6 }} />
                  Parler à quelqu'un
                </button>
              )
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default ChatBubbleClient;
