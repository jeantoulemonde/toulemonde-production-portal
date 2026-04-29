import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Factory, ShoppingBag } from "lucide-react";
import atelierBobines from "../../assets/atelier-bobines.png";
import atelierMatiere from "../../assets/atelier-matiere.png";
import { api } from "../../api/api";
import Field from "../../components/Field";
import PageContainer from "../../components/PageContainer";
import PageHeader from "../../components/PageHeader";
import Select from "../../components/Select";
import { styles } from "../../styles";
import { T } from "../../theme";
import { useIsMobile } from "../../utils/useIsMobile";

const requestSteps = ["Informations générales", "Lignes de demande", "Validation"];
const lineSteps = ["Application", "Matière", "Construction", "Couleur", "Conditionnement"];

const applicationOptions = [
  ["Tissage chaîne", "Fil adapté aux contraintes de résistance et régularité."],
  ["Tissage trame", "Fil adapté au passage en trame."],
  ["Tricotage", "Fil pour métier rectiligne ou circulaire."],
  ["Broderie", "Fil adapté aux supports type cocons, tubes ou bobines."],
  ["Confection", "Fil à coudre industriel."],
  ["Maroquinerie", "Fil pour cuir, à la main ou machine."],
  ["Technique", "Besoins spécifiques ou hautes contraintes."],
  ["Autre", "Demande particulière à préciser dans les commentaires."],
];

const materialQualities = {
  Lin: ["Lin Master of Linen", "Lin longs brins", "Lin retors", "Lin câblé"],
  Coton: ["Coton longues fibres", "Coton égyptien", "Coton gazé", "Coton gazé mercerisé", "Coton open-end", "Coton GOTS"],
  Polyester: ["Polyester fibres", "Polyester continu", "Polyester texturé", "Polyester haute ténacité", "Polyester brillant"],
  Polycoton: ["Polycoton standard", "Polycoton couture", "Polycoton maroquinerie"],
  Polyamide: ["Polyamide standard", "Polyamide technique"],
  Viscose: ["Viscose discontinue", "Viscose continue"],
  Soie: ["Soie"],
  Mélange: ["Mélange sur cahier des charges", "Mélange fibres naturelles", "Mélange technique"],
  "Fil spécial": ["Métalloplastique", "Non-feu", "Fantaisie", "Technique spécifique"],
  "Fil élastique": ["Fil élastique standard", "Fil élastique technique"],
};

const materialHelp = {
  Lin: "Adapté aux fils naturels, retors ou câblés, avec rendu textile haut de gamme.",
  Coton: "Famille polyvalente pour couture, broderie, tissage et usages certifiés selon besoin.",
  Polyester: "Solution régulière et résistante pour usages industriels ou contraintes fortes.",
  Polycoton: "Compromis technique pour couture et confection avec bonne stabilité.",
  Polyamide: "Matière indiquée pour résistance, souplesse et usages techniques.",
  Viscose: "Aspect brillant ou fluide selon construction et destination.",
  Soie: "Matière noble pour applications spécifiques et finitions premium.",
  Mélange: "À préciser selon les fibres et performances attendues.",
  "Fil spécial": "Pour propriétés particulières : non-feu, fantaisie, métalloplastique ou contrainte métier.",
  "Fil élastique": "Pour besoins d’élasticité contrôlée.",
};

const countOptions = ["", "Nm 8/1", "Nm 10/1", "Nm 12/1", "Nm 16.5/1", "Nm 17/1", "Nm 24/1", "Nm 26/1", "Nm 28/2", "Nm 28/3", "Nm 28/4", "Nm 39/1", "Nm 40/2", "Nm 45/1", "Nm 50/1", "Nm 50/3", "Autre"];
const packagingOptions = ["", "Cône", "Cône tissage", "Cône fil à coudre", "Cône jumbo", "Cône teinture", "Tube carton", "King Spool", "Bobine", "Bobine à joues", "Cocon", "Fusette", "Écheveau", "Autre"];

const initialRequest = {
  customer_reference: "",
  requested_delivery_date: "",
  delivery_address_choice: "profile",
  delivery_address: "",
  urgent: false,
  general_comment: "",
};

const initialLine = {
  application_type: "",
  material_family: "",
  material_quality: "",
  count_system: "Nm",
  yarn_count_nm: "",
  dtex: "",
  custom_count: "",
  ply_number: "2",
  twist_type: "Retordu",
  twist_direction: "Non précisé",
  finish: "Aucun",
  color_mode: "Écru",
  color_name: "",
  color_reference: "",
  dyeing_required: false,
  dyeing_comment: "",
  packaging: "",
  quantity_kg: "",
  meterage_per_unit: "",
  tolerance_percent: 5,
  partial_delivery_allowed: false,
  production_comment: "",
};

