import { format } from "date-fns";
import Link from "next/link";
import { FileText, Mail, Phone, Users } from "lucide-react";

import type { RecentActivity } from "@/actions/reports/activity";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TYPE_DETAILS = {
  call: { label: "Call", icon: Phone },
  meeting: { label: "Meeting", icon: Users },
  note: { label: "Note", icon: FileText },
  email: { label: "Email", icon: Mail },
} as const;

const STATUS_VARIANTS = {
  scheduled: "outline",
  completed: "default",
  cancelled: "secondary",
} as const;

export function RecentActivities({ activities }: { activities: RecentActivity[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest touchpoints</CardTitle>
        <CardDescription>
          Recent calls, emails, meetings, and notes across CRM records.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {activities.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">
            No activities were logged during this date range.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Activity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Related to</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Logged by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.map((activity) => {
                const type = TYPE_DETAILS[activity.type];
                const Icon = type.icon;

                return (
                  <TableRow key={activity.id}>
                    <TableCell className="min-w-[240px]">
                      <div className="font-medium">{activity.title}</div>
                      {activity.description ? (
                        <div className="mt-1 max-w-md truncate text-xs text-muted-foreground">
                          {activity.description}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {type.label}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[180px]">
                      <div className="flex flex-wrap gap-1">
                        {activity.linkedEntities.length ? (
                          activity.linkedEntities.map((entity) => {
                            const badge = (
                              <Badge variant="outline" className="gap-1 font-normal">
                                <span className="capitalize text-muted-foreground">
                                  {entity.type}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{entity.name}</span>
                              </Badge>
                            );

                            return entity.href ? (
                              <Link
                                key={`${entity.type}:${entity.id}`}
                                href={entity.href}
                                className="hover:underline"
                              >
                                {badge}
                              </Link>
                            ) : (
                              <span key={`${entity.type}:${entity.id}`}>{badge}</span>
                            );
                          })
                        ) : (
                          <span className="text-muted-foreground">No linked record</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[activity.status]} className="capitalize">
                        {activity.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {format(activity.date, "MMM d, yyyy, h:mm a")}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{activity.createdByName}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
