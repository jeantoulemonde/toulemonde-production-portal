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

export default ProfileSection;
