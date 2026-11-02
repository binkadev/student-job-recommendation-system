import type { ReactNode } from "react";
import { Table } from "../../components/ui/Table";

interface RecruiterDataTableProps<T> {
  columns: { key: string; header: string; render: (row: T) => ReactNode }[];
  rows: T[];
  getRowKey: (row: T) => string;
}

/** Reuse the shared table, with labeled record cards below the desktop breakpoint. */
export function RecruiterDataTable<T>({ columns, ...props }: RecruiterDataTableProps<T>) {
  return (
    <div className="[&_table]:block [&_tbody]:block [&_tbody_tr]:grid [&_tbody_tr]:gap-4 [&_tbody_tr]:p-4 [&_td]:block [&_td]:!whitespace-normal [&_td]:!p-0 [&_td]:min-w-0 [&_thead]:sr-only md:[&_tbody_tr]:grid-cols-2 xl:[&_table]:table xl:[&_tbody]:table-row-group xl:[&_tbody_tr]:table-row xl:[&_tbody_tr]:p-0 xl:[&_td]:table-cell xl:[&_td]:!px-5 xl:[&_td]:!py-4 xl:[&_thead]:not-sr-only xl:[&_thead]:table-header-group">
      <Table<T> {...props} columns={columns.map((column) => ({
        ...column,
        render: (row) => <><span className="mb-1.5 block text-xs font-semibold text-slate-500 xl:hidden">{column.header}</span>{column.render(row)}</>,
      }))} />
    </div>
  );
}
