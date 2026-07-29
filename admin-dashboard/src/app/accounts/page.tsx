"use client"

import { AdminLayout } from "@/components/admin-layout"
import { useEffect, useState, useCallback } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { identityApi } from "@/lib/api/client"
import { Account, Profile } from "@/types"
import {
  Shield,
  ShieldOff,
  UsersIcon,
  EyeIcon,
  UserX,
  MailWarning,
  Search,
  MailCheck,
  KeyRound,
  Clock3,
  CalendarDays,
  MapPin,
  HeartHandshake,
  Gift,
  Phone,
  Mail,
  BadgeCheck,
} from "lucide-react"

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Hoạt động", variant: "default" },
  unverified: { label: "Chưa xác minh", variant: "secondary" },
  locked: { label: "Bị khóa", variant: "destructive" },
  deleted: { label: "Đã xóa", variant: "outline" },
}

const accountStatuses = ["active", "unverified", "locked", "deleted"] as const

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>("active")
  const [loading, setLoading] = useState(true)
  const [dialogAccount, setDialogAccount] = useState<Account | null>(null)
  const [dialogAction, setDialogAction] = useState<"lock" | "unlock" | "view">("lock")
  const [profileData, setProfileData] = useState<any>(null)
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [statusTotals, setStatusTotals] = useState<Record<string, number>>({})
  const [loadingProfile, setLoadingProfile] = useState(false)
  const limit = 20

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit }
      if (statusFilter !== "all") params.status = statusFilter
      const res = await identityApi.listAccounts(params as any)
      const items = res.data.items
      setAccounts(items)
      setTotal(res.data.meta.total)
      if (items.length > 0) {
        const profileRes = await identityApi.getProfilesBatch(items.map((item) => item.id))
        setProfiles(
          Object.fromEntries(profileRes.data.map((profile) => [profile.id, profile]))
        )
      } else {
        setProfiles({})
      }
    } catch (err: any) {
      toast.error("Lỗi tải danh sách tài khoản: " + err.message)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  const fetchStatusTotals = useCallback(async () => {
    const results = await Promise.allSettled(
      accountStatuses.map((status) => identityApi.listAccounts({ status, limit: 1 }))
    )
    setStatusTotals(
      Object.fromEntries(
        accountStatuses.map((status, index) => [
          status,
          results[index].status === "fulfilled" ? results[index].value.data.meta.total : 0,
        ])
      )
    )
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAccounts()
    fetchStatusTotals()
  }, [fetchAccounts, fetchStatusTotals])

  async function handleLockUnlock() {
    if (!dialogAccount) return
    try {
      if (dialogAction === "lock") {
        await identityApi.lockAccount(dialogAccount.id)
        toast.success(`Đã khóa tài khoản ${dialogAccount.username}`)
      } else {
        await identityApi.unlockAccount(dialogAccount.id)
        toast.success(`Đã mở khóa tài khoản ${dialogAccount.username}`)
      }
      setDialogAccount(null)
      fetchAccounts()
      fetchStatusTotals()
    } catch (err: any) {
      toast.error("Thao tác thất bại: " + err.message)
    }
  }

  async function handleViewProfile(account: Account) {
    setDialogAccount(account)
    setDialogAction("view")
    setLoadingProfile(true)
    setProfileData(null)
    try {
      const res = await identityApi.getProfile(account.id)
      setProfileData(res.data)
    } catch (err: any) {
      toast.error("Lỗi tải thông tin chi tiết: " + err.message)
    } finally {
      setLoadingProfile(false)
    }
  }

  const totalPages = Math.ceil(total / limit)
  const normalizedSearch = searchQuery.trim().toLowerCase()
  const visibleAccounts = normalizedSearch
    ? accounts.filter((account) => {
        const profile = profiles[account.id]
        return [
          account.username,
          account.email,
          account.phone,
          profile?.full_name,
        ].some((value) => value?.toLowerCase().includes(normalizedSearch))
      })
    : accounts

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="rounded-[1.75rem] border bg-card/80 p-5 shadow-sm backdrop-blur">
          <div className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-2xl font-bold tracking-tight">Quản lý Tài khoản</h2>
          </div>
          <p className="mt-1 text-muted-foreground">
            Theo dõi hồ sơ, bảo mật, hoạt động đăng nhập và trạng thái tài khoản
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { key: "active", label: "Đang hoạt động", icon: UsersIcon, tone: "text-emerald-700 bg-emerald-500/10" },
            { key: "unverified", label: "Chưa xác minh", icon: MailWarning, tone: "text-amber-700 bg-amber-500/10" },
            { key: "locked", label: "Đang bị khóa", icon: Shield, tone: "text-red-700 bg-red-500/10" },
            { key: "deleted", label: "Đã xóa", icon: UserX, tone: "text-slate-700 bg-slate-500/10" },
          ].map((item) => (
            <button
              type="button"
              key={item.key}
              onClick={() => {
                setStatusFilter(item.key)
                setPage(1)
              }}
              className={`admin-surface flex items-center justify-between p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${statusFilter === item.key ? "ring-2 ring-primary/35" : ""}`}
            >
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{(statusTotals[item.key] || 0).toLocaleString("vi-VN")}</p>
              </div>
              <div className={`rounded-2xl p-3 ${item.tone}`}><item.icon className="size-5" /></div>
            </button>
          ))}
        </div>

        <Tabs
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v)
            setPage(1)
          }}
          className="mb-1"
        >
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="overflow-x-auto pb-1">
            <TabsList className="min-w-max">
              <TabsTrigger value="active" className="gap-1.5">
                <UsersIcon className="h-3.5 w-3.5" />
                Hoạt động
              </TabsTrigger>
              <TabsTrigger value="unverified" className="gap-1.5">
                <MailWarning className="h-3.5 w-3.5" />
                Chưa xác minh
              </TabsTrigger>
              <TabsTrigger value="locked" className="gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Bị khóa
              </TabsTrigger>
              <TabsTrigger value="deleted" className="gap-1.5">
                <UserX className="h-3.5 w-3.5" />
                Đã xóa
              </TabsTrigger>
            </TabsList>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Tìm trong trang hiện tại..."
                  className="w-full pl-9 sm:w-64"
                />
              </div>
              <Badge variant="secondary">{total} tài khoản</Badge>
            </div>
          </div>
        </Tabs>

        <Card className="admin-surface">
          <CardContent>
            <div className="admin-table-wrap">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Người dùng</TableHead>
                  <TableHead>Liên hệ</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Bảo mật</TableHead>
                  <TableHead>Lần đăng nhập cuối</TableHead>
                  <TableHead>Ngày tham gia</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : visibleAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-14 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <UsersIcon className="h-8 w-8" />
                        <p>{searchQuery ? "Không có tài khoản khớp tìm kiếm" : "Không tìm thấy tài khoản"}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleAccounts.map((account) => {
                    const profile = profiles[account.id]
                    return (
                    <TableRow key={account.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 font-bold text-primary">
                            {profile?.avatar_url ? (
                              <img src={profile.avatar_url} alt="" className="size-full object-cover" />
                            ) : (
                              (profile?.full_name || account.username).charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="max-w-52 truncate font-semibold">{profile?.full_name || account.username}</p>
                            <p className="max-w-52 truncate text-xs text-muted-foreground">@{account.username}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p className="flex items-center gap-1.5"><Mail className="size-3" />{account.email || "Chưa có email"}</p>
                          <p className="flex items-center gap-1.5"><Phone className="size-3" />{account.phone || "Chưa có SĐT"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig[account.status]?.variant || "secondary"}>
                          {statusConfig[account.status]?.label || account.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant={account.email_verified ? "default" : "secondary"} className="gap-1">
                            <MailCheck className="size-3" /> Email
                          </Badge>
                          <Badge variant={account.totp_enabled ? "default" : "outline"} className="gap-1">
                            <KeyRound className="size-3" /> 2FA
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {account.last_login_at
                          ? new Date(account.last_login_at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })
                          : "Chưa đăng nhập"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(account.created_at).toLocaleDateString("vi-VN")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleViewProfile(account)}
                          >
                            <EyeIcon className="h-4 w-4" />
                          </Button>
                          
                          {account.status === "locked" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setDialogAccount(account)
                                setDialogAction("unlock")
                              }}
                            >
                              <ShieldOff className="h-4 w-4" />
                            </Button>
                          ) : account.status !== "deleted" ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setDialogAccount(account)
                                setDialogAction("lock")
                              }}
                            >
                              <Shield className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )})
                )}
              </TableBody>
            </Table>
            </div>

            {total > 0 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Hiển thị {(page - 1) * limit + 1}–{Math.min(page * limit, total)} / {total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Trước
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Sau
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!dialogAccount}
        onOpenChange={() => setDialogAccount(null)}
      >
        <DialogContent className={dialogAction === "view" ? "max-h-[92vh] overflow-y-auto sm:max-w-3xl" : undefined}>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === "lock" ? "Khóa tài khoản" : 
               dialogAction === "unlock" ? "Mở khóa tài khoản" : 
               "Hồ sơ người dùng"}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === "lock"
                ? `Bạn có chắc muốn khóa tài khoản "${dialogAccount?.username}"? Tất cả session sẽ bị đăng xuất.`
                : dialogAction === "unlock" 
                ? `Bạn có chắc muốn mở khóa tài khoản "${dialogAccount?.username}"?`
                : "Chi tiết hoạt động và danh tiếng trên hệ thống"}
            </DialogDescription>
          </DialogHeader>
          
          {dialogAction === "view" && (
            <div className="py-4">
              {loadingProfile ? (
                <div className="space-y-4">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : profileData && dialogAccount ? (
                <div className="space-y-5 text-sm">
                  <div className="flex flex-col gap-4 rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-amber-500/5 p-5 sm:flex-row sm:items-center">
                    <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-primary/10 text-2xl font-bold text-primary ring-4 ring-background">
                      {profileData.avatar_url ? (
                        <img src={profileData.avatar_url} alt="" className="size-full object-cover" />
                      ) : (
                        (profileData.full_name || dialogAccount.username).charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-xl font-bold">{profileData.full_name || dialogAccount.username}</h3>
                        <Badge variant={statusConfig[dialogAccount.status]?.variant || "secondary"}>
                          {statusConfig[dialogAccount.status]?.label || dialogAccount.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground">@{dialogAccount.username}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant={dialogAccount.email_verified ? "default" : "secondary"} className="gap-1">
                          <MailCheck className="size-3" />
                          {dialogAccount.email_verified ? "Email đã xác minh" : "Email chưa xác minh"}
                        </Badge>
                        <Badge variant={dialogAccount.totp_enabled ? "default" : "outline"} className="gap-1">
                          <KeyRound className="size-3" />
                          {dialogAccount.totp_enabled ? "Đã bật 2FA" : "Chưa bật 2FA"}
                        </Badge>
                      </div>
                    </div>
                    <div className="rounded-2xl border bg-background/70 px-4 py-3 text-center">
                      <p className="text-2xl font-bold text-emerald-600">{profileData.reputation_score || 0}</p>
                      <p className="text-xs text-muted-foreground">Điểm uy tín</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-2xl border bg-background/55 p-4">
                      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Mail className="size-3.5" />Email</p>
                      <p className="mt-2 break-all font-medium">{dialogAccount.email || "Chưa cập nhật"}</p>
                    </div>
                    <div className="rounded-2xl border bg-background/55 p-4">
                      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Phone className="size-3.5" />Điện thoại</p>
                      <p className="mt-2 font-medium">{dialogAccount.phone || "Chưa cập nhật"}</p>
                    </div>
                    <div className="rounded-2xl border bg-background/55 p-4">
                      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"><MapPin className="size-3.5" />Khu vực</p>
                      <p className="mt-2 font-medium">{profileData.province_code ? `${profileData.province_code}${profileData.district_code ? ` · ${profileData.district_code}` : ""}` : "Chưa cập nhật"}</p>
                    </div>
                    <div className="rounded-2xl border bg-background/55 p-4">
                      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Clock3 className="size-3.5" />Đăng nhập cuối</p>
                      <p className="mt-2 font-medium">{dialogAccount.last_login_at ? new Date(dialogAccount.last_login_at).toLocaleString("vi-VN") : "Chưa từng đăng nhập"}</p>
                    </div>
                    <div className="rounded-2xl border bg-background/55 p-4">
                      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"><CalendarDays className="size-3.5" />Ngày tham gia</p>
                      <p className="mt-2 font-medium">{new Date(dialogAccount.created_at).toLocaleString("vi-VN")}</p>
                    </div>
                    <div className="rounded-2xl border bg-background/55 p-4">
                      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"><BadgeCheck className="size-3.5" />Mã tài khoản</p>
                      <p className="mt-2 truncate font-mono text-xs" title={dialogAccount.id}>{dialogAccount.id}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center gap-4 rounded-2xl border bg-emerald-500/5 p-4">
                      <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-700"><HeartHandshake className="size-5" /></div>
                      <div><p className="text-2xl font-bold">{profileData.donation_count || 0}</p><p className="text-xs text-muted-foreground">Lần quyên góp</p></div>
                    </div>
                    <div className="flex items-center gap-4 rounded-2xl border bg-violet-500/5 p-4">
                      <div className="rounded-2xl bg-violet-500/10 p-3 text-violet-700"><Gift className="size-5" /></div>
                      <div><p className="text-2xl font-bold">{profileData.received_count || 0}</p><p className="text-xs text-muted-foreground">Lần nhận hỗ trợ</p></div>
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-muted/30 p-4">
                    <p className="mb-2 font-medium">Giới thiệu</p>
                    <p className="leading-6 text-muted-foreground">{profileData.bio || "Người dùng chưa cập nhật phần giới thiệu."}</p>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground">Không tải được thông tin.</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAccount(null)}>
              Đóng
            </Button>
            {dialogAction !== "view" && (
              <Button
                variant={dialogAction === "lock" ? "destructive" : "default"}
                onClick={handleLockUnlock}
              >
                {dialogAction === "lock" ? "Khóa" : "Mở khóa"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
