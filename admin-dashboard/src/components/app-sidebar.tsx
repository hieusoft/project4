"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  LayoutDashboardIcon,
  UsersIcon,
  HeartHandshakeIcon,
  PackageIcon,
  ShoppingBagIcon,
  BellIcon,
  Settings2Icon,
  HandHeartIcon,
  LogOutIcon,
  PackageOpenIcon,
  MoonIcon,
  SunIcon,
} from "lucide-react"
import { useAuth } from "@/context/auth-context"

const navMain = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboardIcon },
]

const navManage = [
  { title: "Tài khoản", url: "/accounts", icon: UsersIcon },
  { title: "Nhóm thiện nguyện", url: "/groups", icon: HeartHandshakeIcon },
  { title: "Quyên góp", url: "/donations", icon: PackageIcon },
  { title: "Kho hàng", url: "/inventory", icon: PackageOpenIcon },
  { title: "Gian hàng 0 đồng", url: "/listings", icon: ShoppingBagIcon },
  { title: "Yêu cầu nhận đồ", url: "/requests", icon: HandHeartIcon },
]

const navSystem = [
  { title: "Thông báo", url: "/notifications", icon: BellIcon },
]

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "next-themes"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { logout, currentUser } = useAuth()
  const { theme, setTheme } = useTheme()

  function isActive(url: string) {
    return pathname === url || pathname.startsWith(url + "/")
  }

  const getRoleLabel = () => {
    const roles = currentUser?.roles
    if (roles && roles.includes("PLATFORM_ADMIN")) return "Admin"
    if (roles && roles.includes("GROUP_LEADER")) return "Chủ nhóm"
    if (roles && roles.includes("MODERATOR")) return "Người kiểm duyệt"
    if (roles && roles.length > 0) return roles[0]
  }

  return (
    <Sidebar collapsible="offcanvas" className="border-r-0" {...props}>
      <SidebarHeader className="px-3 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-auto rounded-2xl bg-sidebar-accent/70 p-3! hover:bg-sidebar-accent"
              render={<Link href="/dashboard" />}
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
                <HandHeartIcon className="size-5!" />
              </div>
              <div className="grid text-left leading-tight">
                <span className="text-sm font-bold">ChoSV Admin</span>
                <span className="text-xs text-sidebar-foreground/65">Kết nối thiện nguyện</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel>Tổng quan</SidebarGroupLabel>
          <SidebarMenu>
            {navMain.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={isActive(item.url)}
                  className="h-10 rounded-xl data-[active=true]:bg-sidebar-primary data-[active=true]:font-semibold data-[active=true]:text-sidebar-primary-foreground"
                  render={<Link href={item.url} />}
                >
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Quản lý</SidebarGroupLabel>
          <SidebarMenu>
            {navManage.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={isActive(item.url)}
                  className="h-10 rounded-xl data-[active=true]:bg-sidebar-primary data-[active=true]:font-semibold data-[active=true]:text-sidebar-primary-foreground"
                  render={<Link href={item.url} />}
                >
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Hệ thống</SidebarGroupLabel>
          <SidebarMenu>
            {navSystem.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={isActive(item.url)}
                  className="h-10 rounded-xl data-[active=true]:bg-sidebar-primary data-[active=true]:font-semibold data-[active=true]:text-sidebar-primary-foreground"
                  render={<Link href={item.url} />}
                >
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <SidebarMenuButton size="lg" className="h-auto w-full justify-between rounded-2xl bg-sidebar-accent/75 p-3 transition-colors hover:bg-sidebar-accent" />
              }>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-sidebar-primary/20 ring-1 ring-white/10">
                    {currentUser?.avatar_url ? (
                      <img src={currentUser.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${currentUser?.username || 'admin'}&backgroundColor=e2e8f0`} alt="Avatar" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="flex flex-col text-left text-sm leading-tight">
                    <span className="font-semibold truncate max-w-[120px]">{currentUser?.full_name || currentUser?.username || "Admin"}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">{getRoleLabel()}</span>
                  </div>
                </div>
                <Settings2Icon className="h-4 w-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-[--radix-dropdown-menu-trigger-width] min-w-56" align="center" sideOffset={8}>
                <div className="px-2 py-1.5 text-sm font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">@{currentUser?.username || "admin"}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {currentUser?.email || "Chưa có email"}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<a href="/settings" className="cursor-pointer flex items-center w-full" />}>
                  <Settings2Icon className="mr-2 h-4 w-4" />
                  <span>Cài đặt hệ thống</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme(theme === "light" ? "dark" : "light")} className="cursor-pointer">
                  {theme === "light" ? (
                    <SunIcon className="mr-2 h-4 w-4" />
                  ) : (
                    <MoonIcon className="mr-2 h-4 w-4" />
                  )}
                  <span>{theme === "light" ? "Đổi sang Tối" : "Đổi sang Sáng"}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-600 dark:text-red-400 cursor-pointer focus:text-red-600 dark:focus:text-red-400 focus:bg-red-50 dark:focus:bg-red-950/50">
                  <LogOutIcon className="mr-2 h-4 w-4" />
                  <span>Đăng xuất</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
