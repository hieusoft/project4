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
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { marketplaceApi, identityApi, communityApi } from "@/lib/api/client"
import { Search, ShoppingBagIcon } from "lucide-react"

import { ListingTable } from "@/components/listings/listing-table"
import { ListingDetailsDialog } from "@/components/listings/listing-details-dialog"

export default function ListingsPage() {
  const [listings, setListings] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [detailListing, setDetailListing] = useState<any | null>(null)
  const limit = 20

  const fetchListings = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit }
      if (statusFilter !== "all") params.status = statusFilter
      if (searchQuery) params.search = searchQuery
      const res = await marketplaceApi.getListings(params) as any
      const items = Array.isArray(res.data) ? res.data : (res.data?.items || [])
      
      // Fetch owner profiles (users or groups)
      const itemsWithProfiles = await Promise.all(
        items.map(async (listing: any) => {
          try {
            if (listing.group_id) {
               const groupRes = await communityApi.getGroup(listing.group_id)
               return { ...listing, ownerProfile: groupRes.data }
            } else if (listing.user_id) {
               const profileRes = await identityApi.getProfile(listing.user_id)
               return { ...listing, ownerProfile: profileRes.data }
            }
            return listing
          } catch (e) {
             return listing
          }
        })
      )

      const totalCount = res.meta?.total ?? res.data?.meta?.total ?? 0
      setListings(itemsWithProfiles)
      setTotal(totalCount)
    } catch (err: any) {
      toast.error("Lỗi tải danh sách gian hàng: " + err.message)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, searchQuery])

  useEffect(() => {
    fetchListings()
  }, [fetchListings])

  async function viewDetail(listing: any) {
    try {
      // First try to get from getListing for full details including images
      let data = { ...listing }
      try {
        const res = await marketplaceApi.getListing(listing.id)
        if (res.data) {
           data = { ...data, ...res.data }
        }
      } catch (e) {
        console.warn("Could not fetch full listing details", e)
      }
      
      setDetailListing(data)
    } catch (err: any) {
      toast.error("Lỗi xem chi tiết: " + err.message)
    }
  }

  async function handleCloseListing() {
    if (!detailListing) return
    if (!confirm("Bạn có chắc chắn muốn đóng (khóa) tin đăng này?")) return
    
    try {
      await marketplaceApi.closeListing(detailListing.id, "Bị khóa bởi Admin")
      toast.success("Đã đóng tin đăng thành công!")
      setDetailListing(null)
      fetchListings()
    } catch (err: any) {
      toast.error(`Lỗi thao tác: ${err.message}`)
    }
  }

  return (
    <AdminLayout>
      <div className="px-4 lg:px-6">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <ShoppingBagIcon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-2xl font-bold tracking-tight">Gian hàng 0 đồng</h2>
          </div>
          <p className="text-muted-foreground mt-1">
            Quản lý, theo dõi và kiểm duyệt các tin đăng
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
                  placeholder="Tìm kiếm..."
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
                  <SelectItem value="reserved">Reserved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
             <ListingTable
                listings={listings}
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
      
      <ListingDetailsDialog
         detailListing={detailListing}
         onClose={() => setDetailListing(null)}
         onCloseListing={handleCloseListing}
      />
    </AdminLayout>
  )
}
