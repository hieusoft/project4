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
import { donationApi, identityApi } from "@/lib/api/client"
import { Donation } from "@/types"
import { PackageIcon } from "lucide-react"

import { DonationTable } from "@/components/donations/donation-table"
import { DonationDetailsDialog } from "@/components/donations/donation-details-dialog"
import { useAuth } from "@/context/auth-context"

export default function DonationsPage() {
  const { currentUser } = useAuth()
  const [donations, setDonations] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [detailDonation, setDetailDonation] = useState<Record<string, any> | null>(null)
  const limit = 20

  const fetchDonations = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit }
      if (statusFilter !== "all") params.status = statusFilter
      const res = await donationApi.listDonations(params) as Record<string, any>
      
      const items = (res.data as any)?.items as any[] || []
      
      // Fetch donor profiles
      const itemsWithProfiles = await Promise.all(
        items.map(async (donation: any) => {
          const d = donation as Record<string, any>;
          try {
             if (!d.donor_id) return d;
             const profileRes = await identityApi.getProfile(d.donor_id as string) as Record<string, any>
             return { ...d, donorProfile: profileRes.data }
          } catch {
             return d
          }
        })
      )
      
      setDonations(itemsWithProfiles)
      setTotal(((res.data as any)?.meta as any)?.total as number)
    } catch (err: any) {
      toast.error("Lỗi tải danh sách quyên góp: " + err.message)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDonations()
  }, [fetchDonations])

  async function viewDetail(donation: Donation) {
    try {
      const res = await donationApi.getDonation(donation.id) as Record<string, any>
      const data = res.data as Record<string, any>
      
      // Fetch donor profile for detail
      if (data.donor_id) {
         try {
           const profileRes = await identityApi.getProfile(data.donor_id as string) as Record<string, any>
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
        await donationApi.reviewDonation(detailDonation.id as string, action, payload?.note as string | undefined)
        toast.success(`Đã ${action === "accepted" ? "chấp nhận" : "từ chối"} đơn quyên góp!`)
      } else if (action === "schedule") {
        await donationApi.scheduleDonation(detailDonation.id as string, payload?.scheduled_at as string)
        toast.success(`Đã hẹn lịch thành công!`)
      } else if (action === "cancel") {
        await donationApi.cancelDonation(detailDonation.id as string)
        toast.success(`Đã hủy đơn quyên góp!`)
      }
      
      // Refresh list and close dialog
      setDetailDonation(null)
      fetchDonations()
    } catch (err: any) {
      toast.error(`Lỗi thực hiện thao tác: ${err.message}`)
    }
  }

  return (
    <AdminLayout>
      <div className="px-4 lg:px-6">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <PackageIcon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-2xl font-bold tracking-tight">Quyên góp</h2>
          </div>
          <p className="text-muted-foreground mt-1">
            Theo dõi, xét duyệt và quản lý các đơn quyên góp
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
                  <SelectItem value="pending">PENDING</SelectItem>
                  <SelectItem value="accepted">ACCEPTED</SelectItem>
                  <SelectItem value="scheduled">SCHEDULED</SelectItem>
                  <SelectItem value="received">RECEIVED</SelectItem>
                  <SelectItem value="rejected">REJECTED</SelectItem>
                  <SelectItem value="cancelled">CANCELLED</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <DonationTable
              donations={donations}
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
