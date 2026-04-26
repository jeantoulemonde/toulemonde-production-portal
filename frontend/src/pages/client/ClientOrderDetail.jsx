import Placeholder from "../../components/Placeholder";
import PageHeader from "../../components/PageHeader";
import { styles } from "../../styles";

function ClientOrderDetail() {
  return (
    <div style={styles.pageStack}>
      <PageHeader
        kicker="Portail client"
        title="Détail commande"
        subtitle="Retrouvez les informations principales de votre commande."
      />
      <Placeholder title="Détail commande" />
    </div>
  );
}

export default ClientOrderDetail;
