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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { identityApi } from "@/lib/api/client"
import { Account } from "@/types"
import { Shield, ShieldOff, UsersIcon, EyeIcon } from "lucide-react"

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Active", variant: "default" },
  unverified: { label: "Unverified", variant: "secondary" },
  locked: { label: "Locked", variant: "destructive" },
  deleted: { label: "Deleted", variant: "outline" },
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [dialogAccount, setDialogAccount] = useState<Account | null>(null)
  const [dialogAction, setDialogAction] = useState<"lock" | "unlock" | "view">("lock")
  const [profileData, setProfileData] = useState<any>(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const limit = 20

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit }
      if (statusFilter !== "all") params.status = statusFilter
      const res = await identityApi.listAccounts(params as any)
      setAccounts(res.data.items)
      setTotal(res.data.meta.total)
    } catch (err: any) {
      toast.error("Lỗi tải danh sách tài khoản: " + err.message)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

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

  return (
    <AdminLayout>
      <div className="px-4 lg:px-6">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-2xl font-bold tracking-tight">Quản lý Tài khoản</h2>
          </div>
          <p className="text-muted-foreground mt-1">
            Xem và quản lý tài khoản người dùng
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Danh sách</CardTitle>
              <Badge variant="secondary">{total}</Badge>
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v ?? "all")
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="unverified">Unverified</SelectItem>
                <SelectItem value="locked">Locked</SelectItem>
                <SelectItem value="deleted">Deleted</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Email Verified</TableHead>
                  <TableHead>2FA</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <UsersIcon className="h-8 w-8" />
                        <p>Không tìm thấy tài khoản</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">
                        {account.username}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{account.email || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{account.phone || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statusConfig[account.status]?.variant || "secondary"}>
                          {statusConfig[account.status]?.label || account.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={account.email_verified ? "default" : "secondary"}>
                          {account.email_verified ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={account.totp_enabled ? "default" : "secondary"}>
                          {account.totp_enabled ? "On" : "Off"}
                        </Badge>
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
                  ))
                )}
              </TableBody>
            </Table>

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
        <DialogContent>
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
              ) : profileData ? (
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-muted-foreground mb-1">Họ và tên</p>
                      <p className="font-medium">{profileData.full_name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Username</p>
                      <p className="font-medium">@{profileData.username}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Điểm uy tín</p>
                      <p className="font-medium text-emerald-600">{profileData.reputation_score}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Khu vực</p>
                      <p className="font-medium">{profileData.province_code ? profileData.province_code + (profileData.district_code ? ` - ${profileData.district_code}` : "") : "—"}</p>
                    </div>
                  </div>
                  
                  <div className="bg-muted p-4 rounded-lg flex items-center justify-around text-center mt-4">
                    <div>
                      <p className="text-2xl font-semibold">{profileData.donation_count || 0}</p>
                      <p className="text-xs text-muted-foreground">Đã quyên góp</p>
                    </div>
                    <div>
                      <p className="text-2xl font-semibold">{profileData.received_count || 0}</p>
                      <p className="text-xs text-muted-foreground">Đã nhận</p>
                    </div>
                  </div>
                  
                  {profileData.bio && (
                    <div className="mt-4">
                      <p className="text-muted-foreground mb-1">Tiểu sử</p>
                      <p className="bg-secondary p-3 rounded text-secondary-foreground">{profileData.bio}</p>
                    </div>
                  )}
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
