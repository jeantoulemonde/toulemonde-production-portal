// ============================================================================
// POC chatbot — module isolé, activé par CHATBOT_ENABLED.
// Retrait : voir chatbot/README.md → "Procédure de désactivation / retrait".
// ============================================================================
import { Link } from "react-router";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { chatStyles } from "./chatStyles";
import TypingIndicator from "./TypingIndicator";

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleString("fr-BE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatPrice(c) {
  if (c.price === null || c.price === undefined) return null;
  const symbol = c.currency === "EUR" ? "€" : (c.currency || "");
  return `${Number(c.price).toFixed(2)} ${symbol}/${c.unit_label || "pièce"}`;
}

// Rendu très léger : texte multilignes + détection naïve de liens (https://...)
function renderContent(text) {
  if (!text) return null;
  const lines = String(text).split("\n");
  return lines.map((line, i) => {
    const parts = line.split(/(https?:\/\/[^\s)]+)/g);
    return (
      <span key={i}>
        {parts.map((part, j) =>
          /^https?:\/\//i.test(part)
            ? (
              <a key={j} href={part} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
                {part}
              </a>
            )
            : <span key={j}>{part}</span>
        )}
        {i < lines.length - 1 && <br />}
      </span>
    );
  });
}

function CitationsRow({ citations }) {
  if (!citations || citations.length === 0) return null;
  return (
    <div style={chatStyles.citationsRow}>
      {citations.map((c) => {
        const price = formatPrice(c);
        const card = (
          <>
            {c.image_url
              ? <img src={c.image_url} alt="" style={chatStyles.citationCardThumb} />
              : <div style={chatStyles.citationCardThumb} />}
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
              <span style={chatStyles.citationCardTitle}>{c.title}</span>
              <span style={chatStyles.citationCardSku}>{c.sku}</span>
            </div>
            {price && <span style={chatStyles.citationCardPrice}>{price}</span>}
          </>
        );
        const key = `${c.sku}-${c.id || ""}`;
        return c.id
          ? <Link key={key} to={`/client/mercerie/products/${c.id}`} style={chatStyles.citationCard}>{card}</Link>
          : <div key={key} style={chatStyles.citationCard}>{card}</div>;
      })}
    </div>
  );
}

function FeedbackRow({ message, onFeedback }) {
  if (!message.id || typeof message.id === "string") return null; // pas de feedback sur les messages temporaires
  if (!onFeedback) return null;
  const score = message.feedback?.score;
  const btn = (active) => ({ ...chatStyles.feedbackButton, ...(active ? chatStyles.feedbackButtonActive : {}) });
  return (
    <div style={chatStyles.feedbackRow}>
      <button type="button" style={btn(score === 1)} onClick={() => onFeedback(message.id, 1)} aria-label="Réponse utile">
        <ThumbsUp size={12} />
      </button>
      <button type="button" style={btn(score === -1)} onClick={() => onFeedback(message.id, -1)} aria-label="Réponse pas utile">
        <ThumbsDown size={12} />
      </button>
    </div>
  );
}

function ChatMessage({ message, onFeedback }) {
  const role = message.role || "assistant";
  if (role === "system") {
    return (
      <div style={chatStyles.messageSystem}>
        {message.content}
      </div>
    );
  }
  const baseStyle = role === "user"
    ? { ...chatStyles.messageBase, ...chatStyles.messageUser }
    : role === "admin"
      ? { ...chatStyles.messageBase, ...chatStyles.messageAdmin }
      : { ...chatStyles.messageBase, ...chatStyles.messageAssistant };

  const metaStyle = role === "user" ? chatStyles.messageMetaLight : chatStyles.messageMeta;
  const senderLabel = role === "admin"
    ? "Conseiller"
    : role === "assistant"
      ? "Assistant"
      : null;

  // Pendant le streaming, le placeholder assistant a `pending: true` et
  // `content: ""` jusqu'au 1er token. On rend le TypingIndicator dans la
  // bulle existante au lieu du contenu — dès le 1er token, content devient
  // non-vide et le rendu bascule sur renderContent (même bulle, swap propre).
  const isTyping = role === "assistant" && message.pending && !message.content;

  return (
    <>
      <div style={baseStyle}>
        {senderLabel && <div style={{ ...metaStyle, marginTop: 0, marginBottom: 4, fontWeight: 700 }}>{senderLabel}</div>}
        {isTyping ? <TypingIndicator /> : renderContent(message.content)}
        {message.created_at && !isTyping && (
          <div style={metaStyle}>{formatTime(message.created_at)}</div>
        )}
      </div>
      {role === "assistant" && !isTyping && <CitationsRow citations={message.citations} />}
      {role === "assistant" && !isTyping && <FeedbackRow message={message} onFeedback={onFeedback} />}
    </>
  );
}

export default ChatMessage;
