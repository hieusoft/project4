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
  "/listings": { label: "Gian hàng 0 đồng", parent: "Quản lý" },
  "/notifications": { label: "Thông báo", parent: "Hệ thống" },
}

export function SiteHeader() {
  const pathname = usePathname()
  const meta = pageMeta[pathname] || { label: "Admin" }

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
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
    </header>
  )
}
