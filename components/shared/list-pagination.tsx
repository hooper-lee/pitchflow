"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ListPaginationProps {
  page: number;
  totalPages: number;
  total?: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
}

export function ListPagination({
  page,
  totalPages,
  total,
  itemLabel = "条",
  onPageChange,
}: ListPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-6 flex flex-col gap-3 rounded-[24px] border border-slate-200/80 bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-slate-500">
        {typeof total === "number" ? `共 ${total} ${itemLabel}` : "分页结果"}
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          上一页
        </Button>
        <span className="min-w-24 text-center text-sm text-slate-500">
          第 {page} / {totalPages} 页
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          下一页
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
