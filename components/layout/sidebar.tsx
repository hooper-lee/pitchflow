"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  SearchCheck,
  Mail,
  FileText,
  BarChart3,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "仪表盘", icon: LayoutDashboard },
  { href: "/prospects", label: "客户管理", icon: Users },
  { href: "/prospects/discovery-jobs", label: "精准挖掘", icon: SearchCheck },
  { href: "/campaigns", label: "活动管理", icon: Mail },
  { href: "/templates", label: "邮件素材", icon: FileText },
  { href: "/analytics", label: "数据分析", icon: BarChart3 },
  { href: "/settings", label: "设置", icon: Settings },
];

function isActiveNavItem(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  if (pathname === href) return true;

  const activeNestedItem = navItems.find(
    (item) =>
      item.href !== href &&
      item.href.startsWith(`${href}/`) &&
      (pathname === item.href || pathname.startsWith(`${item.href}/`))
  );

  return !activeNestedItem && pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="flex items-center h-14 px-5 border-b border-slate-200/80">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">PF</span>
          </div>
          <span className="font-semibold text-lg">PitchFlow</span>
        </Link>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = isActiveNavItem(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-slate-100 hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
