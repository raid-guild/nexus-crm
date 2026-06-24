import { redirect } from "next/navigation";

interface LeadBoardPageProps {
  params: Promise<{
    locale: string;
  }>;
}

const LeadBoardPage = async (props: LeadBoardPageProps) => {
  const { locale } = await props.params;

  redirect(`/${locale}/crm/leads?view=board`);
};

export default LeadBoardPage;
