// ============================================================================
// POC chatbot — module isolé, activé par CHATBOT_ENABLED.
// Retrait : voir chatbot/README.md → "Procédure de désactivation / retrait".
// ============================================================================
// Point d'entrée du module chatbot côté frontend.
// Affiche la bulle client uniquement quand un client est connecté.
// L'admin utilise la page dédiée /admin/chat (montée séparément dans AdminLayout).

import { useEffect, useState } from "react";
import ChatBubbleClient from "./ChatBubbleClient";
import { readActiveScope } from "./apiClient";

function ChatWidget() {
  const [scope, setScope] = useState(() => readActiveScope());

  // Met à jour le scope si la session change dans un autre onglet,
  // ou après login/logout dans ce même onglet.
  useEffect(() => {
    function update() { setScope(readActiveScope()); }
    window.addEventListener("storage", update);
    // On poll toutes les 5s pour détecter login/logout dans le même onglet.
    const t = setInterval(update, 5000);
    return () => {
      window.removeEventListener("storage", update);
      clearInterval(t);
    };
  }, []);

  if (scope !== "client") return null;
  return <ChatBubbleClient />;
}

export default ChatWidget;
