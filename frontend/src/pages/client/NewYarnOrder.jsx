import { useState } from "react";
import { useNavigate } from "react-router";
import atelierBobines from "../../assets/atelier-bobines.png";
import atelierMatiere from "../../assets/atelier-matiere.png";
import { api } from "../../api/api";
import { styles } from "../../styles";
import { useIsMobile } from "../../utils/useIsMobile";
import Field from "../../components/Field";
import Select from "../../components/Select";

function NewYarnOrder() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const steps = ["Référence", "Fil", "Production", "Livraison", "Document", "Validation"];
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    customer_reference: "",
    requested_date: "",
    urgent: false,
    comment: "",
    material: "",
    yarn_count_nm: "",
    ply_number: "2",
    twist: "Retordu",
    color: "",
    dyeing_required: false,
    color_reference: "",
    quantity_kg: "",
    conditioning: "Cônes",
    destination_usage: "Tricotage",
    tolerance_percent: "",
    requested_delivery_date: "",
    partial_delivery_allowed: false,
  });
  const [errors, setErrors] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function validateStep(targetStep = step) {
    const nextErrors = {};
    if (targetStep === 0) {
      if (!form.customer_reference.trim()) nextErrors.customer_reference = "Référence client obligatoire.";
      if (!form.requested_date) nextErrors.requested_date = "Date souhaitée obligatoire.";
    }
    if (targetStep === 1) {
      if (!form.material) nextErrors.material = "Matière obligatoire.";
      if (!form.yarn_count_nm) nextErrors.yarn_count_nm = "Titre Nm obligatoire.";
    }
    if (targetStep === 2 && !form.quantity_kg) {
      nextErrors.quantity_kg = "Quantité obligatoire.";
    }
    if (targetStep === 3 && !form.requested_delivery_date) {
      nextErrors.requested_delivery_date = "Date de livraison souhaitée obligatoire.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function nextStep() {
    if (!validateStep(step)) return;
    setStep((prev) => Math.min(prev + 1, steps.length - 1));
  }

  function previousStep() {
    setErrors({});
    setStep((prev) => Math.max(prev - 1, 0));
  }

  async function submit(event) {
    event.preventDefault();
    const valid = [0, 1, 2, 3, 4].every((stepIndex) => validateStep(stepIndex));
    if (!valid) return;

    try {
      setLoading(true);
      setSuccess("");
      await api("/api/client/orders", { method: "POST", body: JSON.stringify(form) });
      setSuccess("Votre commande a bien été envoyée à Toulemonde Production.");
      setTimeout(() => navigate("/client/orders"), 800);
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form style={styles.wizardShell} onSubmit={submit}>
      <div style={{ ...styles.wizardHeader, ...(isMobile ? styles.wizardHeaderMobile : {}) }}>
        <div>
          <div style={styles.overline}>Commande de fil</div>
          <h2 style={styles.cardTitle}>Nouvelle commande filature</h2>
        </div>
        <img src={step < 2 ? atelierBobines : atelierMatiere} alt="" style={styles.wizardImage} />
      </div>
      <div style={styles.stepper}>
        {steps.map((label, index) => (
          <button key={label} type="button" style={{ ...styles.stepPill, ...(index === step ? styles.stepPillActive : {}) }} onClick={() => index <= step && setStep(index)}>
            <span style={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span>{label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div style={styles.formGrid}>
          <Field label="Référence client" error={errors.customer_reference}><input style={styles.input} value={form.customer_reference} onChange={(e) => update("customer_reference", e.target.value)} /></Field>
          <Field label="Date souhaitée" error={errors.requested_date}><input style={styles.input} type="date" value={form.requested_date} onChange={(e) => update("requested_date", e.target.value)} /></Field>
          <label style={styles.checkLine}><input type="checkbox" checked={form.urgent} onChange={(e) => update("urgent", e.target.checked)} /> Commande urgente</label>
          <Field label="Commentaire"><textarea style={styles.textarea} value={form.comment} onChange={(e) => update("comment", e.target.value)} /></Field>
        </div>
      )}

      {step === 1 && (
        <div style={styles.formGrid}>
          <Field label="Matière" error={errors.material}><Select value={form.material} onChange={(value) => update("material", value)} options={["", "Laine", "Coton", "Lin", "Mérinos", "Mélange"]} /></Field>
          <Field label="Titre Nm" error={errors.yarn_count_nm}><Select value={form.yarn_count_nm} onChange={(value) => update("yarn_count_nm", value)} options={["", "Nm 1/18", "Nm 2/28", "Nm 2/30", "Nm 3/34"]} /></Field>
          <Field label="Nombre de plis"><Select value={form.ply_number} onChange={(value) => update("ply_number", value)} options={["1", "2", "3", "4"]} /></Field>
          <Field label="Retordage"><Select value={form.twist} onChange={(value) => update("twist", value)} options={["Simple", "Retordu", "S/Z", "Spécifique"]} /></Field>
          <Field label="Couleur"><input style={styles.input} value={form.color} onChange={(e) => update("color", e.target.value)} /></Field>
          <Field label="Référence couleur"><input style={styles.input} value={form.color_reference} onChange={(e) => update("color_reference", e.target.value)} /></Field>
          <label style={styles.checkLine}><input type="checkbox" checked={form.dyeing_required} onChange={(e) => update("dyeing_required", e.target.checked)} /> Teinture requise</label>
        </div>
      )}

      {step === 2 && (
        <div style={styles.formGrid}>
          <Field label="Quantité kg" error={errors.quantity_kg}><input style={styles.input} type="number" value={form.quantity_kg} onChange={(e) => update("quantity_kg", e.target.value)} /></Field>
          <Field label="Conditionnement"><Select value={form.conditioning} onChange={(value) => update("conditioning", value)} options={["Cônes", "Bobines", "Écheveaux"]} /></Field>
          <Field label="Usage destination"><Select value={form.destination_usage} onChange={(value) => update("destination_usage", value)} options={["Tricotage", "Tissage", "Teinture", "Retordage"]} /></Field>
          <Field label="Tolérance %"><input style={styles.input} type="number" value={form.tolerance_percent} onChange={(e) => update("tolerance_percent", e.target.value)} /></Field>
        </div>
      )}

      {step === 3 && (
        <div style={styles.formGrid}>
          <Field label="Date de livraison souhaitée" error={errors.requested_delivery_date}><input style={styles.input} type="date" value={form.requested_delivery_date} onChange={(e) => update("requested_delivery_date", e.target.value)} /></Field>
          <label style={styles.checkLine}><input type="checkbox" checked={form.partial_delivery_allowed} onChange={(e) => update("partial_delivery_allowed", e.target.checked)} /> Livraison partielle acceptée</label>
        </div>
      )}

      {step === 4 && (
        <div style={styles.uploadPanel}>
          <div>
            <div style={styles.overline}>Document technique</div>
            <h3 style={styles.uploadTitle}>Ajoutez un fichier utile à la production</h3>
            <p style={styles.muted}>Formats acceptés : PDF, JPG ou PNG.</p>
          </div>
          <Field label="Fichier technique">
            <input style={styles.input} type="file" accept=".pdf,image/jpeg,image/png" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
            {selectedFile && <span style={styles.fileName}>{selectedFile.name}</span>}
          </Field>
        </div>
      )}

      {step === 5 && <OrderSummary form={form} selectedFile={selectedFile} />}

      {errors.submit && <div style={styles.error}>{errors.submit}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <div style={styles.formActions}>
        {step > 0 && <button type="button" style={styles.ghostButton} onClick={previousStep}>Retour</button>}
        {step < steps.length - 1 ? (
          <button type="button" style={styles.primaryButton} onClick={nextStep}>Continuer</button>
        ) : (
          <button style={styles.primaryButton} disabled={loading}>{loading ? "Envoi..." : "Envoyer la commande"}</button>
        )}
      </div>
    </form>
  );
}

function OrderSummary({ form, selectedFile }) {
  const rows = [
    ["Référence", form.customer_reference],
    ["Date souhaitée", form.requested_date],
    ["Urgence", form.urgent ? "Oui" : "Non"],
    ["Matière", form.material],
    ["Titre Nm", form.yarn_count_nm],
    ["Brins", form.ply_number],
    ["Retordage", form.twist],
    ["Couleur", form.color],
    ["Teinture", form.dyeing_required ? "Oui" : "Non"],
    ["Quantité", `${form.quantity_kg || "—"} kg`],
    ["Conditionnement", form.conditioning],
    ["Usage", form.destination_usage],
    ["Livraison souhaitée", form.requested_delivery_date],
    ["Livraison partielle", form.partial_delivery_allowed ? "Oui" : "Non"],
    ["Fichier", selectedFile?.name || "Aucun fichier sélectionné"],
  ];

  return (
    <div style={styles.summaryGrid}>
      {rows.map(([label, value]) => (
        <div key={label} style={styles.summaryItem}>
          <div style={styles.label}>{label}</div>
          <div>{value || "—"}</div>
        </div>
      ))}
    </div>
  );
}

export default NewYarnOrder;
