"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Building2,
  CalendarDays,
  Columns3,
  GripVertical,
  Mail,
  Phone,
  User,
} from "lucide-react";
import {
  closestCorners,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";

import { getLeadBoardDetail } from "@/actions/crm/leads/get-lead-board-detail";
import { updateLeadStatus } from "@/actions/crm/leads/update-lead-status";
import { ActivitiesView } from "@/components/crm/activities/ActivitiesView";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

import { UpdateLeadForm } from "./UpdateLeadForm";

type ConfigItem = { id: string; name: string };
type CrmData = {
  leadSources: ConfigItem[];
  leadStatuses: ConfigItem[];
  leadTypes: ConfigItem[];
};

type Lead = {
  id: string;
  firstName?: string | null;
  lastName: string;
  company?: string | null;
  jobTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  description?: string | null;
  lead_source_id?: string | null;
  lead_status_id?: string | null;
  lead_type_id?: string | null;
  assigned_to?: string | null;
  accountsIDs?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  assigned_to_user?: {
    id?: string | null;
    name?: string | null;
    avatar?: string | null;
  } | null;
  assigned_accounts?: { id: string; name?: string | null } | null;
  lead_source?: ConfigItem | null;
  lead_status?: ConfigItem | null;
  lead_type?: ConfigItem | null;
};

type Column = ConfigItem & { leads: Lead[] };
type LeadDetailPayload = {
  lead: Lead;
  activities: React.ComponentProps<typeof ActivitiesView>["initialData"];
};

const UNCATEGORIZED_STATUS_ID = "uncategorized";
const PREFERRED_COLUMN_ORDER = [
  "Uncategorized",
  "New",
  "Researching",
  "Cold Outreach",
  "Follow Up",
  "Qualified",
  "Converted to Opportunity",
  "Nurture",
  "Lost",
];

function getLeadName(lead: Lead) {
  return [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unnamed lead";
}

function normalizeColumnName(name: string) {
  return name.trim().toLowerCase();
}

function sortColumns(columns: Column[]) {
  const order = new Map(
    PREFERRED_COLUMN_ORDER.map((name, index) => [
      normalizeColumnName(name),
      index,
    ])
  );

  return [...columns].sort((a, b) => {
    const aOrder = order.get(normalizeColumnName(a.name));
    const bOrder = order.get(normalizeColumnName(b.name));

    if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
    if (aOrder !== undefined) return -1;
    if (bOrder !== undefined) return 1;

    return a.name.localeCompare(b.name);
  });
}

function initColumns(leads: Lead[], statuses: ConfigItem[]): Column[] {
  const configuredStatusIds = new Set(statuses.map((status) => status.id));
  const statusColumns = statuses.map((status) => ({
    ...status,
    leads: leads.filter((lead) => lead.lead_status_id === status.id),
  }));

  const missingStatusColumns = leads
    .filter(
      (lead) =>
        lead.lead_status_id && !configuredStatusIds.has(lead.lead_status_id)
    )
    .reduce<Column[]>((columns, lead) => {
      const statusId = lead.lead_status_id as string;
      const existing = columns.find((column) => column.id === statusId);
      if (existing) {
        existing.leads.push(lead);
        return columns;
      }

      columns.push({
        id: statusId,
        name: lead.lead_status?.name ?? "Unknown status",
        leads: [lead],
      });
      return columns;
    }, []);

  const uncategorized = leads.filter((lead) => !lead.lead_status_id);

  const columns = [
    ...statusColumns,
    ...missingStatusColumns,
    {
      id: UNCATEGORIZED_STATUS_ID,
      name: "Uncategorized",
      leads: uncategorized,
    },
  ];

  return sortColumns(columns);
}

function DroppableColumn({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[120px] rounded-md transition-colors ${
        isOver ? "bg-muted/70" : ""
      }`}
    >
      {children}
    </div>
  );
}

function LeadCard({
  lead,
  onOpen,
}: {
  lead: Lead;
  onOpen: (leadId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  const initials = getLeadName(lead)
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="my-2 w-full cursor-pointer border bg-background shadow-sm transition-shadow hover:shadow-md"
      onClick={() => onOpen(lead.id)}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <button
            type="button"
            aria-label="Drag lead"
            className="mt-0.5 cursor-grab rounded-sm p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
            onClick={(event) => event.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="space-y-1">
              <div className="truncate text-sm font-semibold">
                {getLeadName(lead)}
              </div>
              {lead.company ? (
                <div className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{lead.company}</span>
                </div>
              ) : null}
            </div>

            <div className="space-y-1 text-xs text-muted-foreground">
              {lead.email ? (
                <div className="flex items-center gap-1.5 truncate">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{lead.email}</span>
                </div>
              ) : null}
              {lead.phone ? (
                <div className="flex items-center gap-1.5 truncate">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{lead.phone}</span>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-1">
              {lead.lead_source?.name ? (
                <Badge variant="secondary" className="max-w-full truncate">
                  {lead.lead_source.name}
                </Badge>
              ) : null}
              {lead.lead_type?.name ? (
                <Badge variant="outline" className="max-w-full truncate">
                  {lead.lead_type.name}
                </Badge>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
              <div className="flex min-w-0 items-center gap-1.5">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={lead.assigned_to_user?.avatar ?? undefined} />
                  <AvatarFallback>
                    <User className="h-3.5 w-3.5" />
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">
                  {lead.assigned_to_user?.name ?? "Unassigned"}
                </span>
              </div>
              {lead.updatedAt ? (
                <div className="flex shrink-0 items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {format(new Date(lead.updatedAt), "MMM d")}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LeadDetailSheet({
  crmData,
  detail,
  isPending,
  open,
  onOpenChange,
}: {
  crmData: CrmData;
  detail: LeadDetailPayload | null;
  isPending: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const lead = detail?.lead;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader className="pr-8">
          <SheetTitle>{lead ? getLeadName(lead) : "Lead details"}</SheetTitle>
          <SheetDescription>
            {lead?.company ?? "Update lead fields and activity."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {isPending ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : lead && detail ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {lead.lead_status?.name ? (
                    <Badge>{lead.lead_status.name}</Badge>
                  ) : null}
                  {lead.lead_source?.name ? (
                    <Badge variant="secondary">{lead.lead_source.name}</Badge>
                  ) : null}
                  {lead.lead_type?.name ? (
                    <Badge variant="outline">{lead.lead_type.name}</Badge>
                  ) : null}
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/crm/leads/${lead.id}`}>Open full page</Link>
                </Button>
              </div>

              <Separator />

              <UpdateLeadForm
                initialData={lead}
                setOpen={onOpenChange}
                leadSources={crmData.leadSources}
                leadStatuses={crmData.leadStatuses}
                leadTypes={crmData.leadTypes}
              />

              <ActivitiesView
                entityType="lead"
                entityId={lead.id}
                initialData={detail.activities}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Lead not found.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function LeadKanbanBoard({
  data,
  crmData,
}: {
  data: Lead[];
  crmData: CrmData;
}) {
  const router = useRouter();
  const statuses = crmData.leadStatuses;
  const [hiddenColumnIds, setHiddenColumnIds] = useState<string[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LeadDetailPayload | null>(null);
  const [isDetailPending, startDetailTransition] = useTransition();

  const baseColumns = useMemo(() => initColumns(data, statuses), [data, statuses]);
  const [columnState, setColumnState] = useState<{
    data: Lead[];
    statuses: ConfigItem[];
    columns: Column[];
  } | null>(null);
  const columns =
    columnState?.data === data && columnState?.statuses === statuses
      ? columnState.columns
      : baseColumns;
  const visibleColumns = useMemo(
    () => columns.filter((column) => !hiddenColumnIds.includes(column.id)),
    [columns, hiddenColumnIds]
  );
  const columnsRef = useRef<Column[]>(
    visibleColumns
  );

  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const origStatusIdRef = useRef<string | null>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    columnsRef.current = visibleColumns;
  }, [visibleColumns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const leadCountByStatus = useMemo(() => {
    return columns.reduce<Record<string, number>>((acc, column) => {
      acc[column.id] = column.leads.length;
      return acc;
    }, {});
  }, [columns]);

  const toggleColumn = (columnId: string) => {
    setHiddenColumnIds((current) =>
      current.includes(columnId)
        ? current.filter((id) => id !== columnId)
        : [...current, columnId]
    );
  };

  const openLead = (leadId: string) => {
    setSelectedLeadId(leadId);
    setDetail(null);
    startDetailTransition(async () => {
      const result = await getLeadBoardDetail(leadId);
      if (result?.error) {
        toast.error(result.error);
      } else {
        setDetail(result.data as LeadDetailPayload);
      }
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    isDraggingRef.current = true;
    const activeId = event.active.id as string;

    for (const column of columnsRef.current) {
      const lead = column.leads.find((item) => item.id === activeId);
      if (lead) {
        setActiveLead(lead);
        origStatusIdRef.current = column.id;
        break;
      }
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const current = columnsRef.current;

    let fromColIdx = -1;
    for (let i = 0; i < current.length; i++) {
      const index = current[i].leads.findIndex((lead) => lead.id === activeId);
      if (index !== -1) {
        fromColIdx = i;
        break;
      }
    }

    if (fromColIdx === -1) return;

    let toColIdx = current.findIndex((column) => column.id === overId);
    let toLeadIdx = 0;

    if (toColIdx === -1) {
      for (let i = 0; i < current.length; i++) {
        const index = current[i].leads.findIndex((lead) => lead.id === overId);
        if (index !== -1) {
          toColIdx = i;
          toLeadIdx = index;
          break;
        }
      }
    } else {
      toLeadIdx = current[toColIdx].leads.length;
    }

    if (toColIdx === -1 || fromColIdx === toColIdx) return;

    const newColumns = columns.map((column) => ({
      ...column,
      leads: [...column.leads],
    }));

    const sourceColumnId = current[fromColIdx].id;
    const targetColumnId = current[toColIdx].id;
    const sourceColumnIndex = newColumns.findIndex(
      (column) => column.id === sourceColumnId
    );
    const targetColumnIndex = newColumns.findIndex(
      (column) => column.id === targetColumnId
    );

    if (sourceColumnIndex === -1 || targetColumnIndex === -1) return;

    const sourceLeadIndex = newColumns[sourceColumnIndex].leads.findIndex(
      (lead) => lead.id === activeId
    );

    if (sourceLeadIndex === -1) return;

    const [movedLead] = newColumns[sourceColumnIndex].leads.splice(
      sourceLeadIndex,
      1
    );
    movedLead.lead_status_id =
      newColumns[targetColumnIndex].id === UNCATEGORIZED_STATUS_ID
        ? null
        : newColumns[targetColumnIndex].id;
    movedLead.lead_status =
      newColumns[targetColumnIndex].id === UNCATEGORIZED_STATUS_ID
        ? null
        : {
            id: newColumns[targetColumnIndex].id,
            name: newColumns[targetColumnIndex].name,
          };
    newColumns[targetColumnIndex].leads.splice(toLeadIdx, 0, movedLead);

    columnsRef.current = newColumns.filter(
      (column) => !hiddenColumnIds.includes(column.id)
    );
    setColumnState({ data, statuses, columns: newColumns });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    isDraggingRef.current = false;
    setActiveLead(null);

    const activeId = event.active.id as string;
    const current = columnsRef.current;
    const currentColumn = current.find((column) =>
      column.leads.some((lead) => lead.id === activeId)
    );

    if (!currentColumn) return;

    const currentStatusId = currentColumn.id;
    const wasCrossStatusMove =
      origStatusIdRef.current !== null &&
      origStatusIdRef.current !== currentStatusId;

    origStatusIdRef.current = null;
    if (!wasCrossStatusMove) return;

    const nextStatusId =
      currentStatusId === UNCATEGORIZED_STATUS_ID ? null : currentStatusId;

    try {
      const result = await updateLeadStatus({
        id: activeId,
        lead_status_id: nextStatusId,
      });

      if (result?.error) {
        toast.error(result.error);
        columnsRef.current = baseColumns;
        setColumnState(null);
      } else {
        toast.success("Lead status updated");
        router.refresh();
      }
    } catch (error) {
      console.log(error);
      toast.error("Something went wrong");
      columnsRef.current = baseColumns;
      setColumnState(null);
    }
  };

  return (
    <>
      <div className="mb-3 flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Columns3 className="h-4 w-4" />
              Columns
              {hiddenColumnIds.length > 0 ? (
                <Badge variant="secondary">{hiddenColumnIds.length}</Badge>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {columns.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={!hiddenColumnIds.includes(column.id)}
                onCheckedChange={() => toggleColumn(column.id)}
                onSelect={(event) => event.preventDefault()}
              >
                <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <span className="truncate">{column.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {leadCountByStatus[column.id] ?? 0}
                  </span>
                </span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex min-h-[620px] w-full gap-3 overflow-x-auto pb-3">
          {visibleColumns.map((column) => (
            <section
              key={column.id}
              className="flex w-[320px] shrink-0 flex-col rounded-md border bg-muted/30"
            >
              <div className="flex items-center justify-between border-b px-3 py-2">
                <h2 className="truncate text-sm font-semibold">{column.name}</h2>
                <Badge variant="secondary">
                  {leadCountByStatus[column.id] ?? 0}
                </Badge>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                <SortableContext
                  items={column.leads.map((lead) => lead.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <DroppableColumn id={column.id}>
                    {column.leads.map((lead) => (
                      <LeadCard key={lead.id} lead={lead} onOpen={openLead} />
                    ))}
                    {column.leads.length === 0 ? (
                      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                        No leads
                      </div>
                    ) : null}
                  </DroppableColumn>
                </SortableContext>
              </div>
            </section>
          ))}
        </div>

        <DragOverlay>
          {activeLead ? (
            <Card className="w-[280px] bg-background opacity-90 shadow-lg">
              <CardContent className="p-3">
                <div className="text-sm font-semibold">
                  {getLeadName(activeLead)}
                </div>
                {activeLead.company ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {activeLead.company}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      <LeadDetailSheet
        crmData={crmData}
        detail={detail}
        isPending={isDetailPending}
        open={Boolean(selectedLeadId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedLeadId(null);
            setDetail(null);
            router.refresh();
          }
        }}
      />
    </>
  );
}
