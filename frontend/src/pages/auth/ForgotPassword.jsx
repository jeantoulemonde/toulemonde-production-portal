import { useState } from "react";
import { api } from "../../api/api";
import Field from "../../components/Field";
import { styles } from "../../styles";

function ForgotPassword({ mode = "client" }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resetLink, setResetLink] = useState("");
  const isAdmin = mode === "admin";

  async function submit(event) {
    event.preventDefault();
    const data = await api(isAdmin ? "/api/auth/admin/forgot-password" : "/api/auth/client/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    setMessage(data.message);
    setResetLink(data.resetLink || "");
  }

  return (
    <div style={styles.loginPage}>
      <form style={styles.loginCard} onSubmit={submit}>
        <div style={styles.brand}>TOULEMONDE</div>
        <h1 style={styles.loginTitle}>{isAdmin ? "Accès admin oublié" : "Mot de passe oublié"}</h1>
        <p style={styles.muted}>Saisissez votre email pour préparer une réinitialisation sécurisée.</p>
        <Field label="Email">
          <input style={styles.input} value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <button style={styles.primaryButton}>Envoyer</button>
        {message && (
          <div style={styles.success}>
            {message}
            {resetLink && <div style={styles.helpText}>Dev : {resetLink}</div>}
          </div>
        )}
      </form>
    </div>
  );
}

export default ForgotPassword;
