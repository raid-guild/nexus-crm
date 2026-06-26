"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";

import { Lead } from "../table-data/schema";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableRowActions } from "./data-table-row-actions";
import moment from "moment";

type ConfigItem = { id: string; name: string };

const includesSelectedValue = (
  rowValue: unknown,
  selectedValues: string[]
) => selectedValues.includes(String(rowValue ?? ""));

const leadSegmentIds = (lead: Lead) =>
  lead.segments
    ?.map((member) => member.segment?.id ?? member.segment_id)
    .filter(Boolean) ?? [];

export const createColumns = (
  leadSources: ConfigItem[],
  leadStatuses: ConfigItem[],
  leadTypes: ConfigItem[],
): ColumnDef<Lead>[] => [
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Expected close" />
    ),
    cell: ({ row }) => (
      <div className="w-[80px]">
        {moment(row.getValue("createdAt")).format("YY-MM-DD")}
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "updatedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last update" />
    ),
    cell: ({ row }) => (
      <div className="w-[80px]">
        {moment(row.getValue("updatedAt")).format("YY-MM-DD")}
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "assigned_to_user",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Assigned to" />
    ),

    cell: ({ row }) => (
      <div className="w-[150px]">
        {
          //@ts-ignore
          //TODO: fix this
          row.getValue("assigned_to_user")?.name ?? "Unassigned"
        }
      </div>
    ),
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "company",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Company" />
    ),

    cell: ({ row }) => (
      <div className="">
        {
          //@ts-ignore
          //TODO: fix this
          row.getValue("company") ?? "Unassigned"
        }
      </div>
    ),
    enableSorting: false,
    enableHiding: true,
  },
  {
    accessorKey: "firstName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),

    cell: ({ row }) => (
      <Link href={`/crm/leads/${row.original.id}`} data-testid="lead-row-name">
        <div>
          {[row.original.firstName, row.original.lastName].filter(Boolean).join(" ")}
        </div>
      </Link>
    ),
    enableSorting: false,
    enableHiding: true,
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="E-mail" />
    ),

    cell: ({ row }) => <div className="w-[150px]">{row.getValue("email")}</div>,
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "phone",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Phone" />
    ),

    cell: ({ row }) => <div className="w-[150px]">{row.getValue("phone")}</div>,
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "lead_status_id",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.original.lead_status;
      return (
        <div className="w-[150px]">
          {status?.name ? <Badge>{status.name}</Badge> : "Unassigned"}
        </div>
      );
    },
    filterFn: (row, id, value) => {
      return includesSelectedValue(row.getValue(id), value);
    },
  },
  {
    accessorKey: "lead_source_id",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Source" />
    ),
    cell: ({ row }) => (
      <div className="w-[150px]">
        {row.original.lead_source?.name ? (
          <Badge variant="secondary">{row.original.lead_source.name}</Badge>
        ) : (
          "Unassigned"
        )}
      </div>
    ),
    enableSorting: false,
    enableHiding: true,
    filterFn: (row, id, value) => {
      return includesSelectedValue(row.getValue(id), value);
    },
  },
  {
    accessorKey: "lead_type_id",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => (
      <div className="w-[140px]">
        {row.original.lead_type?.name ? (
          <Badge variant="outline">{row.original.lead_type.name}</Badge>
        ) : (
          "Unassigned"
        )}
      </div>
    ),
    enableSorting: false,
    enableHiding: true,
    filterFn: (row, id, value) => {
      return includesSelectedValue(row.getValue(id), value);
    },
  },
  {
    id: "segments",
    accessorFn: (row) => leadSegmentIds(row).join("|"),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Segments" />
    ),
    cell: ({ row }) => {
      const segments = row.original.segments
        ?.map((member) => ({
          id: member.segment?.id ?? member.segment_id,
          name: member.segment?.name ?? "Unnamed segment",
        }))
        .filter((segment) => Boolean(segment.id));

      if (!segments?.length) return <div className="w-[180px]">None</div>;

      return (
        <div className="flex w-[220px] flex-wrap gap-1">
          {segments.slice(0, 2).map((segment) => (
            <Badge key={segment.id} variant="secondary">
              {segment.name}
            </Badge>
          ))}
          {segments.length > 2 ? (
            <Badge variant="outline">+{segments.length - 2}</Badge>
          ) : null}
        </div>
      );
    },
    enableSorting: false,
    enableHiding: true,
    filterFn: (row, _id, value) => {
      const segmentIds = leadSegmentIds(row.original);
      return value.some((selectedSegmentId: string) =>
        segmentIds.includes(selectedSegmentId)
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <DataTableRowActions
        row={row}
        leadSources={leadSources}
        leadStatuses={leadStatuses}
        leadTypes={leadTypes}
      />
    ),
  },
];
