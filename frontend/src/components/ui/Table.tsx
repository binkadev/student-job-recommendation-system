import type { ReactNode } from "react";

interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

interface TableProps<T> {
  label?: string;
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
}

export function Table<T>({ columns, rows, getRowKey, label = "Bảng dữ liệu" }: TableProps<T>) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="nova-table-wrap overflow-x-auto rounded-[20px] border border-[#E2E8EE] bg-white shadow-soft">
      <table className="min-w-full divide-y divide-[#E2E8EE] text-sm">
        <thead className="bg-[#F3F6F4]">
          <tr>
            {columns.map((column) => (
              <th
                scope="col"
                key={column.key}
                className={`whitespace-nowrap px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#334155] ${column.key === "status" ? "whitespace-nowrap" : ""}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#EFF3F6] bg-white">
          {rows.map((row) => (
            <tr key={getRowKey(row)} className="transition-colors hover:bg-[#F0FAF8]/70">
              {columns.map((column) => (
                <td key={column.key} className={`px-5 py-4 text-[#1B2533] ${column.key === "status" ? "whitespace-nowrap" : ""}`}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
