"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
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
  ShieldAlertIcon,
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
  DropdownMenuLabel,
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
    return currentUser?.email || "Admin"
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<a href="/dashboard" />}
            >
              <HandHeartIcon className="size-5! text-primary" />
              <span className="text-base font-semibold">Kết nối Thiện nguyện</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Tổng quan</SidebarGroupLabel>
          <SidebarMenu>
            {navMain.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={isActive(item.url)}
                  render={<a href={item.url} />}
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
                  render={<a href={item.url} />}
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
                  render={<a href={item.url} />}
                >
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <SidebarMenuButton size="lg" className="w-full justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" />
              }>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md overflow-hidden bg-slate-200 dark:bg-slate-700">
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
                    <Settings2Icon className="mr-2 h-4 w-4 rotate-90" />
                  ) : (
                    <Settings2Icon className="mr-2 h-4 w-4" />
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