function NewYarnOrder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile(1100);
  const draftId = searchParams.get("draftId");
  const initialType = draftId || searchParams.get("type") === "technical" ? "technical" : null;
  const [flowType, setFlowType] = useState(initialType);
  const [step, setStep] = useState(0);
  const [lineStep, setLineStep] = useState(0);
  const [request, setRequest] = useState(initialRequest);
  const [lines, setLines] = useState([]);
  const [lineDraft, setLineDraft] = useState(initialLine);
  const [editingIndex, setEditingIndex] = useState(null);
  const [linePanelOpen, setLinePanelOpen] = useState(false);
  const [detailLineIndex, setDetailLineIndex] = useState(null);
  const [profile, setProfile] = useState(null);
  const [draftOrderId, setDraftOrderId] = useState(draftId || null);
  const [draftLoaded, setDraftLoaded] = useState(!draftId);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    api("/api/client/profile").then(setProfile).catch(() => {});
  }, []);

  useEffect(() => {
    if (!draftId) return;
    setDraftLoaded(false);
    api(`/api/client/orders/${draftId}`)
      .then((data) => {
        if (data.order?.status !== "draft") {
          setErrors({ submit: "Cette demande a déjà été soumise et ne peut plus être modifiée." });
          return;
        }
        setDraftOrderId(String(data.order.id));
        setRequest({
          customer_reference: data.order.client_reference || "",
          requested_delivery_date: data.order.requested_delivery_date || data.order.requested_date || "",
          delivery_address_choice: data.order.delivery_address_choice || "profile",
          delivery_address: data.order.delivery_address || "",
          urgent: data.order.urgency === "urgent",
          general_comment: data.order.comment || "",
        });
        setLines((data.lines || []).map((line) => ({
          ...initialLine,
          ...line,
          dyeing_required: Boolean(line.dyeing_required),
          partial_delivery_allowed: Boolean(line.partial_delivery_allowed),
          quantity_kg: line.quantity_kg ?? "",
          tolerance_percent: line.tolerance_percent ?? 5,
        })));
      })
      .catch((err) => setErrors({ submit: err.message }))
      .finally(() => setDraftLoaded(true));
  }, [draftId]);

  const totalQuantity = useMemo(() => lines.reduce((sum, line) => sum + Number(line.quantity_kg || 0), 0), [lines]);
  const profileAddress = [
    profile?.shipping_address,
    profile?.shipping_postal_code,
    profile?.shipping_city,
    profile?.shipping_country,
  ].filter(Boolean).join(" ");

  function updateRequest(field, value) {
    setRequest((prev) => ({ ...prev, [field]: value }));
  }

  function updateLine(field, value) {
    setLineDraft((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "material_family") next.material_quality = "";
      if (field === "color_mode" && value === "Teinture sur demande") next.dyeing_required = true;
      if (field === "count_system") {
        next.yarn_count_nm = value === "Nm" ? prev.yarn_count_nm : "";
        next.dtex = value === "dtex" ? prev.dtex : "";
        next.custom_count = value === "numéro spécial / autre" ? prev.custom_count : "";
      }
      return next;
    });
  }

  function validateGeneral() {
    const nextErrors = {};
    if (!request.customer_reference.trim()) nextErrors.customer_reference = "Référence client obligatoire.";
    if (!request.requested_delivery_date) nextErrors.requested_delivery_date = "Date de livraison souhaitée obligatoire.";
    if (request.delivery_address_choice === "specific" && !request.delivery_address.trim()) nextErrors.delivery_address = "Adresse spécifique obligatoire.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validateLine(target = lineStep, line = lineDraft) {
    const nextErrors = {};
    if (target === 0 && !line.application_type) nextErrors.application_type = "Sélectionnez une application.";
    if (target === 1 && !line.material_family) nextErrors.material_family = "Sélectionnez une famille de matière.";
    if (target === 2) {
      if (!line.count_system) nextErrors.count_system = "Sélectionnez un système de titrage.";
      if (line.count_system === "Nm" && !line.yarn_count_nm) nextErrors.yarn_count_nm = "Sélectionnez ou précisez le titre Nm.";
      if (line.count_system === "Nm" && line.yarn_count_nm === "Autre" && !line.custom_count.trim()) nextErrors.custom_count = "Précisez le titre Nm.";
      if (line.count_system === "dtex" && !line.dtex) nextErrors.dtex = "Renseignez le dtex.";
      if (line.count_system === "numéro spécial / autre" && !line.custom_count.trim()) nextErrors.custom_count = "Précisez le titrage.";
      if (!line.ply_number) nextErrors.ply_number = "Nombre de bouts obligatoire.";
    }
    if (target === 4) {
      if (!line.packaging) nextErrors.packaging = "Sélectionnez un conditionnement.";
      if (!line.quantity_kg || Number(line.quantity_kg) <= 0) nextErrors.quantity_kg = "Quantité obligatoire.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validateFullLine(line) {
    const missing = {};
    if (!line.application_type) missing.application_type = "Sélectionnez une application.";
    if (!line.material_family) missing.material_family = "Sélectionnez une famille de matière.";
    if (!line.count_system) missing.count_system = "Sélectionnez un système de titrage.";
    if (line.count_system === "Nm" && !line.yarn_count_nm) missing.yarn_count_nm = "Sélectionnez ou précisez le titre Nm.";
    if (line.count_system === "Nm" && line.yarn_count_nm === "Autre" && !line.custom_count.trim()) missing.custom_count = "Précisez le titre Nm.";
    if (line.count_system === "dtex" && !line.dtex) missing.dtex = "Renseignez le dtex.";
    if (line.count_system === "numéro spécial / autre" && !line.custom_count.trim()) missing.custom_count = "Précisez le titrage.";
    if (!line.ply_number) missing.ply_number = "Nombre de bouts obligatoire.";
    if (!line.packaging) missing.packaging = "Sélectionnez un conditionnement.";
    if (!line.quantity_kg || Number(line.quantity_kg) <= 0) missing.quantity_kg = "Quantité obligatoire.";
    return missing;
  }

  function startAddLine() {
    setLineDraft(initialLine);
    setEditingIndex(null);
    setLineStep(0);
    setErrors({});
    setStep(1);
    setLinePanelOpen(true);
  }

  function startEditLine(index) {
    setLineDraft({ ...initialLine, ...lines[index] });
    setEditingIndex(index);
    setLineStep(0);
    setErrors({});
    setStep(1);
    setLinePanelOpen(true);
  }

  function duplicateLine(index) {
    setLines((prev) => {
      const copy = { ...prev[index] };
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
    });
  }

  function removeLine(index) {
    setLines((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  function saveLine() {
    const lineErrors = validateFullLine(lineDraft);
    if (Object.keys(lineErrors).length) {
      setErrors(lineErrors);
      return;
    }
    setLines((prev) => {
      if (editingIndex === null) return [...prev, lineDraft];
      return prev.map((line, index) => (index === editingIndex ? lineDraft : line));
    });
    setErrors({});
    setStep(1);
    setLinePanelOpen(false);
    setLineStep(0);
    setEditingIndex(null);
    setLineDraft(initialLine);
  }

  function closeLinePanel() {
    setLinePanelOpen(false);
    setLineStep(0);
    setEditingIndex(null);
    setLineDraft(initialLine);
    setErrors({});
  }

  function nextMainStep() {
    if (step === 0 && !validateGeneral()) return;
    if (step === 1 && lines.length === 0) {
      setErrors({ lines: "Ajoutez au moins une configuration de fil pour créer votre demande." });
      return;
    }
    if (step === 1) {
      const incompleteIndex = lines.findIndex((line) => Object.keys(validateFullLine(line)).length);
      if (incompleteIndex >= 0) {
        setErrors({ lines: `La ligne ${incompleteIndex + 1} est incomplète.` });
        return;
      }
    }
    setErrors({});
    setStep((prev) => Math.min(prev + 1, requestSteps.length - 1));
  }

  function goToMainStep(index) {
    if (index === 0) {
      setErrors({});
      setStep(0);
      return;
    }
    if (index === 1) {
      if (!validateGeneral()) return;
      setErrors({});
      setStep(1);
      return;
    }
    if (index === 2) {
      if (!validateGeneral()) {
        setStep(0);
        return;
      }
      const incompleteIndex = lines.findIndex((line) => Object.keys(validateFullLine(line)).length);
      if (!lines.length || incompleteIndex >= 0) {
        setErrors({ lines: !lines.length ? "Ajoutez au moins une configuration de fil pour créer votre demande." : `La ligne ${incompleteIndex + 1} est incomplète.` });
        setStep(1);
        return;
      }
      setErrors({});
      setStep(2);
    }
  }

  function previousMainStep() {
    setErrors({});
    setStep((prev) => Math.max(prev - 1, 0));
  }

  function nextLineStep() {
    if (!validateLine(lineStep)) return;
    setErrors({});
    setLineStep((prev) => Math.min(prev + 1, lineSteps.length - 1));
  }

  function previousLineStep() {
    setErrors({});
    setLineStep((prev) => Math.max(prev - 1, 0));
  }

  async function submit(event) {
    event.preventDefault();
    if (!validateGeneral()) {
      setStep(0);
      return;
    }
    if (!lines.length) {
      setErrors({ lines: "Ajoutez au moins une configuration de fil pour créer votre demande." });
      setStep(1);
      return;
    }
    const incompleteIndex = lines.findIndex((line) => Object.keys(validateFullLine(line)).length);
    if (incompleteIndex >= 0) {
      setErrors({ lines: `La ligne ${incompleteIndex + 1} est incomplète.` });
      setStep(1);
      return;
    }

    try {
      setLoading(true);
      setSuccess("");
      const payload = { ...request, status: "submitted", lines };
      await api(draftOrderId ? `/api/client/orders/${draftOrderId}` : "/api/client/orders", {
        method: draftOrderId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      setSuccess("Votre demande de commande a bien été transmise à Toulemonde Production.");
      setTimeout(() => navigate("/client/orders"), 800);
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function saveDraft() {
    try {
      setLoading(true);
      setSuccess("");
      setErrors({});
      const draftLines = getDraftLinesForSave();
      const payload = { ...request, status: "draft", lines: draftLines };
      const data = await api(draftOrderId ? `/api/client/orders/${draftOrderId}` : "/api/client/orders", {
        method: draftOrderId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      setLines(draftLines);
      if (linePanelOpen) {
        setLinePanelOpen(false);
        setLineStep(0);
        setEditingIndex(null);
        setLineDraft(initialLine);
      }
      const nextId = data.order?.id || draftOrderId;
      if (nextId) {
        setDraftOrderId(String(nextId));
        if (!draftId) navigate(`/client/orders/new?draftId=${nextId}`, { replace: true });
      }
      setSuccess("Votre demande a été enregistrée en brouillon.");
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setLoading(false);
    }
  }

  function getDraftLinesForSave() {
    if (!linePanelOpen) return lines;
    if (editingIndex !== null) {
      return lines.map((line, index) => (index === editingIndex ? lineDraft : line));
    }
    return hasLineContent(lineDraft) ? [...lines, lineDraft] : lines;
  }

  const quickSummary = [
    ["Référence", request.customer_reference],
    ["Lignes", `${lines.length}`],
    ["Quantité totale", totalQuantity ? `${totalQuantity} kg` : ""],
    ["Date souhaitée", request.requested_delivery_date],
    ["Urgence", request.urgent ? "Oui" : "Non"],
  ];

  if (!flowType) {
    return (
      <PageContainer>
        <PageHeader
          kicker="Portail client"
          title="Nouvelle demande de commande"
          subtitle="Choisissez le type de demande que vous souhaitez créer."
        />
        <section style={local.choiceGrid}>
          <ChoiceCard
            icon={Factory}
            title="Demande industrielle"
            text="Configurez une demande technique de fil sur mesure avec une ou plusieurs lignes."
            buttonLabel="Créer une demande industrielle"
            onClick={() => {
              setFlowType("technical");
              navigate("/client/orders/new?type=technical", { replace: true });
            }}
          />
          <ChoiceCard
            icon={ShoppingBag}
            title="Mercerie"
            text="Commandez des articles standards depuis le catalogue."
            buttonLabel="Commander en mercerie"
            onClick={() => navigate("/client/mercerie")}
          />
        </section>
      </PageContainer>
    );
  }

  return (
    <PageContainer as="form" onSubmit={submit}>
      <PageHeader
        kicker="Portail client"
        title="Nouvelle demande de commande"
        subtitle="Composez une demande globale avec une ou plusieurs configurations de fils spécifiques."
      />
      {!draftLoaded && <div style={styles.cardWide}>Chargement du brouillon...</div>}
      {draftOrderId && draftLoaded && <div style={local.draftNotice}>Brouillon en cours</div>}

      {draftLoaded && <div style={{ ...local.orderLayout, ...(isMobile ? local.orderLayoutMobile : {}) }}>
        <section style={styles.wizardShell}>
          <div style={{ ...styles.wizardHeader, ...(isMobile ? styles.wizardHeaderMobile : {}) }}>
            <div>
              <div style={styles.overline}>Demande filature B2B</div>
              <h2 style={styles.cardTitle}>{requestSteps[step]}</h2>
            </div>
            <img src={step === 1 && linePanelOpen && lineStep > 1 ? atelierMatiere : atelierBobines} alt="" style={styles.wizardImage} />
          </div>

          <div style={local.stepperWrap}>
            <Stepper labels={requestSteps} step={step} onSelect={goToMainStep} />
          </div>

          {step === 0 && (
            <GeneralStep
              request={request}
              update={updateRequest}
              errors={errors}
              profileAddress={profileAddress}
            />
          )}

          {step === 1 && (
            <LinesStep
              lines={lines}
              errors={errors}
              onAdd={startAddLine}
              onViewDetail={(index) => setDetailLineIndex(index)}
              onEdit={startEditLine}
              onDuplicate={duplicateLine}
              onRemove={removeLine}
            />
          )}

          {step === 2 && (
            <GlobalSummary
              request={request}
              lines={lines}
              totalQuantity={totalQuantity}
              profileAddress={profileAddress}
              onViewDetail={(index) => setDetailLineIndex(index)}
            />
          )}

          {errors.submit && <div style={styles.error}>{errors.submit}</div>}
          {success && <div style={styles.success}>{success}</div>}

          <div style={styles.formActions}>
            {step > 0 ? <button type="button" style={styles.ghostButton} onClick={previousMainStep}>Retour</button> : <span />}
            <div style={local.actionGroup}>
              {step === 1 && <button type="button" style={styles.ghostButton} onClick={startAddLine}>Ajouter un fil</button>}
              {step < requestSteps.length - 1 ? (
                <>
                  <button type="button" style={styles.ghostButton} disabled={loading} onClick={saveDraft}>Enregistrer en brouillon</button>
                  <button type="button" style={styles.primaryButton} onClick={nextMainStep}>Continuer</button>
                </>
              ) : (
                <>
                  <button type="button" style={styles.ghostButton} onClick={startAddLine}>Ajouter un autre fil</button>
                  <button type="button" style={styles.ghostButton} disabled={loading} onClick={saveDraft}>Enregistrer en brouillon</button>
                  <button style={styles.primaryButton} disabled={loading}>{loading ? "Envoi..." : "Soumettre la demande"}</button>
                </>
              )}
            </div>
          </div>
        </section>

        <aside style={local.quickSummary}>
          <div style={styles.overline}>Résumé de la demande</div>
          {quickSummary.map(([label, value]) => (
            <div key={label} style={local.quickSummaryRow}>
              <span style={styles.label}>{label}</span>
              <strong>{value || "—"}</strong>
            </div>
          ))}
          <div style={local.linesMiniList}>
            {lines.slice(0, 4).map((line, index) => (
              <div key={`${line.material_family}-${index}`} style={local.miniLine}>
                <strong>Ligne {index + 1}</strong>
                <span>{lineTitle(line)}</span>
              </div>
            ))}
            {lines.length > 4 && <div style={styles.helpText}>+ {lines.length - 4} autre(s) configuration(s)</div>}
          </div>
        </aside>
      </div>}

      {linePanelOpen && (
        <LineConfiguratorPanel
          lineStep={lineStep}
          lineDraft={lineDraft}
          update={updateLine}
          errors={errors}
          editingIndex={editingIndex}
          onClose={closeLinePanel}
          onPrevious={previousLineStep}
          onNext={nextLineStep}
          onSave={saveLine}
        />
      )}

      {detailLineIndex !== null && lines[detailLineIndex] && (
        <LineDetailModal
          line={lines[detailLineIndex]}
          index={detailLineIndex}
          onClose={() => setDetailLineIndex(null)}
        />
      )}
    </PageContainer>
  );
}

function ChoiceCard({ icon: Icon, title, text, buttonLabel, onClick }) {
  return (
    <article style={local.choiceCard}>
      <div style={local.choiceIcon}><Icon size={28} /></div>
      <div>
        <h2 style={local.choiceTitle}>{title}</h2>
        <p style={local.choiceText}>{text}</p>
      </div>
      <button type="button" style={local.choiceButton} onClick={onClick}>{buttonLabel}</button>
    </article>
  );
}

function GeneralStep({ request, update, errors, profileAddress }) {
  return (
    <StepCard title="Informations générales" subtitle="Ces informations s’appliquent à l’ensemble de la demande.">
      <div style={styles.formGrid}>
        <Field label="Référence client" error={errors.customer_reference}>
          <input style={styles.input} value={request.customer_reference} onChange={(event) => update("customer_reference", event.target.value)} placeholder="Votre référence interne" />
        </Field>
        <Field label="Date de livraison souhaitée" error={errors.requested_delivery_date}>
          <input style={styles.input} type="date" value={request.requested_delivery_date} onChange={(event) => update("requested_delivery_date", event.target.value)} />
        </Field>
        <Field label="Adresse de livraison">
          <Select value={request.delivery_address_choice} onChange={(value) => update("delivery_address_choice", value)} options={["profile", "specific"]} />
        </Field>
        <label style={styles.checkLine}>
          <input type="checkbox" checked={request.urgent} onChange={(event) => update("urgent", event.target.checked)} /> Demande urgente
        </label>
        {request.delivery_address_choice === "specific" ? (
          <Field label="Adresse spécifique" error={errors.delivery_address}>
            <textarea style={styles.textarea} value={request.delivery_address} onChange={(event) => update("delivery_address", event.target.value)} />
          </Field>
        ) : (
          <div style={local.helpBox}>Adresse profil : {profileAddress || "Aucune adresse de livraison renseignée dans le profil."}</div>
        )}
        <Field label="Commentaire général">
          <textarea style={styles.textarea} value={request.general_comment} onChange={(event) => update("general_comment", event.target.value)} placeholder="Précisions valables pour toute la demande" />
        </Field>
      </div>
    </StepCard>
  );
}

function LinesStep({ lines, errors, onAdd, onViewDetail, onEdit, onDuplicate, onRemove }) {
  return (
    <StepCard title="Configurations de fils" subtitle="Ajoutez une ligne de demande pour chaque fil spécifique.">
      {!lines.length ? (
        <div style={local.emptyLines}>
          <h3 style={local.stepTitleSmall}>Aucune configuration fil ajoutée</h3>
          <p style={styles.muted}>Ajoutez au moins une configuration de fil pour créer votre demande.</p>
          <button type="button" style={styles.primaryButton} onClick={onAdd}>Ajouter un fil</button>
        </div>
      ) : (
        <div style={local.linesList}>
          {lines.map((line, index) => (
            <LineCard
              key={`${line.material_family}-${line.quantity_kg}-${index}`}
              index={index}
              line={line}
              onViewDetail={() => onViewDetail(index)}
              onEdit={() => onEdit(index)}
              onDuplicate={() => onDuplicate(index)}
              onRemove={() => onRemove(index)}
            />
          ))}
        </div>
      )}
      {errors.lines && <div style={styles.inlineError}>{errors.lines}</div>}
    </StepCard>
  );
}

function LineConfiguratorPanel({ lineStep, lineDraft, update, errors, editingIndex, onClose, onPrevious, onNext, onSave }) {
  return (
    <div style={local.modalOverlay} onClick={onClose}>
      <section style={local.linePanel} onClick={(event) => event.stopPropagation()}>
        <div style={local.modalHeader}>
          <div>
            <div style={styles.overline}>Configuration fil</div>
            <h3 style={local.stepTitle}>{editingIndex === null ? "Nouvelle configuration fil" : `Modifier la ligne ${editingIndex + 1}`}</h3>
            <p style={local.stepSubtitle}>Configurez cette ligne de demande avec un mini-parcours dédié.</p>
          </div>
          <button type="button" style={local.closeButton} onClick={onClose}>×</button>
        </div>

        <div style={local.stepperWrap}>
          <Stepper labels={lineSteps} step={lineStep} onSelect={() => {}} compact />
        </div>

        <div style={local.panelBody}>
          {lineStep === 0 && <ApplicationStep form={lineDraft} update={update} errors={errors} />}
          {lineStep === 1 && <MaterialStep form={lineDraft} update={update} errors={errors} />}
          {lineStep === 2 && <ConstructionStep form={lineDraft} update={update} errors={errors} />}
          {lineStep === 3 && <ColorStep form={lineDraft} update={update} />}
          {lineStep === 4 && <PackagingStep form={lineDraft} update={update} errors={errors} />}
        </div>

        <div style={styles.formActions}>
          <button type="button" style={styles.ghostButton} onClick={lineStep > 0 ? onPrevious : onClose}>Retour</button>
          {lineStep < lineSteps.length - 1 ? (
            <button type="button" style={styles.primaryButton} onClick={onNext}>Continuer</button>
          ) : (
            <button type="button" style={styles.primaryButton} onClick={onSave}>
              {editingIndex === null ? "Ajouter ce fil" : "Enregistrer la ligne"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function ApplicationStep({ form, update, errors }) {
  return (
    <div style={local.cardGrid}>
      {applicationOptions.map(([title, description]) => (
        <SelectableCard
          key={title}
          title={title}
          description={description}
          selected={form.application_type === title}
          onClick={() => update("application_type", title)}
        />
      ))}
      {errors.application_type && <div style={styles.inlineError}>{errors.application_type}</div>}
    </div>
  );
}

function MaterialStep({ form, update, errors }) {
  const families = Object.keys(materialQualities);
  return (
    <div style={local.innerStack}>
      <div style={local.pillGrid}>
        {families.map((family) => (
          <button
            key={family}
            type="button"
            style={{ ...local.pill, ...(form.material_family === family ? local.pillSelected : {}) }}
            onClick={() => update("material_family", family)}
          >
            {family}
          </button>
        ))}
      </div>
      {errors.material_family && <div style={styles.inlineError}>{errors.material_family}</div>}
      {form.material_family && <div style={local.helpBox}>{materialHelp[form.material_family]}</div>}
      <Field label="Qualité matière">
        <Select value={form.material_quality} onChange={(value) => update("material_quality", value)} options={["", ...(materialQualities[form.material_family] || [])]} />
      </Field>
    </div>
  );
}

function ConstructionStep({ form, update, errors }) {
  const showCustomNm = form.count_system === "Nm" && form.yarn_count_nm === "Autre";
  return (
    <div style={local.twoBlocks}>
      <div style={local.miniBlock}>
        <h3 style={local.miniBlockTitle}>Titrage</h3>
        <Field label="Système de titrage" error={errors.count_system}>
          <Select value={form.count_system} onChange={(value) => update("count_system", value)} options={["Nm", "dtex", "numéro spécial / autre"]} />
        </Field>
        {form.count_system === "Nm" && (
          <>
            <Field label="Titre Nm" error={errors.yarn_count_nm}><Select value={form.yarn_count_nm} onChange={(value) => update("yarn_count_nm", value)} options={countOptions} /></Field>
            {showCustomNm && <Field label="Titre Nm spécifique" error={errors.custom_count}><input style={styles.input} value={form.custom_count} onChange={(event) => update("custom_count", event.target.value)} /></Field>}
          </>
        )}
        {form.count_system === "dtex" && <Field label="dtex" error={errors.dtex}><input style={styles.input} value={form.dtex} onChange={(event) => update("dtex", event.target.value)} /></Field>}
        {form.count_system === "numéro spécial / autre" && <Field label="Titrage spécifique" error={errors.custom_count}><input style={styles.input} value={form.custom_count} onChange={(event) => update("custom_count", event.target.value)} /></Field>}
      </div>

      <div style={local.miniBlock}>
        <h3 style={local.miniBlockTitle}>Retordage & finition</h3>
        <Field label="Nombre de bouts" error={errors.ply_number}><Select value={form.ply_number} onChange={(value) => update("ply_number", value)} options={["1", "2", "3", "4", "5", "6", "Autre"]} /></Field>
        <Field label="Type de retordage"><Select value={form.twist_type} onChange={(value) => update("twist_type", value)} options={["Simple", "Retordu", "Câblé", "Texturé", "Guipé", "Spécifique"]} /></Field>
        <Field label="Sens de torsion"><Select value={form.twist_direction} onChange={(value) => update("twist_direction", value)} options={["S", "Z", "S/Z", "Non précisé"]} /></Field>
        <Field label="Finition"><Select value={form.finish} onChange={(value) => update("finish", value)} options={["Aucun", "Gazé", "Mercerisé", "Gazé mercerisé", "Glacé", "Non glacé", "Lubrifié", "Spécifique"]} /></Field>
      </div>
    </div>
  );
}

function ColorStep({ form, update }) {
  const needsReference = ["Référence client", "Pantone / RAL"].includes(form.color_mode);
  return (
    <div style={styles.formGrid}>
      <Field label="Mode couleur"><Select value={form.color_mode} onChange={(value) => update("color_mode", value)} options={["Écru", "Blanc", "Noir", "Couleur standard", "Référence client", "Pantone / RAL", "Teinture sur demande"]} /></Field>
      <Field label="Nom couleur"><input style={styles.input} value={form.color_name} onChange={(event) => update("color_name", event.target.value)} placeholder="Ex. naturel, marine, rouge..." /></Field>
      {needsReference && <Field label="Référence couleur"><input style={styles.input} value={form.color_reference} onChange={(event) => update("color_reference", event.target.value)} /></Field>}
      <label style={styles.checkLine}><input type="checkbox" checked={form.dyeing_required} onChange={(event) => update("dyeing_required", event.target.checked)} /> Teinture requise</label>
      <Field label="Commentaire teinture"><textarea style={styles.textarea} value={form.dyeing_comment} onChange={(event) => update("dyeing_comment", event.target.value)} /></Field>
    </div>
  );
}

function PackagingStep({ form, update, errors }) {
  return (
    <div style={styles.formGrid}>
      <Field label="Conditionnement" error={errors.packaging}><Select value={form.packaging} onChange={(value) => update("packaging", value)} options={packagingOptions} /></Field>
      <Field label="Quantité kg" error={errors.quantity_kg}><input style={styles.input} type="number" min="0" step="0.1" value={form.quantity_kg} onChange={(event) => update("quantity_kg", event.target.value)} /></Field>
      <Field label="Métrage souhaité par support"><input style={styles.input} value={form.meterage_per_unit} onChange={(event) => update("meterage_per_unit", event.target.value)} /></Field>
      <Field label="Tolérance %"><input style={styles.input} type="number" value={form.tolerance_percent} onChange={(event) => update("tolerance_percent", event.target.value)} /></Field>
      <label style={styles.checkLine}><input type="checkbox" checked={form.partial_delivery_allowed} onChange={(event) => update("partial_delivery_allowed", event.target.checked)} /> Livraison partielle autorisée pour cette ligne</label>
      <Field label="Commentaire production"><textarea style={styles.textarea} value={form.production_comment} onChange={(event) => update("production_comment", event.target.value)} /></Field>
    </div>
  );
}

function GlobalSummary({ request, lines, totalQuantity, profileAddress, onViewDetail }) {
  return (
    <div style={local.summarySections}>
      <section style={local.summarySection}>
        <h3 style={local.miniBlockTitle}>Informations générales</h3>
        <div style={styles.summaryGrid}>
          <SummaryItem label="Référence client" value={request.customer_reference} />
          <SummaryItem label="Date souhaitée" value={request.requested_delivery_date} />
          <SummaryItem label="Adresse" value={request.delivery_address_choice === "specific" ? request.delivery_address : profileAddress || "Adresse du profil"} />
          <SummaryItem label="Urgence" value={request.urgent ? "Oui" : "Non"} />
          <SummaryItem label="Commentaire" value={request.general_comment} />
          <SummaryItem label="Nombre de lignes" value={lines.length} />
          <SummaryItem label="Quantité totale" value={totalQuantity ? `${totalQuantity} kg` : ""} />
        </div>
      </section>

      <section style={local.summarySection}>
        <h3 style={local.miniBlockTitle}>Lignes de demande</h3>
        <div style={local.linesList}>
          {lines.map((line, index) => (
            <LineSummary
              key={`${line.material_family}-${index}`}
              line={line}
              index={index}
              onViewDetail={() => onViewDetail(index)}
            />
          ))}
        </div>
      </section>

      <section style={local.totalBox}>
        <strong>{lines.length} ligne(s) de demande</strong>
        <span>{totalQuantity || 0} kg au total</span>
      </section>
    </div>
  );
}

function LineCard({ line, index, onViewDetail, onEdit, onDuplicate, onRemove }) {
  const complete = Object.keys(validateLineForBadge(line)).length === 0;
  return (
    <div style={local.lineCard}>
      <div>
        <h3 style={local.lineTitle}>Ligne {index + 1} — {lineTitle(line)}</h3>
        <p style={local.lineSubtitle}>{lineSubtitle(line)}</p>
        <div style={local.metricBadges}>
          {line.quantity_kg && <span style={local.metricBadge}>{line.quantity_kg} kg</span>}
          {line.ply_number && <span style={local.metricBadge}>{line.ply_number} plis</span>}
          {line.finish && line.finish !== "Aucun" && <span style={local.metricBadge}>{line.finish}</span>}
          <span style={local.metricBadge}>{line.dyeing_required ? "Teinture" : "Sans teinture"}</span>
        </div>
      </div>
      <span style={{ ...local.lineBadge, ...(complete ? local.lineBadgeComplete : local.lineBadgeMissing) }}>{complete ? "Complète" : "À compléter"}</span>
      <div style={local.lineActions}>
        <button type="button" style={styles.linkButton} onClick={onViewDetail}>Voir détail</button>
        <button type="button" style={styles.linkButton} onClick={onEdit}>Modifier</button>
        <button type="button" style={styles.linkButton} onClick={onDuplicate}>Dupliquer</button>
        <button type="button" style={styles.linkButton} onClick={onRemove}>Supprimer</button>
      </div>
    </div>
  );
}

function LineSummary({ line, index, onViewDetail }) {
  const rows = [
    ["Matière", line.material_family],
    ["Titrage", countLabel(line)],
    ["Application", line.application_type],
    ["Couleur", colorLabel(line)],
    ["Conditionnement", line.packaging],
    ["Quantité", line.quantity_kg ? `${line.quantity_kg} kg` : ""],
  ];
  return (
    <div style={local.summaryLine}>
      <div style={local.summaryLineHeader}>
        <h4 style={local.lineTitle}>Ligne {index + 1} — {lineTitle(line)}</h4>
        <button type="button" style={styles.linkButton} onClick={onViewDetail}>Voir détail</button>
      </div>
      <div style={styles.summaryGrid}>
        {rows.map(([label, value]) => <SummaryItem key={`${index}-${label}`} label={label} value={value} />)}
      </div>
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div style={styles.summaryItem}>
      <div style={styles.label}>{label}</div>
      <div>{value || "—"}</div>
    </div>
  );
}

function LineDetailModal({ line, index, onClose }) {
  const sections = [
    ["Application", [["Application", line.application_type]]],
    ["Matière", [["Famille", line.material_family], ["Qualité", line.material_quality]]],
    ["Construction du fil", [
      ["Système", line.count_system],
      ["Titre Nm", line.yarn_count_nm],
      ["dtex", line.dtex],
      ["Titrage spécifique", line.custom_count],
      ["Nombre de plis", line.ply_number],
      ["Retordage", line.twist_type],
      ["Sens", line.twist_direction],
      ["Finition", line.finish],
    ]],
    ["Couleur & teinture", [
      ["Mode couleur", line.color_mode],
      ["Nom couleur", line.color_name],
      ["Référence couleur", line.color_reference],
      ["Teinture requise", line.dyeing_required ? "Oui" : "Non"],
      ["Commentaire teinture", line.dyeing_comment],
    ]],
    ["Conditionnement & quantité", [
      ["Conditionnement", line.packaging],
      ["Quantité", line.quantity_kg ? `${line.quantity_kg} kg` : ""],
      ["Métrage/support", line.meterage_per_unit],
      ["Tolérance", line.tolerance_percent !== undefined && line.tolerance_percent !== null ? `${line.tolerance_percent}%` : ""],
      ["Livraison partielle", line.partial_delivery_allowed ? "Oui" : "Non"],
    ]],
    ["Commentaires", [["Commentaire production", line.production_comment]]],
  ];

  return (
    <div style={local.modalOverlay} onClick={onClose}>
      <section style={local.detailModal} onClick={(event) => event.stopPropagation()}>
        <div style={local.modalHeader}>
          <div>
            <div style={styles.overline}>Détail ligne de demande</div>
            <h3 style={local.stepTitle}>Ligne {index + 1} — {lineTitle(line)}</h3>
          </div>
          <button type="button" style={local.closeButton} onClick={onClose}>×</button>
        </div>
        <div style={local.detailSections}>
          {sections.map(([title, rows]) => (
            <section key={title} style={local.detailSection}>
              <h4 style={local.miniBlockTitle}>{title}</h4>
              <div style={styles.summaryGrid}>
                {rows.map(([label, value]) => <SummaryItem key={`${title}-${label}`} label={label} value={value} />)}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stepper({ labels, step, onSelect, compact = false }) {
  return (
    <div style={local.stepper}>
      {labels.map((label, index) => {
        const active = index === step;
        const done = index < step;
        return (
          <button
            key={label}
            type="button"
            style={{ ...local.stepButton, ...(compact ? local.stepButtonCompact : {}), ...(active ? local.stepButtonActive : {}), ...(done ? local.stepButtonDone : {}) }}
            onClick={() => onSelect(index)}
          >
            <span style={local.stepIndex}>{done ? "✓" : String(index + 1).padStart(2, "0")}</span>
            {label}
          </button>
        );
      })}
    </div>
  );
}

function StepCard({ title, subtitle, children }) {
  return (
    <div style={local.stepCard}>
      <div>
        <h3 style={local.stepTitle}>{title}</h3>
        <p style={local.stepSubtitle}>{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function SelectableCard({ title, description, selected, onClick }) {
  return (
    <button type="button" style={{ ...local.selectableCard, ...(selected ? local.selectableCardSelected : {}) }} onClick={onClick}>
      <strong>{title}</strong>
      <span>{description}</span>
    </button>
  );
}

function validateLineForBadge(line) {
  const missing = {};
  if (!line.application_type) missing.application_type = true;
  if (!line.material_family) missing.material_family = true;
  if (!line.count_system) missing.count_system = true;
  if (line.count_system === "Nm" && !line.yarn_count_nm) missing.yarn_count_nm = true;
  if (line.count_system === "Nm" && line.yarn_count_nm === "Autre" && !line.custom_count) missing.custom_count = true;
  if (line.count_system === "dtex" && !line.dtex) missing.dtex = true;
  if (line.count_system === "numéro spécial / autre" && !line.custom_count) missing.custom_count = true;
  if (!line.ply_number) missing.ply_number = true;
  if (!line.packaging) missing.packaging = true;
  if (!line.quantity_kg || Number(line.quantity_kg) <= 0) missing.quantity_kg = true;
  return missing;
}

function hasLineContent(line) {
  return Boolean(
    line.application_type ||
    line.material_family ||
    line.material_quality ||
    line.yarn_count_nm ||
    line.dtex ||
    line.custom_count ||
    line.color_name ||
    line.color_reference ||
    line.packaging ||
    line.quantity_kg ||
    line.dyeing_comment ||
    line.production_comment
  );
}

function countLabel(line) {
  if (line.count_system === "dtex") return line.dtex ? `${line.dtex} dtex` : "";
  if (line.count_system === "numéro spécial / autre") return line.custom_count;
  if (line.yarn_count_nm === "Autre") return line.custom_count;
  return line.yarn_count_nm;
}

function colorLabel(line) {
  return [line.color_mode, line.color_name, line.color_reference].filter(Boolean).join(" - ");
}

function lineTitle(line) {
  const count = countLabel(line);
  if (!line.material_family || !count) return "Configuration fil incomplète";
  return [line.material_family, count].filter(Boolean).join(" - ");
}

function lineSubtitle(line) {
  return [
    line.application_type,
    colorLabel(line),
    line.packaging,
  ].filter(Boolean).join(" · ") || "Configuration à préciser";
}

const local = {
  choiceGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, alignItems: "stretch" },
  choiceCard: { background: "#fff", border: `1px solid ${T.border}`, borderRadius: 24, padding: 24, display: "grid", gridTemplateRows: "auto minmax(112px, 1fr) auto", gap: 18, alignContent: "stretch", boxShadow: T.shadowSoft, minWidth: 0 },
  choiceIcon: { width: 62, height: 62, borderRadius: 18, display: "grid", placeItems: "center", background: T.bleuPale, color: T.bleu, border: `1px solid ${T.bleuBorder}` },
  choiceTitle: { margin: 0, fontFamily: T.fontTitle, fontSize: 26, fontWeight: 900, letterSpacing: "-0.03em", color: T.noir },
  choiceText: { margin: "8px 0 0", color: T.textSoft, lineHeight: 1.55, maxWidth: 520 },
  choiceButton: { ...styles.primaryButton, width: "100%", alignSelf: "end" },
  orderLayout: { width: "100%", maxWidth: "100%", minWidth: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 320px)", gap: 24, alignItems: "start", boxSizing: "border-box" },
  orderLayoutMobile: { gridTemplateColumns: "1fr" },
  draftNotice: { justifySelf: "start", border: `1px solid ${T.bleuBorder}`, background: T.bleuPale, color: T.bleu, borderRadius: 999, padding: "8px 12px", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.10em" },
  quickSummary: { position: "sticky", top: 104, width: "100%", minWidth: 0, boxSizing: "border-box", background: "#fff", border: `1px solid ${T.border}`, borderRadius: T.cardRadius, padding: 18, display: "grid", gap: 14, boxShadow: T.shadowSoft },
  quickSummaryRow: { display: "grid", gap: 4, paddingBottom: 12, borderBottom: `1px solid ${T.border}` },
  linesMiniList: { display: "grid", gap: 10 },
  miniLine: { display: "grid", gap: 3, padding: 10, background: T.ecru, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 13 },
  actionGroup: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flexWrap: "wrap", marginLeft: "auto" },
  stepperWrap: { width: "100%", maxWidth: "100%", overflowX: "auto", overflowY: "hidden", paddingBottom: 6, boxSizing: "border-box" },
  stepper: { display: "flex", gap: 10, minWidth: "max-content" },
  stepButton: { flex: "0 0 auto", border: `1px solid ${T.border}`, background: "#fff", color: T.noir, borderRadius: 999, padding: "10px 13px", cursor: "pointer", fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" },
  stepButtonCompact: { padding: "8px 11px", fontSize: 10 },
  stepButtonActive: { background: T.bleu, borderColor: T.bleu, color: "#fff" },
  stepButtonDone: { borderColor: T.bleuBorder, color: T.bleu, background: T.bleuPale },
  stepIndex: { fontSize: 10, opacity: 0.8 },
  stepCard: { width: "100%", minWidth: 0, boxSizing: "border-box", overflow: "hidden", background: "#fff", border: `1px solid ${T.border}`, borderRadius: 18, padding: 18, display: "grid", gap: 18 },
  stepTitle: { margin: 0, fontFamily: T.fontTitle, fontSize: 24, lineHeight: 1.05, fontWeight: 800, letterSpacing: "-0.03em", color: T.noir },
  stepTitleSmall: { margin: 0, fontFamily: T.fontTitle, fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: T.noir },
  stepSubtitle: { margin: "6px 0 0", color: T.textSoft, lineHeight: 1.5, fontSize: 14 },
  innerStack: { display: "grid", gap: 14 },
  cardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 },
  selectableCard: { minWidth: 0, boxSizing: "border-box", minHeight: 118, border: `1px solid ${T.border}`, background: "#fff", borderRadius: 14, padding: 16, cursor: "pointer", display: "grid", gap: 8, textAlign: "left", color: T.noir, boxShadow: "0 8px 20px rgba(0,0,0,0.035)" },
  selectableCardSelected: { borderColor: T.bleu, boxShadow: "0 0 0 2px rgba(0,0,254,0.10)" },
  pillGrid: { display: "flex", flexWrap: "wrap", gap: 10 },
  pill: { border: `1px solid ${T.border}`, background: "#fff", borderRadius: 999, padding: "10px 13px", cursor: "pointer", fontWeight: 800 },
  pillSelected: { borderColor: T.bleu, color: T.bleu, background: T.bleuPale },
  helpBox: { background: T.ecru, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, color: T.textSoft, lineHeight: 1.5, gridColumn: "1 / -1" },
  twoBlocks: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 14 },
  miniBlock: { background: T.ecru, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, display: "grid", gap: 12 },
  miniBlockTitle: { margin: 0, fontFamily: T.fontTitle, fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: T.noir },
  linesList: { display: "grid", gap: 12 },
  emptyLines: { border: `1px dashed ${T.borderMid}`, background: T.ecru, borderRadius: 16, padding: 22, display: "grid", gap: 12, justifyItems: "start" },
  lineCard: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "center", background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, boxShadow: "0 8px 20px rgba(0,0,0,0.035)" },
  lineTitle: { margin: 0, fontFamily: T.fontTitle, fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: T.noir },
  lineSubtitle: { margin: "5px 0 0", color: T.textSoft, fontSize: 13, lineHeight: 1.45 },
  metricBadges: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 11 },
  metricBadge: { border: `1px solid ${T.border}`, background: T.ecru, borderRadius: 999, padding: "6px 9px", fontSize: 11, fontWeight: 800, color: T.noir },
  lineBadge: { justifySelf: "end", borderRadius: 999, padding: "7px 10px", fontSize: 10, fontWeight: 900, letterSpacing: "0.10em", textTransform: "uppercase", whiteSpace: "nowrap" },
  lineBadgeComplete: { color: T.bleu, background: T.bleuPale, border: `1px solid ${T.bleuBorder}` },
  lineBadgeMissing: { color: T.textSoft, background: T.ecru, border: `1px solid ${T.border}` },
  lineActions: { gridColumn: "1 / -1", display: "flex", gap: 12, flexWrap: "wrap" },
  textButton: { justifySelf: "start", border: "none", background: "transparent", padding: 0, color: T.bleu, cursor: "pointer", fontWeight: 800 },
  summarySections: { display: "grid", gap: 14 },
  summarySection: { display: "grid", gap: 12 },
  summaryLine: { display: "grid", gap: 12, background: T.ecru, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 },
  summaryLineHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  totalBox: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: T.bleuPale, border: `1px solid ${T.bleuBorder}`, borderRadius: 14, padding: 16, color: T.noir, flexWrap: "wrap" },
  modalOverlay: { position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.34)", display: "grid", placeItems: "center", padding: 18, boxSizing: "border-box" },
  linePanel: { width: "min(920px, 100%)", maxHeight: "92vh", overflowY: "auto", background: "#fff", border: `1px solid ${T.border}`, borderRadius: 22, boxShadow: T.shadowModal, padding: 22, display: "grid", gap: 18, boxSizing: "border-box" },
  detailModal: { width: "min(980px, 100%)", maxHeight: "92vh", overflowY: "auto", background: "#fff", border: `1px solid ${T.border}`, borderRadius: 22, boxShadow: T.shadowModal, padding: 22, display: "grid", gap: 18, boxSizing: "border-box" },
  modalHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18, borderBottom: `1px solid ${T.border}`, paddingBottom: 16 },
  closeButton: { width: 42, height: 42, borderRadius: 999, border: `1px solid ${T.border}`, background: "#fff", cursor: "pointer", fontSize: 24, lineHeight: 1, color: T.noir },
  panelBody: { display: "grid", gap: 16 },
  detailSections: { display: "grid", gap: 14 },
  detailSection: { display: "grid", gap: 12, background: T.ecru, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 },
};

export default NewYarnOrder;
