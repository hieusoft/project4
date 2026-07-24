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

import { RequestTable } from "@/components/requests/request-table"

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
              <div className="w-[180px]">
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v ?? "all")
                    setPage(1)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {Object.entries({
                      pending: "PENDING",
                      approved: "APPROVED",
                      scheduled: "SCHEDULED",
                      completed: "COMPLETED",
                      rejected: "REJECTED",
                      cancelled: "CANCELLED",
                      no_show: "NO_SHOW"
                    }).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
             <RequestTable 
               requests={requests}
               loading={loading}
               page={page}
               limit={limit}
               onPageChange={setPage}
             />
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
