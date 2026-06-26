"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type SegmentOption = {
  id: string;
  name: string;
};

interface LeadSegmentPickerProps {
  value: string[];
  segments: SegmentOption[];
  disabled?: boolean;
  onChange: (value: string[]) => void;
}

export function LeadSegmentPicker({
  value,
  segments,
  disabled,
  onChange,
}: LeadSegmentPickerProps) {
  if (segments.length === 0) {
    return (
      <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
        No lead segments available
      </div>
    );
  }

  const selected = new Set(value);

  return (
    <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
      {segments.map((segment) => (
        <label
          key={segment.id}
          className={cn(
            "flex cursor-pointer items-center gap-2 text-sm",
            disabled && "cursor-not-allowed opacity-60"
          )}
        >
          <Checkbox
            checked={selected.has(segment.id)}
            disabled={disabled}
            onCheckedChange={(checked) => {
              if (checked) {
                onChange(Array.from(new Set([...value, segment.id])));
              } else {
                onChange(value.filter((id) => id !== segment.id));
              }
            }}
          />
          <span>{segment.name}</span>
        </label>
      ))}
    </div>
  );
}
