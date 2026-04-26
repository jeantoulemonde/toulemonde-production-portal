import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader";
import PageContainer from "../../components/PageContainer";
import SimpleTable from "../../components/SimpleTable";
import { api } from "../../api/api";
import { styles } from "../../styles";

export default function ClientDocuments() {
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/client/documents")
      .then(setDocuments)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <PageContainer>
      <PageHeader
        kicker="Portail client"
        title="Documents"
        subtitle="Accédez aux documents associés à vos productions."
      />
      {error && <div style={styles.error}>{error}</div>}
      <section style={styles.cardWide}>
        <h2 style={styles.cardTitle}>Documents disponibles</h2>
        <SimpleTable
          columns={["order_number", "client_reference", "document_type", "filename", "created_at"]}
          rows={documents}
        />
      </section>
    </PageContainer>
  );
}
