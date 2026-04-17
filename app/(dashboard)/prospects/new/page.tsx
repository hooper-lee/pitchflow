import { DiscoverForm } from "@/components/prospects/discover-form";

export default function NewProspectPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">挖掘客户</h1>
        <p className="text-muted-foreground">
          通过公司域名自动搜索决策人邮箱
        </p>
      </div>
      <DiscoverForm />
    </div>
  );
}
