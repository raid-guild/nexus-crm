"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { KanbanSquare, Table2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { NewLeadForm } from "../leads/components/NewLeadForm";
import { LeadKanbanBoard } from "../leads/components/LeadKanbanBoard";
import { LeadDataTable } from "../leads/table-components/data-table";

import { cn } from "@/lib/utils";
import type { getAllCrmData } from "@/actions/crm/get-crm-data";

type CrmData = Awaited<ReturnType<typeof getAllCrmData>>;

interface LeadsViewProps {
  data: any[];
  crmData: CrmData;
}

const LeadsView = ({ data, crmData }: LeadsViewProps) => {
  const { accounts, leadSources, leadStatuses, leadTypes } = crmData;
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "board" ? "board" : "list";
  const t = useTranslations("CrmPage");

  const setView = (nextView: "list" | "board") => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextView === "board") {
      params.set("view", "board");
    } else {
      params.delete("view");
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between">
          <div>
            <CardTitle>
              <Link href="/crm/leads" className="hover:underline">
                {t("leads.viewTitle")}
              </Link>
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border p-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 gap-1.5 px-2",
                  view === "list" && "bg-muted"
                )}
                onClick={() => setView("list")}
              >
                <Table2 className="h-4 w-4" />
                List
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 gap-1.5 px-2",
                  view === "board" && "bg-muted"
                )}
                onClick={() => setView("board")}
              >
                <KanbanSquare className="h-4 w-4" />
                Board
              </Button>
            </div>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button size="sm" aria-label={t("leads.addNew")} data-testid="add-lead-btn">+</Button>
              </SheetTrigger>
              <SheetContent className="w-full md:max-w-[771px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>{t("leads.sheetTitle")}</SheetTitle>
                  <SheetDescription>{t("leads.sheetDescription")}</SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <NewLeadForm
                    accounts={accounts}
                    leadSources={leadSources}
                    leadStatuses={leadStatuses}
                    leadTypes={leadTypes}
                    onFinish={() => setOpen(false)}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
        <Separator />
      </CardHeader>
      <CardContent>
        {!data ||
          (data.length === 0 ? (
            t("leads.empty")
          ) : view === "board" ? (
            <LeadKanbanBoard
              data={data}
              crmData={{ leadSources, leadStatuses, leadTypes }}
            />
          ) : (
            <LeadDataTable
              data={data}
              columns={[]}
              leadSources={leadSources}
              leadStatuses={leadStatuses}
              leadTypes={leadTypes}
            />
          ))}
      </CardContent>
    </Card>
  );
};

export default LeadsView;
