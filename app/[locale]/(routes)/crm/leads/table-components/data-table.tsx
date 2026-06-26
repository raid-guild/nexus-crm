"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { DataTablePagination } from "./data-table-pagination";
import { DataTableToolbar } from "./data-table-toolbar";
import { PanelTopClose, PanelTopOpen, Tags } from "lucide-react";
import { createColumns } from "./columns";
import type { Lead } from "../table-data/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addLeadsToSegment } from "@/actions/crm/leads/segments";
import { toast } from "sonner";

type ConfigItem = { id: string; name: string };

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  leadSources?: ConfigItem[];
  leadStatuses?: ConfigItem[];
  leadTypes?: ConfigItem[];
  leadSegments?: ConfigItem[];
}

export function LeadDataTable<TData, TValue>({
  data,
  leadSources = [],
  leadStatuses = [],
  leadTypes = [],
  leadSegments = [],
}: DataTableProps<TData, TValue>) {
  const columns = createColumns(leadSources, leadStatuses, leadTypes, leadSegments) as ColumnDef<TData, TValue>[];
  const visibleLeadSegments = React.useMemo(() => {
    const segments = new Map<string, string>();

    for (const lead of data as Lead[]) {
      for (const member of lead.segments ?? []) {
        const id = member.segment?.id ?? member.segment_id;
        if (!id) continue;
        segments.set(id, member.segment?.name ?? "Unnamed segment");
      }
    }

    return Array.from(segments, ([value, label]) => ({ value, label })).sort(
      (a, b) => a.label.localeCompare(b.label)
    );
  }, [data]);
  const leadSourceOptions = React.useMemo(
    () => leadSources.map((source) => ({ value: source.id, label: source.name })),
    [leadSources]
  );
  const leadStatusOptions = React.useMemo(
    () => leadStatuses.map((status) => ({ value: status.id, label: status.name })),
    [leadStatuses]
  );
  const leadTypeOptions = React.useMemo(
    () => leadTypes.map((type) => ({ value: type.id, label: type.name })),
    [leadTypes]
  );
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [bulkSegmentOpen, setBulkSegmentOpen] = React.useState(false);
  const [bulkSegmentId, setBulkSegmentId] = React.useState("");
  const [isAddingToSegment, setIsAddingToSegment] = React.useState(false);

  const [hide, setHide] = React.useState(false);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });
  const selectedLeadIds = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => (row.original as Lead).id);

  const onBulkAddToSegment = () => {
    if (!bulkSegmentId || selectedLeadIds.length === 0) return;

    setIsAddingToSegment(true);
    void (async () => {
      try {
        const result = await addLeadsToSegment({
          leadIds: selectedLeadIds,
          segmentId: bulkSegmentId,
        });

        if (result?.error) {
          toast.error(result.error);
          return;
        }

        toast.success("Leads added to segment");
        setBulkSegmentOpen(false);
        setBulkSegmentId("");
        table.resetRowSelection();
      } finally {
        setIsAddingToSegment(false);
      }
    })();
  };

  return (
    <div className="space-y-4">
      <Dialog open={bulkSegmentOpen} onOpenChange={setBulkSegmentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add leads to segment</DialogTitle>
            <DialogDescription>
              Add {selectedLeadIds.length} selected lead
              {selectedLeadIds.length === 1 ? "" : "s"} to an outreach segment.
            </DialogDescription>
          </DialogHeader>
          <Select value={bulkSegmentId} onValueChange={setBulkSegmentId}>
            <SelectTrigger>
              <SelectValue placeholder="Select segment" />
            </SelectTrigger>
            <SelectContent>
              {leadSegments.map((segment) => (
                <SelectItem key={segment.id} value={segment.id}>
                  {segment.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkSegmentOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!bulkSegmentId || isAddingToSegment}
              onClick={onBulkAddToSegment}
            >
              {isAddingToSegment ? "Adding..." : "Add to segment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="flex justify-between items-start gap-3">
        <div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            disabled={selectedLeadIds.length === 0 || leadSegments.length === 0}
            onClick={() => setBulkSegmentOpen(true)}
          >
            <Tags className="h-4 w-4" />
            Add to segment
          </Button>
        </div>
        <div className="flex justify-end space-x-2">
          {hide ? (
            <PanelTopOpen
              onClick={() => setHide(!hide)}
              className="text-muted-foreground"
            />
          ) : (
            <PanelTopClose
              onClick={() => setHide(!hide)}
              className="text-muted-foreground"
            />
          )}
        </div>
      </div>

      {hide ? (
        <div className="flex gap-2">
          This content is hidden now. Click on <PanelTopOpen /> to show content
        </div>
      ) : (
        <>
          <DataTableToolbar
            table={table}
            leadSources={leadSourceOptions}
            leadStatuses={leadStatusOptions}
            leadTypes={leadTypeOptions}
            leadSegments={visibleLeadSegments}
          />
          <div className="rounded-md border overflow-x-auto">
            <Table data-testid="leads-table">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DataTablePagination table={table} />
        </>
      )}
    </div>
  );
}
