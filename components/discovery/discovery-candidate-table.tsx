"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DiscoveryCandidate {
  id: string;
  companyName: string | null;
  domain: string | null;
  rootDomain: string | null;
  finalScore: number | null;
  detectorScore: number | null;
  ruleScore: number | null;
  aiScore: number | null;
  decision: string;
  matchedRules: string[];
  rejectReasons: string[];
  evidence: { source: string; quote: string; reason?: string }[];
  contacts: Record<string, unknown>;
  title: string | null;
  snippet: string | null;
}

interface DiscoveryCandidateTableProps {
  candidates: DiscoveryCandidate[];
  onAction: (
    candidateId: string,
    action: "accept" | "reject" | "blacklist" | "restore" | "save_to_prospect"
  ) => Promise<void>;
}

const decisionLabelMap: Record<string, string> = {
  pending: "待处理",
  accepted: "已接受",
  rejected: "已拒绝",
  needs_review: "待审核",
  blacklisted: "已拉黑",
  saved: "已入库",
};

function decisionVariant(decision: string) {
  if (decision === "accepted" || decision === "saved") return "default";
  if (decision === "rejected" || decision === "blacklisted") return "destructive";
  return "secondary";
}

export function DiscoveryCandidateTable({
  candidates,
  onAction,
}: DiscoveryCandidateTableProps) {
  const [selectedCandidate, setSelectedCandidate] =
    useState<DiscoveryCandidate | null>(null);
  const [runningAction, setRunningAction] = useState<string | null>(null);

  async function runAction(
    candidateId: string,
    action: "accept" | "reject" | "blacklist" | "restore" | "save_to_prospect"
  ) {
    setRunningAction(`${candidateId}:${action}`);
    try {
      await onAction(candidateId, action);
    } finally {
      setRunningAction(null);
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">公司</th>
              <th className="px-4 py-3">域名</th>
              <th className="px-4 py-3">总分</th>
              <th className="px-4 py-3">决策</th>
              <th className="px-4 py-3">命中规则</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => (
              <tr key={candidate.id} className="border-t border-slate-100">
                <td className="px-4 py-4 align-top">
                  <button
                    className="space-y-1 text-left"
                    onClick={() => setSelectedCandidate(candidate)}
                  >
                    <div className="font-medium text-foreground">
                      {candidate.companyName || candidate.title || candidate.domain}
                    </div>
                    <div className="text-xs text-muted-foreground">{candidate.snippet}</div>
                  </button>
                </td>
                <td className="px-4 py-4 align-top text-muted-foreground">
                  {candidate.rootDomain || candidate.domain || "-"}
                </td>
                <td className="px-4 py-4 align-top font-medium">
                  {candidate.finalScore ?? "-"}
                </td>
                <td className="px-4 py-4 align-top">
                  <Badge variant={decisionVariant(candidate.decision)}>
                    {decisionLabelMap[candidate.decision] || candidate.decision}
                  </Badge>
                </td>
                <td className="px-4 py-4 align-top">
                  <div className="flex flex-wrap gap-1.5">
                    {candidate.matchedRules.slice(0, 3).map((rule) => (
                      <Badge key={rule} variant="outline" className="text-[11px]">
                        {rule}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-4 align-top">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={Boolean(runningAction)}
                      onClick={() => runAction(candidate.id, "accept")}
                    >
                      {runningAction === `${candidate.id}:accept` ? "处理中..." : "接受"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={Boolean(runningAction)}
                      onClick={() => runAction(candidate.id, "reject")}
                    >
                      {runningAction === `${candidate.id}:reject` ? "处理中..." : "拒绝"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={Boolean(runningAction)}
                      onClick={() => runAction(candidate.id, "blacklist")}
                    >
                      {runningAction === `${candidate.id}:blacklist`
                        ? "处理中..."
                        : "拉黑"}
                    </Button>
                    <Button
                      size="sm"
                      disabled={Boolean(runningAction)}
                      onClick={() => runAction(candidate.id, "save_to_prospect")}
                    >
                      {runningAction === `${candidate.id}:save_to_prospect`
                        ? "处理中..."
                        : "入库"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={Boolean(selectedCandidate)}
        onOpenChange={(open) => !open && setSelectedCandidate(null)}
      >
        <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-slate-200/80 px-6 py-5">
            <DialogTitle>
              {selectedCandidate?.companyName || selectedCandidate?.domain}
            </DialogTitle>
            <DialogDescription>查看候选证据、规则命中和判定理由</DialogDescription>
          </DialogHeader>
          {selectedCandidate && (
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-slate-200/80 p-3">
                  <div className="text-xs text-muted-foreground">总分</div>
                  <div className="text-xl font-semibold">{selectedCandidate.finalScore ?? "-"}</div>
                </div>
                <div className="rounded-xl border border-slate-200/80 p-3">
                  <div className="text-xs text-muted-foreground">官网识别分</div>
                  <div className="text-xl font-semibold">{selectedCandidate.detectorScore ?? "-"}</div>
                </div>
                <div className="rounded-xl border border-slate-200/80 p-3">
                  <div className="text-xs text-muted-foreground">规则命中分</div>
                  <div className="text-xl font-semibold">{selectedCandidate.ruleScore ?? "-"}</div>
                </div>
                <div className="rounded-xl border border-slate-200/80 p-3">
                  <div className="text-xs text-muted-foreground">AI 判断分</div>
                  <div className="text-xl font-semibold">{selectedCandidate.aiScore ?? "-"}</div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 rounded-xl border border-slate-200/80 p-4">
                  <h3 className="font-medium">命中规则</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedCandidate.matchedRules.length > 0
                      ? selectedCandidate.matchedRules.map((rule) => (
                          <Badge key={rule} variant="outline">
                            {rule}
                          </Badge>
                        ))
                      : <span className="text-sm text-muted-foreground">暂无</span>}
                  </div>
                </div>
                <div className="space-y-2 rounded-xl border border-slate-200/80 p-4">
                  <h3 className="font-medium">拒绝原因</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedCandidate.rejectReasons.length > 0
                      ? selectedCandidate.rejectReasons.map((reason) => (
                          <Badge key={reason} variant="destructive">
                            {reason}
                          </Badge>
                        ))
                      : <span className="text-sm text-muted-foreground">暂无</span>}
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-slate-200/80 p-4">
                <h3 className="font-medium">判断证据</h3>
                {selectedCandidate.evidence.length > 0 ? (
                  <div className="space-y-3">
                    {selectedCandidate.evidence.map((item, index) => (
                      <div key={`${item.source}-${index}`} className="rounded-xl bg-slate-50 p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">
                          {item.source}
                        </div>
                        <p className="mt-1 text-sm">{item.quote}</p>
                        {item.reason && (
                          <p className="mt-2 text-xs text-muted-foreground">{item.reason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">暂无证据</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
