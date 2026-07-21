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
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { marketplaceApi } from "@/lib/api/client"
import { Listing } from "@/types"
import { Search, ShoppingBagIcon, ImageIcon } from "lucide-react"

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Active", variant: "default" },
  reserved: { label: "Reserved", variant: "secondary" },
  closed: { label: "Closed", variant: "outline" },
  blocked: { label: "Blocked", variant: "destructive" },
}

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const limit = 20

  const fetchListings = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit }
      if (statusFilter !== "all") params.status = statusFilter
      if (searchQuery) params.search = searchQuery
      const res = await marketplaceApi.getListings(params)
      setListings(res.data.items)
      setTotal(res.data.meta.total)
    } catch (err: any) {
      toast.error("Lỗi tải danh sách gian hàng: " + err.message)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, searchQuery])

  useEffect(() => {
    fetchListings()
  }, [fetchListings])

  const totalPages = Math.ceil(total / limit)

  return (
    <AdminLayout>
      <div className="px-4 lg:px-6">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <ShoppingBagIcon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-2xl font-bold tracking-tight">Gian hàng 0 đồng</h2>
          </div>
          <p className="text-muted-foreground mt-1">
            Quản lý các tin đăng trong gian hàng
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tiêu đề</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Tồn kho</TableHead>
                  <TableHead>Lượt xem</TableHead>
                  <TableHead>Ảnh</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : listings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <ShoppingBagIcon className="h-8 w-8" />
                        <p>Không tìm thấy tin đăng</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  listings.map((listing) => (
                    <TableRow key={listing.id}>
                      <TableCell className="font-medium max-w-[250px] truncate">
                        {listing.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig[listing.status]?.variant || "secondary"}>
                          {statusConfig[listing.status]?.label || listing.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {listing.quantity_available}/{listing.quantity_total}
                      </TableCell>
                      <TableCell className="tabular-nums">{listing.view_count}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <ImageIcon className="h-4 w-4" />
                          <span className="tabular-nums">{listing.images?.length || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(listing.created_at).toLocaleDateString("vi-VN")}
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
    </AdminLayout>
  )
}
