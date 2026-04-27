"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  BarChart3,
  Settings,
  ScrollText,
  Timer,
  Globe,
  FlaskConical,
  Bot,
  ShieldCheck,
  Network,
} from "lucide-react";

const adminNavItems = [
  { href: "/admin", label: "概览", icon: LayoutDashboard },
  { href: "/admin/users", label: "用户管理", icon: Users },
  { href: "/admin/tenants", label: "租户管理", icon: Building2 },
  { href: "/admin/usage", label: "使用量监控", icon: BarChart3 },
  { href: "/admin/agent-tools", label: "Agent 工具", icon: Bot },
  { href: "/admin/agent-runs", label: "Agent 运行", icon: BarChart3 },
  { href: "/admin/agent-approvals", label: "Agent 审批", icon: ShieldCheck },
  { href: "/admin/agent-mcp", label: "MCP Gateway", icon: Network },
  { href: "/admin/tasks", label: "定时任务", icon: Timer },
  { href: "/admin/configs", label: "系统配置", icon: Settings },
  { href: "/admin/detector", label: "网站检测器", icon: Globe },
  { href: "/admin/discovery-evals", label: "挖掘评测", icon: FlaskConical },
  { href: "/admin/audit-logs", label: "审计日志", icon: ScrollText },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return <div className="min-h-screen bg-slate-50/70">{children}</div>;
  }

  return (
    <div className="min-h-screen flex bg-slate-50/70">
      <aside className="w-64 border-r border-slate-200/80 bg-white flex flex-col">
        <div className="flex items-center h-14 px-5 border-b border-slate-200/80">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-destructive flex items-center justify-center">
              <span className="text-destructive-foreground font-bold text-sm">A</span>
            </div>
            <span className="font-semibold text-lg">管理后台</span>
          </Link>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {adminNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] text-muted-foreground hover:bg-slate-100 hover:text-foreground transition-colors"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t">
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            返回工作台 →
          </Link>
        </div>
      </aside>
      <main className="flex-1 p-5">
        <div className="mx-auto max-w-[1440px]">{children}</div>
      </main>
    </div>
  );
}
