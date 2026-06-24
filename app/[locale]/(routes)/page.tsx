import { Suspense } from "react";
import { getSession } from "@/lib/auth-server";
import {
  CoinsIcon,
  Contact,
  ListTodo,
} from "lucide-react";
import Link from "next/link";

import Container from "./components/ui/Container";
import LoadingBox from "./components/dasboard/loading-box";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { getUsersTasksCount } from "@/actions/dashboard/get-tasks-count";
import { getLeadsCount } from "@/actions/dashboard/get-leads-count";
import { getContactCount } from "@/actions/dashboard/get-contacts-count";
import { getTranslations } from "next-intl/server";

const DashboardPage = async () => {
  const session = await getSession();

  if (!session) return null;

  const userId = session?.user?.id;

  //Fetch translations from dictionary
  const dict = await getTranslations("DashboardPage");
  const [contacts, leads, usersTasks] = await Promise.all([
    getContactCount(),
    getLeadsCount(),
    getUsersTasksCount(userId),
  ]);

  return (
    <Container
      title={dict("containerTitle")}
      description={dict("containerDescription")}
    >
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          href="/crm/contacts"
          title={dict("contacts")}
          IconComponent={Contact}
          content={contacts}
        />
        <DashboardCard
          href="/crm/leads"
          title={dict("leads")}
          IconComponent={CoinsIcon}
          content={leads}
        />
        <DashboardCard
          href={`/projects/tasks/${userId}`}
          title={dict("myTasks")}
          IconComponent={ListTodo}
          content={usersTasks}
        />
      </div>
    </Container>
  );
};

export default DashboardPage;

const DashboardCard = ({
  href,
  title,
  IconComponent,
  content,
}: {
  href?: string;
  title: string;
  IconComponent: any;
  content: number;
}) => (
  <Link href={href || "#"}>
    <Suspense fallback={<LoadingBox />}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <IconComponent className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-medium">{content}</div>
        </CardContent>
      </Card>
    </Suspense>
  </Link>
);
