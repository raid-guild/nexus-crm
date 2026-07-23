import { getTranslations } from "next-intl/server";
import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import { ReportChart } from "@/components/reports/ReportChart";
import { parseSearchParamsToFilters } from "@/actions/reports/types";
import {
  getActivitiesByType,
  getRecentActivities,
} from "@/actions/reports/activity";
import { RecentActivities } from "@/components/reports/RecentActivities";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function ActivityReportPage({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const params = new URLSearchParams(
    Object.entries(resolvedParams).filter(
      (entry): entry is [string, string] => entry[1] !== undefined
    )
  );
  const filters = parseSearchParamsToFilters(params);
  const t = await getTranslations("ReportsPage");

  const [activitiesByType, recentActivities] = await Promise.all([
    getActivitiesByType(filters),
    getRecentActivities(filters),
  ]);

  return (
    <ReportPageLayout
      title={t("activity.title")}
      description={t("activity.description")}
      category="activity"
      currentFilters={params.toString()}
    >
      <RecentActivities activities={recentActivities} />
      <ReportChart data={activitiesByType} titleKey="activitiesByType" type="bar" />
    </ReportPageLayout>
  );
}
