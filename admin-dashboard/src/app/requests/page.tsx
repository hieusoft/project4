"use client"

import { AdminLayout } from "@/components/admin-layout"
import { useEffect, useState, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { marketplaceApi, identityApi, communityApi } from "@/lib/api/client"
import { HandHeartIcon } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function RequestsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const limit = 20

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit }
      if (statusFilter !== "all") params.status = statusFilter
      const res = await marketplaceApi.getRequests(params) as any
      const items = Array.isArray(res.data) ? res.data : (res.data?.items || [])
      
      const enriched = await Promise.all(
        items.map(async (req: any) => {
          let receiverProfile = null
          let groupProfile = null
          
          try {
            if (req.receiver_id) {
               const pRes = await identityApi.getProfile(req.receiver_id)
               receiverProfile = pRes.data
            }
          } catch (e) {}

          try {
            if (req.group_id) {
               const gRes = await communityApi.getGroup(req.group_id)
               groupProfile = gRes.data
            }
          } catch (e) {}

          return { ...req, receiverProfile, groupProfile }
        })
      )

      const totalCount = res.meta?.total ?? res.data?.meta?.total ?? 0
      setRequests(enriched)
      setTotal(totalCount)
    } catch (err: any) {
      toast.error("Lỗi tải danh sách yêu cầu: " + err.message)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="outline" className="text-yellow-500">Chờ duyệt</Badge>
      case "approved": return <Badge variant="default" className="bg-blue-500">Đã duyệt</Badge>
      case "completed": return <Badge variant="default" className="bg-emerald-500">Hoàn thành</Badge>
      case "rejected": return <Badge variant="destructive">Từ chối</Badge>
      case "cancelled": return <Badge variant="secondary">Đã hủy</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <AdminLayout>
      <div className="px-4 lg:px-6">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <HandHeartIcon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-2xl font-bold tracking-tight">Yêu cầu nhận đồ</h2>
          </div>
          <p className="text-muted-foreground mt-1">
            Theo dõi danh sách xin nhận đồ từ Gian hàng 0 đồng trên toàn hệ thống
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Danh sách yêu cầu</CardTitle>
              <Badge variant="secondary">{total}</Badge>
            </div>
            <div className="flex items-center gap-2">
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
                  <SelectItem value="pending">Chờ duyệt</SelectItem>
                  <SelectItem value="approved">Đã duyệt</SelectItem>
                  <SelectItem value="completed">Hoàn thành</SelectItem>
                  <SelectItem value="rejected">Từ chối</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
             <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã YC</TableHead>
                      <TableHead>Người nhận</TableHead>
                      <TableHead>Lý do</TableHead>
                      <TableHead>Nhóm xử lý</TableHead>
                      <TableHead>Số lượng</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Ngày tạo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">Đang tải...</TableCell>
                      </TableRow>
                    ) : requests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">Không có yêu cầu nào.</TableCell>
                      </TableRow>
                    ) : (
                      requests.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.code || "N/A"}</TableCell>
                          <TableCell>
                            {r.receiverProfile ? (
                              <div>
                                <p className="font-medium">{r.receiverProfile.full_name}</p>
                                <p className="text-xs text-muted-foreground">{r.receiverProfile.email || r.receiverProfile.phone || r.receiver_id}</p>
                              </div>
                            ) : (
                              <span className="text-xs">{r.receiver_id}</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate" title={r.reason}>
                            {r.reason || "—"}
                          </TableCell>
                          <TableCell>
                            {r.groupProfile ? r.groupProfile.name : "N/A"}
                          </TableCell>
                          <TableCell>{r.quantity}</TableCell>
                          <TableCell>{getStatusBadge(r.status)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(r.created_at).toLocaleDateString("vi-VN")}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
             </div>
             <div className="flex items-center justify-end space-x-2 mt-4">
               <button
                 className="px-3 py-1 text-sm border rounded hover:bg-muted disabled:opacity-50"
                 disabled={page === 1}
                 onClick={() => setPage(page - 1)}
               >
                 Trước
               </button>
               <span className="text-sm">Trang {page}</span>
               <button
                 className="px-3 py-1 text-sm border rounded hover:bg-muted disabled:opacity-50"
                 disabled={requests.length < limit}
                 onClick={() => setPage(page + 1)}
               >
                 Sau
               </button>
             </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
