import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth/config";

export async function middleware(request: NextRequest) {
  const session = await auth();
  const { pathname } = request.nextUrl;

  // Public routes
  if (pathname === "/" || pathname.startsWith("/(auth)")) {
    return NextResponse.next();
  }

  // Auth pages - redirect to dashboard if already logged in
  if (pathname === "/login" || pathname === "/register") {
    if (session?.user) {
      if (session.user.role === "super_admin") {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Admin login page - public, redirect admins already logged in
  if (pathname === "/admin/login") {
    if (session?.user && session.user.role === "super_admin") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  // Protected dashboard routes
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/prospects") ||
      pathname.startsWith("/campaigns") || pathname.startsWith("/templates") ||
      pathname.startsWith("/settings") || pathname.startsWith("/analytics")) {
    if (!session?.user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  // Protected admin routes (except /admin/login)
  if (pathname.startsWith("/admin")) {
    if (!session?.user) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    if (session.user.role !== "super_admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Protected API routes
  if (pathname.startsWith("/api/v1") || pathname.startsWith("/api/admin")) {
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin API role check
    if (pathname.startsWith("/api/admin") && session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/prospects/:path*",
    "/campaigns/:path*",
    "/templates/:path*",
    "/settings/:path*",
    "/analytics/:path*",
    "/admin/:path*",
    "/api/v1/:path*",
    "/api/admin/:path*",
    "/login",
    "/register",
    "/admin/login",
  ],
};
