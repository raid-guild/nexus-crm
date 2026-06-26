"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { UpdateLeadForm } from "../../components/UpdateLeadForm";
import { convertLeadToOpportunity } from "@/actions/crm/leads/convert-lead-to-opportunity";

type ConfigItem = { id: string; name: string };

interface LeadDetailActionsProps {
  lead: any;
  leadSources: ConfigItem[];
  leadStatuses: ConfigItem[];
  leadTypes: ConfigItem[];
  leadSegments: ConfigItem[];
}

export function LeadDetailActions({
  lead,
  leadSources,
  leadStatuses,
  leadTypes,
  leadSegments,
}: LeadDetailActionsProps) {
  const router = useRouter();
  const [updateOpen, setUpdateOpen] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  const onConvert = async () => {
    setIsConverting(true);
    try {
      const result = await convertLeadToOpportunity({ leadId: lead.id });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      const conversion = result.data;
      if (!conversion) {
        toast.error("Failed to convert lead");
        return;
      }

      toast.success(
        conversion.alreadyConverted
          ? "Lead already converted"
          : "Lead converted to opportunity"
      );
      router.push(`/crm/opportunities/${conversion.opportunityId}`);
      router.refresh();
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <>
      <Sheet open={updateOpen} onOpenChange={setUpdateOpen}>
        <SheetContent className="w-full md:max-w-[771px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              Update lead - {lead?.firstName} {lead?.lastName}
            </SheetTitle>
            <SheetDescription>Update lead details</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <UpdateLeadForm
              initialData={lead}
              setOpen={setUpdateOpen}
              leadSources={leadSources}
              leadStatuses={leadStatuses}
              leadTypes={leadTypes}
              leadSegments={leadSegments}
            />
          </div>
        </SheetContent>
      </Sheet>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
            data-testid="lead-detail-actions-btn"
          >
            <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[160px]">
          <DropdownMenuItem onClick={() => setUpdateOpen(true)}>
            Update
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={Boolean(lead.converted_opportunity_id) || isConverting}
            onClick={onConvert}
          >
            {isConverting ? "Converting..." : "Convert"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
