import Placeholder from "../../components/Placeholder";
import PageHeader from "../../components/PageHeader";
import { styles } from "../../styles";

export default function ClientContact() {
  return (
    <div style={styles.pageStack}>
      <PageHeader
        kicker="Portail client"
        title="Contacter Toulemonde Production"
        subtitle="Envoyez une demande ou une précision technique à votre interlocuteur."
      />
      <Placeholder title="Contacter Toulemonde Production" />
    </div>
  );
}
