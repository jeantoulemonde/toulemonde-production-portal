import Placeholder from "../../components/Placeholder";
import PageHeader from "../../components/PageHeader";
import PageContainer from "../../components/PageContainer";

export default function ClientContact() {
  return (
    <PageContainer>
      <PageHeader
        kicker="Portail client"
        title="Contacter Toulemonde Production"
        subtitle="Envoyez une demande ou une précision technique à votre interlocuteur."
      />
      <Placeholder title="Contacter Toulemonde Production" />
    </PageContainer>
  );
}
