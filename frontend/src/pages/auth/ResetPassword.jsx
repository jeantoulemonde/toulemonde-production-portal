import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { api } from "../../api/api";
import Field from "../../components/Field";
import { styles } from "../../styles";

function ResetPassword({ mode = "client" }) {
  const navigate = useNavigate();
  const { token } = useParams();
  const isAdmin = mode === "admin";
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    try {
      setError("");
      await api(isAdmin ? "/api/auth/admin/reset-password" : "/api/auth/client/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setMessage("Mot de passe mis à jour.");
      setTimeout(() => navigate(isAdmin ? "/admin/login" : "/client/login"), 700);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={styles.loginPage}>
      <form style={styles.loginCard} onSubmit={submit}>
        <div style={styles.brand}>TOULEMONDE</div>
        <h1 style={styles.loginTitle}>Nouveau mot de passe</h1>
        <Field label="Mot de passe">
          <input style={styles.input} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </Field>
        <button style={styles.primaryButton}>Valider</button>
        {error && <div style={styles.error}>{error}</div>}
        {message && <div style={styles.success}>{message}</div>}
        <div style={styles.helpText}>Minimum 10 caractères.</div>
      </form>
    </div>
  );
}

export default ResetPassword;
