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
import { Shield, ShieldOff, UsersIcon, SearchIcon } from "lucide-react"

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
  const [dialogAction, setDialogAction] = useState<"lock" | "unlock">("lock")
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
                <SelectItem value="all">Tất cả</SelectItem>
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
                        {account.status === "locked" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setDialogAccount(account)
                              setDialogAction("unlock")
                            }}
                          >
                            <ShieldOff className="h-4 w-4 mr-1" />
                            Mở khóa
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
                            <Shield className="h-4 w-4 mr-1" />
                            Khóa
                          </Button>
                        ) : null}
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
              {dialogAction === "lock" ? "Khóa tài khoản" : "Mở khóa tài khoản"}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === "lock"
                ? `Bạn có chắc muốn khóa tài khoản "${dialogAccount?.username}"? Tất cả session sẽ bị đăng xuất.`
                : `Bạn có chắc muốn mở khóa tài khoản "${dialogAccount?.username}"?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAccount(null)}>
              Hủy
            </Button>
            <Button
              variant={dialogAction === "lock" ? "destructive" : "default"}
              onClick={handleLockUnlock}
            >
              {dialogAction === "lock" ? "Khóa" : "Mở khóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
