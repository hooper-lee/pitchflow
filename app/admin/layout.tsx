import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Building2,
  BarChart3,
  Settings,
  ScrollText,
  Timer,
} from "lucide-react";

const adminNavItems = [
  { href: "/admin", label: "概览", icon: LayoutDashboard },
  { href: "/admin/users", label: "用户管理", icon: Users },
  { href: "/admin/tenants", label: "租户管理", icon: Building2 },
  { href: "/admin/usage", label: "使用量监控", icon: BarChart3 },
  { href: "/admin/tasks", label: "定时任务", icon: Timer },
  { href: "/admin/configs", label: "系统配置", icon: Settings },
  { href: "/admin/audit-logs", label: "审计日志", icon: ScrollText },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="flex items-center h-16 px-6 border-b">
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
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
