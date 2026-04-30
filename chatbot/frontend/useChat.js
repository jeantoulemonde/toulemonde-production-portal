// ============================================================================
// POC chatbot — module isolé, activé par CHATBOT_ENABLED.
// Retrait : voir chatbot/README.md → "Procédure de désactivation / retrait".
// ============================================================================
// Hook React de gestion du chat côté client.
// Charge la session courante, l'historique, envoie des messages, gère l'escalade.

import { useCallback, useEffect, useRef, useState } from "react";
import { chatFetch } from "./apiClient";

// Lecture du token client identique à apiClient.js — duplication assumée pour
// éviter d'exposer un helper en plus rien que pour le streaming.
function readClientToken() {
  try { return window.localStorage.getItem("portal_client_access_token") || null; }
  catch { return null; }
}

export function useChat({ enabled = true } = {}) {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const loadedRef = useRef(false);
  const abortRef = useRef(null);

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const reload = useCallback(async () => {
    try {
      setError("");
      const data = await chatFetch("/api/chat/sessions/current/messages", { method: "GET" });
      setSession(data.session || null);
      setMessages(data.messages || []);
    } catch (err) {
      setError(err.message || "Impossible de charger la conversation");
    }
  }, []);

  useEffect(() => {
    if (!enabled || loadedRef.current) return;
    loadedRef.current = true;
    reload();
  }, [enabled, reload]);

  // Envoi en streaming SSE : on insère immédiatement le message user et un
  // placeholder assistant vide, puis on remplit ce dernier au fil des chunks.
  const send = useCallback(async (content) => {
    const trimmed = String(content || "").trim();
    if (!trimmed) return;

    const userTmpId = `user-tmp-${Date.now()}`;
    const assistantTmpId = `asst-tmp-${Date.now()}`;
    // _key est la clé React stable du message à travers ses renders : elle
    // ne change pas quand on swap l'id temporaire pour l'id serveur, donc
    // React conserve le DOM existant et l'animation d'apparition ne rejoue
    // pas (sinon : flash visuel à chaque arrivée du done event).
    const userOptimistic = {
      id: userTmpId, _key: userTmpId, role: "user", content: trimmed,
      created_at: new Date().toISOString(),
    };
    const assistantPending = {
      id: assistantTmpId, _key: assistantTmpId, role: "assistant", content: "",
      created_at: new Date().toISOString(), pending: true,
    };
    setMessages((prev) => [...prev, userOptimistic, assistantPending]);
    setSending(true);
    setError("");

    const ac = new AbortController();
    abortRef.current = ac;

    let response;
    try {
      response = await fetch("/api/chat/sessions/current/messages", {
        method: "POST",
        signal: ac.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${readClientToken() || ""}`,
        },
        body: JSON.stringify({ content: trimmed }),
      });
    } catch (err) {
      const aborted = err.name === "AbortError";
      if (!aborted) setError("Erreur réseau");
      setMessages((prev) => prev.filter((m) => m.id !== userTmpId && m.id !== assistantTmpId));
      setSending(false);
      abortRef.current = null;
      return;
    }

    if (!response.ok) {
      let data = null;
      try { data = await response.json(); } catch { /* ignore */ }
      setError(data?.error || `HTTP ${response.status}`);
      setMessages((prev) => prev.filter((m) => m.id !== userTmpId && m.id !== assistantTmpId));
      setSending(false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let assistantText = "";
    let finalAssistant = null;
    let finalSession = null;
    let errorMsg = "";

    try {
      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() || "";
        for (const block of blocks) {
          if (!block.trim()) continue;
          const eventMatch = block.match(/^event: (.+)$/m);
          const dataMatch = block.match(/^data: (.+)$/m);
          if (!eventMatch || !dataMatch) continue;
          const eventType = eventMatch[1].trim();
          let data;
          try { data = JSON.parse(dataMatch[1]); } catch { continue; }

          if (eventType === "delta") {
            assistantText += data.content || "";
            setMessages((prev) => prev.map((m) =>
              m.id === assistantTmpId ? { ...m, content: assistantText } : m
            ));
          } else if (eventType === "meta") {
            // Remplace l'id temporaire user par l'id réel en base.
            if (data.userMessageId) {
              setMessages((prev) => prev.map((m) =>
                m.id === userTmpId ? { ...m, id: data.userMessageId } : m
              ));
            }
          } else if (eventType === "done") {
            finalAssistant = data.assistant;
            finalSession = data.session;
            if (data.escalated && data.info) errorMsg = data.info;
          } else if (eventType === "error") {
            errorMsg = data.error || "Erreur";
          }
        }
      }
    } catch (err) {
      // Si l'utilisateur a cliqué stop, ce n'est pas une erreur.
      if (err.name !== "AbortError") errorMsg = err.message || "Erreur de streaming";
    }

    abortRef.current = null;
    if (finalSession) setSession(finalSession);
    if (finalAssistant) {
      setMessages((prev) => prev.map((m) =>
        m._key === assistantTmpId
          ? {
              ...m, // préserve _key
              id: finalAssistant.id,
              role: "assistant",
              content: finalAssistant.content,
              created_at: finalAssistant.created_at,
              pending: false,
              ...(finalAssistant.citations ? { citations: finalAssistant.citations } : {}),
            }
          : m
      ));
    } else {
      // Pas d'assistant produit (escalade ou erreur) → on retire le placeholder.
      setMessages((prev) => prev.filter((m) => m.id !== assistantTmpId));
    }
    if (errorMsg) setError(errorMsg);
    setSending(false);
  }, []);

  const escalate = useCallback(async (reason) => {
    setSending(true);
    setError("");
    try {
      await chatFetch("/api/chat/sessions/current/escalate", {
        method: "POST",
        body: JSON.stringify({ reason: reason || null }),
      });
      await reload();
    } catch (err) {
      setError(err.message || "Erreur lors de la demande de prise en charge");
    } finally {
      setSending(false);
    }
  }, [reload]);

  const sendFeedback = useCallback(async (messageId, score) => {
    // Optimistic : on met à jour l'UI immédiatement, on rollback sur échec.
    const prev = messages.find((m) => m.id === messageId);
    setMessages((list) => list.map((m) => m.id === messageId
      ? { ...m, feedback: { score, at: new Date().toISOString() } }
      : m));
    try {
      await chatFetch(`/api/chat/messages/${messageId}/feedback`, {
        method: "POST",
        body: JSON.stringify({ score }),
      });
    } catch (err) {
      setMessages((list) => list.map((m) => m.id === messageId
        ? { ...m, feedback: prev?.feedback }
        : m));
      setError(err.message || "Erreur feedback");
    }
  }, [messages]);

  return { session, messages, sending, error, send, escalate, reload, abort, sendFeedback };
}

// ─── Hook admin : liste des sessions et conversation sélectionnée ──────────

export function useAdminChat() {
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
      const data = await chatFetch(`/api/chat/admin/sessions?${params}`);
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
      const data = await chatFetch(`/api/chat/admin/sessions/${id}`);
      setDetail(data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const loadPendingCount = useCallback(async () => {
    try {
      const data = await chatFetch("/api/chat/admin/escalations/pending-count");
      setPendingCount(data.count || 0);
    } catch {
      // silencieux
    }
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
      await chatFetch(`/api/chat/admin/sessions/${selectedId}/reply`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      await loadDetail(selectedId);
      await loadSessions();
      await loadPendingCount();
    } catch (err) {
      setError(err.message);
    }
  }, [selectedId, loadDetail, loadSessions, loadPendingCount]);

  const close = useCallback(async () => {
    if (!selectedId) return;
    try {
      await chatFetch(`/api/chat/admin/sessions/${selectedId}/close`, { method: "POST" });
      await loadDetail(selectedId);
      await loadSessions();
      await loadPendingCount();
    } catch (err) {
      setError(err.message);
    }
  }, [selectedId, loadDetail, loadSessions, loadPendingCount]);

  return {
    sessions, statusFilter, setStatusFilter,
    selectedId, setSelectedId,
    detail, loading, error, pendingCount,
    reply, close,
    refresh: () => { loadSessions(); if (selectedId) loadDetail(selectedId); loadPendingCount(); },
  };
}