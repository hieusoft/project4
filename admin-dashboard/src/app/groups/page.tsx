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
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { communityApi } from "@/lib/api/client"
import { Group } from "@/types"
import { CheckCircle, XCircle, Search, HeartHandshakeIcon } from "lucide-react"

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Active", variant: "default" },
  pending: { label: "Pending", variant: "secondary" },
  suspended: { label: "Suspended", variant: "destructive" },
  closed: { label: "Closed", variant: "outline" },
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [dialogGroup, setDialogGroup] = useState<Group | null>(null)
  const [dialogAction, setDialogAction] = useState<"approve" | "suspend">("approve")
  const limit = 20

  const fetchGroups = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit }
      if (statusFilter !== "all") params.status = statusFilter
      if (searchQuery) params.q = searchQuery
      const res = await communityApi.listGroups(params)
      setGroups(res.data.items)
      setTotal(res.data.meta.total)
    } catch (err: any) {
      toast.error("Lỗi tải danh sách nhóm: " + err.message)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, searchQuery])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  async function handleAction() {
    if (!dialogGroup) return
    try {
      if (dialogAction === "approve") {
        await communityApi.approveGroup(dialogGroup.id)
        toast.success(`Đã duyệt nhóm "${dialogGroup.name}"`)
      } else {
        await communityApi.suspendGroup(dialogGroup.id)
        toast.success(`Đã đình chỉ nhóm "${dialogGroup.name}"`)
      }
      setDialogGroup(null)
      fetchGroups()
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
            <HeartHandshakeIcon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-2xl font-bold tracking-tight">Nhóm thiện nguyện</h2>
          </div>
          <p className="text-muted-foreground mt-1">
            Quản lý các nhóm thiện nguyện
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Danh sách</CardTitle>
              <Badge variant="secondary">{total}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm nhóm..."
                  className="pl-8 w-[200px]"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setPage(1)
                  }}
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v ?? "all")
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên nhóm</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Thành viên</TableHead>
                  <TableHead>Đánh giá</TableHead>
                  <TableHead>Ngày tạo</TableHead>
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
                ) : groups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <HeartHandshakeIcon className="h-8 w-8" />
                        <p>Không tìm thấy nhóm</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  groups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell className="font-medium">{group.name}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-sm">
                        {group.slug}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig[group.status]?.variant || "secondary"}>
                          {statusConfig[group.status]?.label || group.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">{group.member_count}</TableCell>
                      <TableCell className="tabular-nums">{group.reputation_score}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(group.created_at).toLocaleDateString("vi-VN")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {group.status === "pending" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setDialogGroup(group)
                                setDialogAction("approve")
                              }}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Duyệt
                            </Button>
                          )}
                          {group.status === "active" && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setDialogGroup(group)
                                setDialogAction("suspend")
                              }}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Đình chỉ
                            </Button>
                          )}
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
        open={!!dialogGroup}
        onOpenChange={() => setDialogGroup(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === "approve" ? "Duyệt nhóm" : "Đình chỉ nhóm"}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === "approve"
                ? `Duyệt nhóm "${dialogGroup?.name}"? Nhóm sẽ hiển thị công khai.`
                : `Đình chỉ nhóm "${dialogGroup?.name}"? Nhóm sẽ bị ẩn khỏi danh sách.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogGroup(null)}>
              Hủy
            </Button>
            <Button
              variant={dialogAction === "approve" ? "default" : "destructive"}
              onClick={handleAction}
            >
              {dialogAction === "approve" ? "Duyệt" : "Đình chỉ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
