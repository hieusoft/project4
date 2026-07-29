"use client"

import { usePathname } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

const pageMeta: Record<string, { label: string; parent?: string }> = {
  "/dashboard": { label: "Dashboard" },
  "/accounts": { label: "Tài khoản", parent: "Quản lý" },
  "/groups": { label: "Nhóm thiện nguyện", parent: "Quản lý" },
  "/donations": { label: "Quyên góp", parent: "Quản lý" },
  "/inventory": { label: "Kho hàng", parent: "Quản lý" },
  "/listings": { label: "Gian hàng 0 đồng", parent: "Quản lý" },
  "/requests": { label: "Yêu cầu nhận đồ", parent: "Quản lý" },
  "/notifications": { label: "Thông báo", parent: "Hệ thống" },
  "/settings": { label: "Cài đặt", parent: "Hệ thống" },
}

export function SiteHeader() {
  const pathname = usePathname()
  const meta = pageMeta[pathname] || { label: "Admin" }

  return (
    <header className="sticky top-0 z-30 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/78 backdrop-blur-xl transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center justify-between gap-3 px-4 lg:gap-4 lg:px-7">
        <div className="flex items-center gap-1 lg:gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <Breadcrumb>
          <BreadcrumbList>
            {meta.parent && (
              <BreadcrumbItem className="hidden md:block">
                <span className="text-muted-foreground text-sm">{meta.parent}</span>
              </BreadcrumbItem>
            )}
            <BreadcrumbItem>
              <BreadcrumbPage className="text-sm font-medium">{meta.label}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        </div>
        <div className="hidden items-center gap-2 rounded-full border bg-card/70 px-3 py-1.5 text-xs text-muted-foreground shadow-sm md:flex">
          <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.13)]" />
          Hệ thống quản trị đang hoạt động
        </div>
      </div>
    </header>
  )
}
