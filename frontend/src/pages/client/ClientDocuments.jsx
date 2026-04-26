import Placeholder from "../../components/Placeholder";
import PageHeader from "../../components/PageHeader";
import { styles } from "../../styles";

export default function ClientDocuments() {
  return (
    <div style={styles.pageStack}>
      <PageHeader
        kicker="Portail client"
        title="Documents"
        subtitle="Accédez aux documents associés à vos productions."
      />
      <Placeholder title="Documents" />
    </div>
  );
}
