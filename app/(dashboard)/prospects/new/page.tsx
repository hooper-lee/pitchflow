import { DiscoverForm } from "@/components/prospects/discover-form";

export default function NewProspectPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">挖掘客户</h1>
        <p className="text-muted-foreground">
          按行业和关键词搜索潜在客户，并结合国家偏置筛出更相关的官网结果
        </p>
      </div>
      <DiscoverForm />
    </div>
  );
}
