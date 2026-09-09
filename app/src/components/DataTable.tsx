import { useMemo, useState, type ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
  /** Enables click-to-sort on this column's header. Return the raw value to
   * compare (not the rendered node) — string, number, or null for missing. */
  sortValue?: (row: T) => string | number | null;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

type SortDirection = "asc" | "desc";

function SortCaret({ active, direction }: { active: boolean; direction: SortDirection }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={`ml-1 inline-block h-3 w-3 shrink-0 align-[-1px] transition-transform ${
        active ? "text-accent" : "text-ink-faint dark:text-dark-ink-muted"
      } ${direction === "desc" ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 7.5L6 4l3.5 3.5" />
    </svg>
  );
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyMessage = "No records found.",
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const sortColumn = columns.find((c) => c.key === sortKey);

  const sortedRows = useMemo(() => {
    if (!sortColumn?.sortValue) return rows;
    const { sortValue } = sortColumn;
    const withValues = rows.map((row) => ({ row, value: sortValue(row) }));
    withValues.sort((a, b) => {
      if (a.value === null && b.value === null) return 0;
      if (a.value === null) return 1;
      if (b.value === null) return -1;
      if (typeof a.value === "number" && typeof b.value === "number") {
        return a.value - b.value;
      }
      return String(a.value).localeCompare(String(b.value));
    });
    if (sortDirection === "desc") withValues.reverse();
    return withValues.map((w) => w.row);
  }, [rows, sortColumn, sortDirection]);

  function handleHeaderClick(col: Column<T>) {
    if (!col.sortValue) return;
    if (sortKey === col.key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col.key);
      setSortDirection("asc");
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface dark:border-dark-border dark:bg-dark-surface">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-muted dark:border-dark-border dark:bg-dark-surface-muted">
            {columns.map((col) => {
              const isSortable = Boolean(col.sortValue);
              const isActive = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  onClick={isSortable ? () => handleHeaderClick(col) : undefined}
                  aria-sort={
                    isActive ? (sortDirection === "asc" ? "ascending" : "descending") : undefined
                  }
                  className={`whitespace-nowrap px-3 py-2 font-body text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-dark-ink-muted ${
                    col.align === "right" ? "text-right" : "text-left"
                  } ${isSortable ? "cursor-pointer select-none hover:text-ink dark:hover:text-dark-ink" : ""} ${
                    isActive ? "text-accent dark:text-accent" : ""
                  }`}
                >
                  {col.align === "right" ? (
                    <>
                      {isSortable && <SortCaret active={isActive} direction={isActive ? sortDirection : "asc"} />}
                      {col.header}
                    </>
                  ) : (
                    <>
                      {col.header}
                      {isSortable && <SortCaret active={isActive} direction={isActive ? sortDirection : "asc"} />}
                    </>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-8 text-center font-body text-sm text-ink-faint dark:text-dark-ink-muted"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedRows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-border last:border-b-0 dark:border-dark-border ${
                  onRowClick ? "cursor-pointer hover:bg-surface-muted dark:hover:bg-dark-surface-muted" : ""
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`whitespace-nowrap px-3 py-2 ${
                      col.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
