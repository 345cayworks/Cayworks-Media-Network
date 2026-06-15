"use client";

import { useRef } from "react";

/**
 * Tiny checkbox that toggles every other checkbox in its nearest <form>
 * matching the given input `name`. Used to drive the bulk toolbars on
 * list pages.
 */
export function SelectAll({ name, label = "Select all" }: { name: string; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <label className="inline-flex items-center gap-2 text-xs text-slate-500">
      <input
        ref={ref}
        type="checkbox"
        className="h-3.5 w-3.5"
        onChange={(e) => {
          const form = ref.current?.closest("form");
          if (!form) return;
          const boxes = form.querySelectorAll<HTMLInputElement>(
            `input[type="checkbox"][name="${name}"]`,
          );
          boxes.forEach((b) => {
            b.checked = e.target.checked;
          });
        }}
      />
      {label}
    </label>
  );
}
