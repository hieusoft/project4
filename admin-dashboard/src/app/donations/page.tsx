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

export default function DonationsPage() {
  const [donations, setDonations] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [detailDonation, setDetailDonation] = useState<any | null>(null)
  const limit = 20

  const fetchDonations = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit }
      if (statusFilter !== "all") params.status = statusFilter
      const res = await donationApi.listDonations(params)
      
      const items = res.data.items || []
      
      // Fetch donor profiles
      const itemsWithProfiles = await Promise.all(
        items.map(async (donation: any) => {
          try {
             if (!donation.donor_id) return donation;
             const profileRes = await identityApi.getProfile(donation.donor_id)
             return { ...donation, donorProfile: profileRes.data }
          } catch (e) {
             return donation
          }
        })
      )
      
      setDonations(itemsWithProfiles)
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
      const data = res.data
      
      // Fetch donor profile for detail
      if (data.donor_id) {
         try {
           const profileRes = await identityApi.getProfile(data.donor_id)
           data.donorProfile = profileRes.data
         } catch(e) {}
      }
      
      setDetailDonation(data)
    } catch (err: any) {
      toast.error("Lỗi tải chi tiết: " + err.message)
    }
  }

  async function handleAction(action: "accept" | "reject" | "schedule" | "cancel", payload?: any) {
    if (!detailDonation) return
    
    try {
      if (action === "accept" || action === "reject") {
        await donationApi.reviewDonation(detailDonation.id, action)
        toast.success(`Đã ${action === "accept" ? "chấp nhận" : "từ chối"} đơn quyên góp!`)
      } else if (action === "schedule") {
        await donationApi.scheduleDonation(detailDonation.id, payload.scheduled_at)
        toast.success(`Đã hẹn lịch thành công!`)
      } else if (action === "cancel") {
        await donationApi.cancelDonation(detailDonation.id)
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
      />
    </AdminLayout>
  )
}
