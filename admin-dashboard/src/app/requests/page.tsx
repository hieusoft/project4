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
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { marketplaceApi, identityApi, communityApi } from "@/lib/api/client"
import { CalendarClock, CheckCircle2, HandHeartIcon, Search, UserCheck, UserX } from "lucide-react"
import { DeliveryConfirmation, Group, ItemRequest, ItemRequestWithRelations, Listing, Profile } from "@/types"

import { RequestTable } from "@/components/requests/request-table"
import { RequestDetailsDialog } from "@/components/requests/request-details-dialog"

export default function RequestsPage() {
  const [requests, setRequests] = useState<ItemRequestWithRelations[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [detailRequest, setDetailRequest] = useState<ItemRequestWithRelations | null>(null)
  const [confirmation, setConfirmation] = useState<DeliveryConfirmation | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusTotals, setStatusTotals] = useState<Record<string, number>>({})
  const limit = 20

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit }
      if (statusFilter !== "all") params.status = statusFilter
      const res = await marketplaceApi.getRequests(params) as unknown as { data: ItemRequest[]; meta: { total: number } }
      const items = res.data || []
      const receiverIds = [...new Set(items.map((item) => item.receiver_id))]
      const groupIds = [...new Set(items.map((item) => item.group_id))]
      const listingIds = [...new Set(items.map((item) => item.listing_id))]
      const [profileResult, groupResults, listingResults] = await Promise.all([
        receiverIds.length > 0 ? identityApi.getProfilesBatch(receiverIds) : Promise.resolve({ data: [] }),
        Promise.allSettled(groupIds.map((id) => communityApi.getGroup(id))),
        Promise.allSettled(listingIds.map((id) => marketplaceApi.getListing(id))),
      ])
      const profiles = Object.fromEntries(profileResult.data.map((profile: Profile) => [profile.id, profile]))
      const groups = Object.fromEntries(groupResults.flatMap((result) => result.status === "fulfilled" ? [[result.value.data.id, result.value.data as Group]] : []))
      const listings = Object.fromEntries(listingResults.flatMap((result) => result.status === "fulfilled" ? [[result.value.data.id, result.value.data as Listing]] : []))
      setRequests(items.map((request) => ({ ...request, receiverProfile: profiles[request.receiver_id], group: groups[request.group_id], listing: listings[request.listing_id] })))
      setTotal(res.meta?.total || 0)
    } catch (err: any) {
      toast.error("Lỗi tải danh sách yêu cầu: " + err.message)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  const fetchStatusTotals = useCallback(async () => {
    const statuses = ["pending", "approved", "scheduled", "completed", "rejected", "cancelled", "no_show"]
    const results = await Promise.allSettled(statuses.map((status) => marketplaceApi.getRequests({ status, limit: 1 })))
    setStatusTotals(Object.fromEntries(statuses.map((status, index) => {
      const result = results[index]
      return [status, result.status === "fulfilled" ? ((result.value as unknown as { meta?: { total?: number } }).meta?.total || 0) : 0]
    })))
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRequests()
    fetchStatusTotals()
  }, [fetchRequests, fetchStatusTotals])

  async function handleViewRequest(req: ItemRequestWithRelations) {
    setDetailRequest(req)
    setConfirmation(null)
    try {
      if (req.status === "completed") {
        const confRes = await marketplaceApi.getRequestConfirmation(req.id)
        if (confRes.data) {
          setConfirmation(confRes.data as DeliveryConfirmation)
        }
      }
    } catch (err: any) {
      console.warn("Could not fetch delivery confirmation", err)
    }
  }

  const normalizedSearch = searchQuery.trim().toLowerCase()
  const visibleRequests = normalizedSearch ? requests.filter((request) => [request.code, request.reason, request.receiverProfile?.full_name, request.receiverProfile?.username, request.group?.name, request.listing?.title].some((value) => value?.toLowerCase().includes(normalizedSearch))) : requests

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="rounded-[1.75rem] border bg-card/80 p-5 shadow-sm backdrop-blur">
          <div className="flex items-center gap-2">
            <HandHeartIcon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-2xl font-bold tracking-tight">Yêu cầu nhận đồ</h2>
          </div>
          <p className="text-muted-foreground mt-1">
            Theo dõi danh sách xin nhận đồ từ Gian hàng 0 đồng trên toàn hệ thống
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { key: "pending", label: "Chờ duyệt", value: statusTotals.pending || 0, icon: CalendarClock, tone: "bg-amber-500/10 text-amber-700" },
            { key: "approved", label: "Đã duyệt", value: statusTotals.approved || 0, icon: UserCheck, tone: "bg-blue-500/10 text-blue-700" },
            { key: "completed", label: "Đã bàn giao", value: statusTotals.completed || 0, icon: CheckCircle2, tone: "bg-emerald-500/10 text-emerald-700" },
            { key: "rejected", label: "Đã từ chối", value: statusTotals.rejected || 0, icon: UserX, tone: "bg-red-500/10 text-red-700" },
          ].map((item) => <button type="button" key={item.key} onClick={() => { setStatusFilter(item.key); setPage(1) }} className={`admin-surface flex items-center justify-between p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${statusFilter === item.key ? "ring-2 ring-primary/35" : ""}`}><div><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{item.value.toLocaleString("vi-VN")}</p></div><div className={`rounded-2xl p-3 ${item.tone}`}><item.icon className="size-5" /></div></button>)}
        </div>

        <Card className="admin-surface">
          <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Danh sách yêu cầu</CardTitle>
              <Badge variant="secondary">{total}</Badge>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
              <div className="relative flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Tìm mã, người nhận, món đồ..." className="w-full pl-9 sm:w-[280px]" /></div>
              <div className="w-full sm:w-[180px]">
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
                    <SelectItem value="all">Tất cả trạng thái</SelectItem>
                    {Object.entries({
                       pending: "Chờ duyệt",
                       approved: "Đã duyệt",
                       scheduled: "Đã hẹn lịch",
                       completed: "Đã bàn giao",
                       rejected: "Đã từ chối",
                       cancelled: "Đã hủy",
                       no_show: "Không đến nhận"
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
               requests={visibleRequests}
               loading={loading}
               page={page}
                limit={limit}
                total={total}
               onPageChange={setPage}
               onViewClick={handleViewRequest}
             />
          </CardContent>
        </Card>
      </div>

      <RequestDetailsDialog
        detailRequest={detailRequest}
        confirmation={confirmation}
        onClose={() => setDetailRequest(null)}
      />
    </AdminLayout>
  )
}
