import { styles } from "../styles";

function ProfileSection({ title, description, children }) {
  return (
    <section style={styles.profileSection}>
      <div style={styles.profileSectionHeader}>
        <h2 style={styles.profileSectionTitle}>{title}</h2>
        {description && <p style={styles.profileSectionText}>{description}</p>}
      </div>

      <div style={styles.profileFormGrid}>{children}</div>
    </section>
  );
}

function ProfileInput({ label, value, onChange, full = false }) {
  return (
    <label style={{ ...styles.profileField, ...(full ? styles.profileFieldFull : {}) }}>
      <span style={styles.profileLabel}>{label}</span>
      <input
        style={styles.profileInput}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
      />
    </label>
  );
}

export { ProfileInput };
export default ProfileSection;
