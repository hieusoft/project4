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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { donationApi } from "@/lib/api/client"
import { Donation } from "@/types"
import { Eye, PackageIcon, Package } from "lucide-react"

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Chờ duyệt", variant: "secondary" },
  accepted: { label: "Đã chấp nhận", variant: "default" },
  scheduled: { label: "Đã hẹn lịch", variant: "secondary" },
  received: { label: "Đã nhận", variant: "default" },
  completed: { label: "Hoàn thành", variant: "default" },
  rejected: { label: "Bị từ chối", variant: "destructive" },
  cancelled: { label: "Đã hủy", variant: "outline" },
}

export default function DonationsPage() {
  const [donations, setDonations] = useState<Donation[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [detailDonation, setDetailDonation] = useState<Donation | null>(null)
  const limit = 20

  const fetchDonations = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit }
      if (statusFilter !== "all") params.status = statusFilter
      const res = await donationApi.listDonations(params)
      setDonations(res.data.items)
      setTotal(res.data.meta.total)
    } catch (err: any) {
      toast.error("Lỗi tải danh sách quyên góp: " + err.message)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => {
    fetchDonations()
  }, [fetchDonations])

  async function viewDetail(donation: Donation) {
    try {
      const res = await donationApi.getDonation(donation.id)
      setDetailDonation(res.data)
    } catch (err: any) {
      toast.error("Lỗi tải chi tiết: " + err.message)
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <AdminLayout>
      <div className="px-4 lg:px-6">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <PackageIcon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-2xl font-bold tracking-tight">Quyên góp</h2>
          </div>
          <p className="text-muted-foreground mt-1">
            Theo dõi và quản lý các đơn quyên góp
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
                <SelectItem value="pending">Chờ duyệt</SelectItem>
                <SelectItem value="accepted">Đã chấp nhận</SelectItem>
                <SelectItem value="scheduled">Đã hẹn lịch</SelectItem>
                <SelectItem value="completed">Hoàn thành</SelectItem>
                <SelectItem value="rejected">Bị từ chối</SelectItem>
                <SelectItem value="cancelled">Đã hủy</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã đơn</TableHead>
                  <TableHead>Tiêu đề</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Vật phẩm</TableHead>
                  <TableHead>Phương thức</TableHead>
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
                ) : donations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <PackageIcon className="h-8 w-8" />
                        <p>Không tìm thấy đơn quyên góp</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  donations.map((donation) => (
                    <TableRow key={donation.id}>
                      <TableCell className="font-mono text-sm">
                        {donation.code}
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {donation.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig[donation.status]?.variant || "secondary"}>
                          {statusConfig[donation.status]?.label || donation.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">{donation.items?.length || 0} mục</TableCell>
                      <TableCell className="text-muted-foreground">
                        {donation.pickup_method === "pickup" ? "Giao tận nơi" : "Mang đến"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(donation.created_at).toLocaleDateString("vi-VN")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewDetail(donation)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Chi tiết
                        </Button>
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
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Trước
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Sau
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!detailDonation} onOpenChange={() => setDetailDonation(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {detailDonation?.code} — {detailDonation?.title}
            </DialogTitle>
            <DialogDescription>Chi tiết đơn quyên góp</DialogDescription>
          </DialogHeader>
          {detailDonation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Trạng thái:</span>{" "}
                  <Badge variant={statusConfig[detailDonation.status]?.variant || "secondary"}>
                    {statusConfig[detailDonation.status]?.label || detailDonation.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Phương thức:</span>{" "}
                  {detailDonation.pickup_method === "pickup" ? "Giao tận nơi" : "Mang đến"}
                </div>
                <div>
                  <span className="text-muted-foreground">Địa chỉ:</span>{" "}
                  {detailDonation.pickup_address || "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Lịch hẹn:</span>{" "}
                  {detailDonation.scheduled_at
                    ? new Date(detailDonation.scheduled_at).toLocaleString("vi-VN")
                    : "Chưa hẹn"}
                </div>
              </div>

              {detailDonation.description && (
                <div>
                  <span className="text-sm text-muted-foreground">Mô tả:</span>
                  <p className="text-sm mt-1">{detailDonation.description}</p>
                </div>
              )}

              {detailDonation.items && detailDonation.items.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Vật phẩm ({detailDonation.items.length})</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tên</TableHead>
                        <TableHead>SL</TableHead>
                        <TableHead>Tình trạng</TableHead>
                        <TableHead>Trạng thái</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailDonation.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.name}</TableCell>
                          <TableCell className="tabular-nums">{item.quantity}</TableCell>
                          <TableCell>{item.condition_declared}</TableCell>
                          <TableCell>
                            <Badge variant={statusConfig[item.status]?.variant || "secondary"}>
                              {item.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
