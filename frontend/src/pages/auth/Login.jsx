import { useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../../api/api";
import { setSession } from "../../auth/session";
import { T } from "../../theme";

import atelierBobines from "../../assets/atelier-bobines.png";
import logoMarkBlue from "../../assets/M-RVB-2.png";
import logoToulemondeNew from "../../assets/logo-toulemonde-new.png";

function Login({ mode = "client" }) {
  const navigate = useNavigate();
  const isAdmin = mode === "admin";

  const [email, setEmail] = useState(
    isAdmin ? "admin@toulemonde.local" : "client@demo.local"
  );
  const [password, setPassword] = useState(isAdmin ? "Admin123!" : "Client123!");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event) {
    event.preventDefault();

    try {
      setError("");

      const data = await api(
        isAdmin ? "/api/auth/admin/login" : "/api/auth/client/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        }
      );

      setSession(data);
      navigate(data.redirectTo || (isAdmin ? "/admin" : "/client"));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="login-responsive" style={loginStyles.page}>
      <section style={loginStyles.visualPanel}>
        <img src={atelierBobines} alt="" style={loginStyles.visualImage} />
        <div style={loginStyles.visualOverlay} />
        <img src={logoMarkBlue} alt="" style={loginStyles.visualMark} />
      </section>

      <section style={loginStyles.formPanel}>
        <form style={loginStyles.card} onSubmit={submit}>
          <div style={loginStyles.logoBlock}>
            <img src={logoMarkBlue} alt="" style={loginStyles.logoMark} />
            <img
              src={logoToulemondeNew}
              alt="Toulemonde since 1903"
              style={loginStyles.logoText}
            />
          </div>

          <div>
            <h1 style={loginStyles.title}>
              {isAdmin ? "Connexion back-office" : "Connexion à votre compte"}
            </h1>
            <p style={loginStyles.subtitle}>
              {isAdmin
                ? "Accès réservé aux équipes Toulemonde Production."
                : "Bienvenue, veuillez vous connecter pour continuer."}
            </p>
          </div>

          {error && <div style={loginStyles.error}>{error}</div>}

          <label style={loginStyles.field}>
            <span style={loginStyles.label}>Adresse e-mail</span>
            <div style={loginStyles.inputWrap}>
              <span style={loginStyles.inputIcon}>✉</span>
              <input
                style={loginStyles.input}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nom@exemple.com"
              />
            </div>
          </label>

          <label style={loginStyles.field}>
            <span style={loginStyles.label}>Mot de passe</span>
            <div style={loginStyles.inputWrap}>
              <span style={loginStyles.inputIcon}>⌕</span>
              <input
                style={loginStyles.input}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Votre mot de passe"
              />
              <button
                type="button"
                style={loginStyles.eyeButton}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? "Masquer" : "Voir"}
              </button>
            </div>
          </label>

          <button
            type="button"
            style={loginStyles.forgotLink}
            onClick={() =>
              navigate(isAdmin ? "/admin/forgot-password" : "/client/forgot-password")
            }
          >
            Mot de passe oublié ?
          </button>

          <button type="submit" style={loginStyles.loginButton}>
            Se connecter
          </button>

          <p style={loginStyles.footerText}>
            Pas encore de compte ?{" "}
            <span style={loginStyles.footerLink}>Contactez votre administrateur.</span>
          </p>

          <p style={loginStyles.demoText}>
            {isAdmin
              ? "Démo admin : admin@toulemonde.local / Admin123!"
              : "Démo client : client@demo.local / Client123!"}
          </p>
        </form>
      </section>
    </div>
  );
}

const loginStyles = {
  visualMark: {
  position: "absolute",
  right: -180,
  top: 0,
  height: "100%",
  width: "62%",
  objectFit: "cover",
  objectPosition: "left center",
  opacity: 1,
  mixBlendMode: "normal",
  zIndex: 2,
},
visualImage: {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
  filter: "grayscale(1) contrast(1.08)",
},
  page: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    background: "#ffffff",
    fontFamily: T.fontBody,
  },

  visualPanel: {
    position: "relative",
    overflow: "hidden",
    background: "#050505",
  },

  visualImage: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    filter: "grayscale(1)",
  },

visualOverlay: {
  position: "absolute",
  inset: 0,
  background:
    "linear-gradient(90deg, rgba(0,0,0,0.18), rgba(0,0,0,0.02))",
},

formPanel: {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: "28px clamp(24px, 5vw, 70px)",
    boxSizing: "border-box",
    background:
      "radial-gradient(circle at 50% 20%, rgba(0,0,254,0.06), transparent 34%), #ffffff",
  },

card: {
  width: "100%",
  maxWidth: 460,
  display: "grid",
  gap: 20,
},
logoBlock: {
  display: "grid",
  justifyItems: "center",
  gap: 14,
  marginBottom: 26,
},

logoMark: {
  display: "none",
},

logoText: {
  width: "min(300px, 100%)",
  height: "auto",
  objectFit: "contain",
},

title: {
  margin: 0,
  color: "#11164a",
  fontSize: 25,
  fontWeight: 900,
  letterSpacing: "-0.04em",
  lineHeight: 1.1,
},

subtitle: {
  margin: "12px 0 0",
  color: "rgba(17,22,74,0.62)",
  fontSize: 15,
  lineHeight: 1.6,
},

  field: {
    display: "grid",
    gap: 10,
  },

  label: {
    color: "#272b5f",
    fontSize: 15,
    fontWeight: 600,
  },

inputWrap: {
  height: 50,
  display: "flex",
  alignItems: "center",
  gap: 14,
  border: "1px solid rgba(17,22,74,0.18)",
  borderRadius: 7,
  padding: "0 18px",
  background: "#ffffff",
  boxSizing: "border-box",
},

input: {
  flex: 1,
  border: "none",
  outline: "none",
  background: "transparent",
  color: "#11164a",
  fontSize: 15,
  minWidth: 0,
},

  inputIcon: {
    color: "rgba(17,22,74,0.48)",
    fontSize: 20,
    width: 24,
    textAlign: "center",
  },

  eyeButton: {
    border: "none",
    background: "transparent",
    color: "rgba(17,22,74,0.55)",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  forgotLink: {
    justifySelf: "end",
    border: "none",
    background: "transparent",
    color: "rgb(0,0,254)",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 600,
    padding: 0,
    marginTop: -12,
  },

  loginButton: {
    height: 64,
    border: "none",
    borderRadius: 6,
    background: "rgb(0,0,254)",
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 22px 44px rgba(0,0,254,0.22)",
  },

  footerText: {
    margin: 0,
    textAlign: "center",
    color: "rgba(17,22,74,0.70)",
    fontSize: 14,
  },

  footerLink: {
    color: "rgb(0,0,254)",
    fontWeight: 700,
  },

  demoText: {
    margin: 0,
    textAlign: "center",
    color: "rgba(17,22,74,0.42)",
    fontSize: 12,
  },

  error: {
    padding: 14,
    borderRadius: 8,
    color: "#9f1d1d",
    background: "rgba(159,29,29,0.08)",
    border: "1px solid rgba(159,29,29,0.18)",
  },
};

export default Login;