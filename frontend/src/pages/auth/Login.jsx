import { useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../../api/api";
import { setSession } from "../../auth/session";
import Field from "../../components/Field";
import { styles } from "../../styles";

function Login({ mode = "client" }) {
  const navigate = useNavigate();
  const isAdmin = mode === "admin";
  const [email, setEmail] = useState(isAdmin ? "admin@toulemonde.local" : "client@demo.local");
  const [password, setPassword] = useState(isAdmin ? "Admin123!" : "Client123!");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    try {
      const data = await api(isAdmin ? "/api/auth/admin/login" : "/api/auth/client/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setSession(data);
      navigate(data.redirectTo || (isAdmin ? "/admin" : "/client"));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={styles.loginPage}>
      <form style={styles.loginCard} onSubmit={submit}>
        <div style={styles.brand}>TOULEMONDE</div>
        <h1 style={styles.loginTitle}>{isAdmin ? "Back-office admin" : "Portail privé filature"}</h1>
        <p style={styles.muted}>
          {isAdmin ? "Accès réservé aux équipes Toulemonde Production." : "Accès privé à vos commandes de fil et documents de production."}
        </p>
        {error && <div style={styles.error}>{error}</div>}
        <Field label="Email">
          <input style={styles.input} value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label="Mot de passe">
          <input style={styles.input} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </Field>
        <button style={styles.primaryButton}>Connexion</button>
        <button type="button" style={styles.linkButton} onClick={() => navigate(isAdmin ? "/admin/forgot-password" : "/client/forgot-password")}>
          Mot de passe oublié
        </button>
        <div style={styles.helpText}>
          {isAdmin ? "Démo admin : admin@toulemonde.local / Admin123!" : "Démo client : client@demo.local / Client123!"}
        </div>
      </form>
    </div>
  );
}

export default Login;
