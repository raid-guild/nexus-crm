"use client";

import { Cross2Icon } from "@radix-ui/react-icons";
import { Table } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTableViewOptions } from "./data-table-view-options";

import { DataTableFacetedFilter } from "./data-table-faceted-filter";

type FilterOption = {
  label: string;
  value: string;
};

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  leadSources: FilterOption[];
  leadStatuses: FilterOption[];
  leadTypes: FilterOption[];
  leadSegments: FilterOption[];
}

export function DataTableToolbar<TData>({
  table,
  leadSources,
  leadStatuses,
  leadTypes,
  leadSegments,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Input
          placeholder="Filter leads ..."
          value={(table.getColumn("company")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("company")?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getColumn("lead_status_id") && leadStatuses.length > 0 && (
          <DataTableFacetedFilter
            column={table.getColumn("lead_status_id")}
            title="Status"
            options={leadStatuses}
          />
        )}
        {table.getColumn("lead_source_id") && leadSources.length > 0 && (
          <DataTableFacetedFilter
            column={table.getColumn("lead_source_id")}
            title="Source"
            options={leadSources}
          />
        )}
        {table.getColumn("lead_type_id") && leadTypes.length > 0 && (
          <DataTableFacetedFilter
            column={table.getColumn("lead_type_id")}
            title="Type"
            options={leadTypes}
          />
        )}
        {table.getColumn("segments") && leadSegments.length > 0 && (
          <DataTableFacetedFilter
            column={table.getColumn("segments")}
            title="Segment"
            options={leadSegments}
          />
        )}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <Cross2Icon className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  );
}
