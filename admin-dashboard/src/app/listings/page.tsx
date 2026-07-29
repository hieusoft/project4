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
import { Ban, CheckCircle2, Clock3, Search, ShoppingBagIcon } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { Group, InventoryCategory, Listing, ListingWithRelations, Profile } from "@/types"
import { donationApi } from "@/lib/api/client"

import { ListingTable } from "@/components/listings/listing-table"
import { ListingDetailsDialog } from "@/components/listings/listing-details-dialog"

export default function ListingsPage() {
  const { currentUser } = useAuth()
  const [listings, setListings] = useState<ListingWithRelations[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [detailListing, setDetailListing] = useState<ListingWithRelations | null>(null)
  const [statusTotals, setStatusTotals] = useState<Record<string, number>>({})
  const [categories, setCategories] = useState<Record<string, InventoryCategory>>({})
  const limit = 20

  const fetchListings = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit }
      if (statusFilter !== "all") params.status = statusFilter
      if (searchQuery) params.search = searchQuery
      const res = await marketplaceApi.getListings(params) as unknown as { data: Listing[]; meta: { total: number } }
      const items = res.data || []
      const groupIds = [...new Set(items.map((item) => item.group_id).filter(Boolean))]
      const creatorIds = [...new Set(items.map((item) => item.created_by).filter(Boolean))]
      const [groupResults, profileResult] = await Promise.all([
        Promise.allSettled(groupIds.map((id) => communityApi.getGroup(id))),
        creatorIds.length > 0 ? identityApi.getProfilesBatch(creatorIds) : Promise.resolve({ data: [] }),
      ])
      const groups = Object.fromEntries(groupResults.flatMap((result) => result.status === "fulfilled" ? [[result.value.data.id, result.value.data as Group]] : []))
      const profiles = Object.fromEntries(profileResult.data.map((profile: Profile) => [profile.id, profile]))
      setListings(items.map((listing) => ({ ...listing, group: groups[listing.group_id], creatorProfile: profiles[listing.created_by], category: categories[listing.category_id] })))
      setTotal(res.meta?.total || 0)
    } catch (err: any) {
      toast.error("Lỗi tải danh sách gian hàng: " + err.message)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, searchQuery, categories])

  const fetchMetadata = useCallback(async () => {
    const statuses = ["active", "reserved", "closed", "blocked"]
    const [categoryResult, ...statusResults] = await Promise.allSettled([
      donationApi.listCategories(),
      ...statuses.map((status) => marketplaceApi.getListings({ status, limit: 1 })),
    ])
    if (categoryResult.status === "fulfilled") {
      setCategories(Object.fromEntries(categoryResult.value.data.map((category: InventoryCategory) => [category.id, category])))
    }
    setStatusTotals(Object.fromEntries(statuses.map((status, index) => {
      const result = statusResults[index]
      return [status, result.status === "fulfilled" ? ((result.value as unknown as { meta?: { total?: number } }).meta?.total || 0) : 0]
    })))
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchListings()
  }, [fetchListings])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMetadata()
  }, [fetchMetadata])

  async function viewDetail(listing: ListingWithRelations) {
    try {
      // First try to get from getListing for full details including images
      let data = { ...listing }
      try {
        const res = await marketplaceApi.getListing(listing.id)
        if ((res as any).data) {
           data = { ...data, ...(res as { data: Listing }).data }
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
      await marketplaceApi.closeListing(detailListing.id as string, "Bị khóa bởi Admin")
      toast.success("Đã đóng tin đăng thành công!")
      setDetailListing(null)
      fetchListings()
      fetchMetadata()
    } catch (err: any) {
      toast.error(`Lỗi thao tác: ${err.message}`)
    }
  }

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="rounded-[1.75rem] border bg-card/80 p-5 shadow-sm backdrop-blur">
          <div className="flex items-center gap-2">
            <ShoppingBagIcon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-2xl font-bold tracking-tight">Gian hàng 0 đồng</h2>
          </div>
          <p className="text-muted-foreground mt-1">
            Quản lý, theo dõi và kiểm duyệt các tin đăng
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { key: "active", label: "Đang hiển thị", icon: ShoppingBagIcon, tone: "bg-emerald-500/10 text-emerald-700" },
            { key: "reserved", label: "Đã giữ chỗ", icon: Clock3, tone: "bg-amber-500/10 text-amber-700" },
            { key: "closed", label: "Đã hoàn tất", icon: CheckCircle2, tone: "bg-slate-500/10 text-slate-700" },
            { key: "blocked", label: "Đã khóa", icon: Ban, tone: "bg-red-500/10 text-red-700" },
          ].map((item) => <button type="button" key={item.key} onClick={() => { setStatusFilter(item.key); setPage(1) }} className={`admin-surface flex items-center justify-between p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${statusFilter === item.key ? "ring-2 ring-primary/35" : ""}`}><div><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{(statusTotals[item.key] || 0).toLocaleString("vi-VN")}</p></div><div className={`rounded-2xl p-3 ${item.tone}`}><item.icon className="size-5" /></div></button>)}
        </div>

        <Card className="admin-surface">
          <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <CardTitle>Danh sách</CardTitle>
              <Badge variant="secondary">{total}</Badge>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm tiêu đề tin đăng..."
                  className="w-full pl-8 sm:w-[260px]"
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
                <SelectTrigger className="w-full sm:w-[170px]">
                  <SelectValue placeholder="Trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả trạng thái</SelectItem>
                  <SelectItem value="active">Đang hiển thị</SelectItem>
                  <SelectItem value="reserved">Đã giữ chỗ</SelectItem>
                  <SelectItem value="closed">Đã hoàn tất</SelectItem>
                  <SelectItem value="blocked">Đã khóa</SelectItem>
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
         currentUser={currentUser as Record<string, any> | null}
      />
    </AdminLayout>
  )
}
