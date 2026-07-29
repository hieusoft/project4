"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useAuth } from "@/context/auth-context"

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthLoading, currentUser } = useAuth()

  if (isAuthLoading || !currentUser) {
    return null
  }

  return (
    <SidebarProvider
      style={
        {
          "--header-height": "calc(var(--spacing) * 14)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex min-h-svh flex-1 flex-col bg-transparent">
          <div className="@container/main flex flex-1 flex-col">
            <div className="flex flex-col gap-5 py-5 md:gap-7 md:py-7">
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
