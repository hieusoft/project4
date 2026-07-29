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
import { donationApi, identityApi } from "@/lib/api/client"
import { Donation, DonationWithDonor, Profile } from "@/types"
import { CheckCircle2, Clock3, PackageCheck, PackageIcon, Search, XCircle } from "lucide-react"

import { DonationTable } from "@/components/donations/donation-table"
import { DonationDetailsDialog } from "@/components/donations/donation-details-dialog"
import { useAuth } from "@/context/auth-context"

export default function DonationsPage() {
  const { currentUser } = useAuth()
  const [donations, setDonations] = useState<DonationWithDonor[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [detailDonation, setDetailDonation] = useState<DonationWithDonor | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusTotals, setStatusTotals] = useState<Record<string, number>>({})
  const limit = 20

  const fetchDonations = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit }
      if (statusFilter !== "all") params.status = statusFilter
      const res = await donationApi.listDonations(params)
      const items = res.data.items as Donation[]
      let profiles: Record<string, Profile> = {}
      if (items.length > 0) {
        const profileRes = await identityApi.getProfilesBatch([...new Set(items.map((item) => item.donor_id))])
        profiles = Object.fromEntries(profileRes.data.map((profile) => [profile.id, profile]))
      }
      setDonations(items.map((donation) => ({ ...donation, donorProfile: profiles[donation.donor_id] })))
      setTotal(res.data.meta.total)
    } catch (err: any) {
      toast.error("Lỗi tải danh sách quyên góp: " + err.message)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  const fetchStatusTotals = useCallback(async () => {
    const statuses = ["pending", "accepted", "scheduled", "received", "completed", "rejected", "cancelled"]
    const results = await Promise.allSettled(statuses.map((status) => donationApi.listDonations({ status, limit: 1 })))
    setStatusTotals(Object.fromEntries(statuses.map((status, index) => [status, results[index].status === "fulfilled" ? results[index].value.data.meta.total : 0])))
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDonations()
    fetchStatusTotals()
  }, [fetchDonations, fetchStatusTotals])

  async function viewDetail(donation: Donation) {
    try {
      const res = await donationApi.getDonation(donation.id)
      const data = res.data as DonationWithDonor
      
      // Fetch donor profile for detail
      if (data.donor_id) {
         try {
           const profileRes = await identityApi.getProfile(data.donor_id)
           data.donorProfile = profileRes.data
         } catch {}
      }
      
      setDetailDonation(data)
    } catch (err: any) {
      toast.error("Lỗi tải chi tiết: " + err.message)
    }
  }

  async function handleAction(action: "accepted" | "rejected" | "schedule" | "cancel", payload?: Record<string, any>) {
    if (!detailDonation) return
    
    try {
      if (action === "accepted" || action === "rejected") {
        await donationApi.reviewDonation(detailDonation.id, action, payload?.note as string | undefined)
        toast.success(`Đã ${action === "accepted" ? "chấp nhận" : "từ chối"} đơn quyên góp!`)
      } else if (action === "schedule") {
        await donationApi.scheduleDonation(detailDonation.id, payload?.scheduled_at as string)
        toast.success(`Đã hẹn lịch thành công!`)
      } else if (action === "cancel") {
        await donationApi.cancelDonation(detailDonation.id)
        toast.success(`Đã hủy đơn quyên góp!`)
      }
      
      // Refresh list and close dialog
      setDetailDonation(null)
      fetchDonations()
      fetchStatusTotals()
    } catch (err: any) {
      toast.error(`Lỗi thực hiện thao tác: ${err.message}`)
    }
  }

  const normalizedSearch = searchQuery.trim().toLowerCase()
  const visibleDonations = normalizedSearch ? donations.filter((donation) => [donation.code, donation.title, donation.donorProfile?.full_name, donation.donorProfile?.username].some((value) => value?.toLowerCase().includes(normalizedSearch))) : donations

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="rounded-[1.75rem] border bg-card/80 p-5 shadow-sm backdrop-blur">
          <div className="flex items-center gap-2">
            <PackageIcon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-2xl font-bold tracking-tight">Quyên góp</h2>
          </div>
          <p className="text-muted-foreground mt-1">
            Theo dõi, xét duyệt và quản lý các đơn quyên góp
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { key: "pending", label: "Chờ duyệt", value: statusTotals.pending || 0, icon: Clock3, tone: "bg-amber-500/10 text-amber-700" },
            { key: "accepted", label: "Đã chấp nhận", value: statusTotals.accepted || 0, icon: CheckCircle2, tone: "bg-blue-500/10 text-blue-700" },
            { key: "completed", label: "Hoàn thành", value: statusTotals.completed || 0, icon: PackageCheck, tone: "bg-emerald-500/10 text-emerald-700" },
            { key: "rejected", label: "Đã từ chối", value: statusTotals.rejected || 0, icon: XCircle, tone: "bg-red-500/10 text-red-700" },
          ].map((item) => <button type="button" key={item.key} onClick={() => { setStatusFilter(item.key); setPage(1) }} className={`admin-surface flex items-center justify-between p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${statusFilter === item.key ? "ring-2 ring-primary/35" : ""}`}><div><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{item.value.toLocaleString("vi-VN")}</p></div><div className={`rounded-2xl p-3 ${item.tone}`}><item.icon className="size-5" /></div></button>)}
        </div>

        <Card className="admin-surface">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Danh sách</CardTitle>
              <Badge variant="secondary">{total}</Badge>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="relative flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Tìm mã đơn, tiêu đề, người tặng..." className="w-full pl-9 sm:w-[280px]" /></div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v ?? "all")
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="all">Tất cả trạng thái</SelectItem>
                  <SelectItem value="pending">Chờ duyệt</SelectItem>
                  <SelectItem value="accepted">Đã chấp nhận</SelectItem>
                  <SelectItem value="scheduled">Đã hẹn lịch</SelectItem>
                  <SelectItem value="received">Đã nhận</SelectItem>
                  <SelectItem value="completed">Hoàn thành</SelectItem>
                  <SelectItem value="rejected">Đã từ chối</SelectItem>
                  <SelectItem value="cancelled">Đã hủy</SelectItem>
              </SelectContent>
            </Select>
            </div>
          </CardHeader>
          <CardContent>
            <DonationTable
              donations={visibleDonations}
              loading={loading}
              total={total}
              page={page}
              limit={limit}
              onPageChange={setPage}
              onViewClick={viewDetail}
            />
          </CardContent>
        </Card>
      </div>

      <DonationDetailsDialog
        detailDonation={detailDonation}
        onClose={() => setDetailDonation(null)}
        onAction={handleAction}
        currentUser={currentUser as Record<string, any> | null}
      />
    </AdminLayout>
  )
}
