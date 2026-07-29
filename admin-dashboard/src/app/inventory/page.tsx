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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { donationApi } from "@/lib/api/client"
import { QRCodeSVG } from "qrcode.react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Boxes, CircleCheckBig, Clock3, Eye, PackageOpenIcon, PrinterIcon, Search, ShoppingBag, Trash2, UserRound } from "lucide-react"
import { InventoryCategory, InventoryHistoryEntry, InventoryItem, InventoryItemWithDonor, Profile } from "@/types"
import { identityApi } from "@/lib/api/client"

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  in_stock: { label: "Trong kho", variant: "default" },
  listed: { label: "Đã lên kệ", variant: "secondary" },
  reserved: { label: "Đã đặt trước", variant: "outline" },
  delivered: { label: "Đã giao", variant: "secondary" },
  discarded: { label: "Loại bỏ", variant: "destructive" },
}

const conditionLabels: Record<string, string> = {
  new: "Mới",
  like_new: "Như mới",
  good: "Tốt",
  fair: "Đã qua sử dụng",
  used: "Đã sử dụng",
  poor: "Cũ",
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItemWithDonor[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [qrItem, setQrItem] = useState<InventoryItem | null>(null)
  const [detailItem, setDetailItem] = useState<InventoryItemWithDonor | null>(null)
  const [history, setHistory] = useState<InventoryHistoryEntry[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusTotals, setStatusTotals] = useState<Record<string, number>>({})
  const [categories, setCategories] = useState<Record<string, InventoryCategory>>({})
  const limit = 20

  const fetchInventory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await donationApi.getInventory({ page, limit, status: statusFilter === "all" ? undefined : statusFilter })
      const inventoryItems = (res.data.items || []) as InventoryItem[]
      let profiles: Record<string, Profile> = {}
      const donorIds = [...new Set(inventoryItems.map((item) => item.donor_id).filter((id): id is string => !!id))]
      if (donorIds.length > 0) {
        const profileRes = await identityApi.getProfilesBatch(donorIds)
        profiles = Object.fromEntries(profileRes.data.map((profile) => [profile.id, profile]))
      }
      setItems(inventoryItems.map((item) => ({ ...item, donorProfile: item.donor_id ? profiles[item.donor_id] : undefined })))
      setTotal(res.data.meta?.total || 0)
    } catch (err: any) {
      toast.error("Lỗi tải danh sách kho: " + err.message)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  const fetchMetadata = useCallback(async () => {
    const statuses = ["in_stock", "listed", "reserved", "delivered", "discarded"]
    const [categoryResult, ...statusResults] = await Promise.allSettled([
      donationApi.listCategories(),
      ...statuses.map((status) => donationApi.getInventory({ status, limit: 1 })),
    ])
    if (categoryResult.status === "fulfilled") {
      setCategories(Object.fromEntries(categoryResult.value.data.map((category: InventoryCategory) => [category.id, category])))
    }
    setStatusTotals(Object.fromEntries(statuses.map((status, index) => [status, statusResults[index].status === "fulfilled" ? statusResults[index].value.data.meta.total : 0])))
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchInventory()
    fetchMetadata()
  }, [fetchInventory, fetchMetadata])

  async function viewItem(item: InventoryItemWithDonor) {
    setDetailItem(item)
    setHistory([])
    setLoadingDetail(true)
    try {
      const [itemResult, historyResult] = await Promise.all([
        donationApi.getInventoryItem(item.id),
        donationApi.getInventoryHistory(item.id),
      ])
      setDetailItem({ ...(itemResult.data as InventoryItem), donorProfile: item.donorProfile })
      setHistory(historyResult.data as InventoryHistoryEntry[])
    } catch (error) {
      toast.error("Lỗi tải chi tiết kho: " + (error instanceof Error ? error.message : "Không xác định"))
    } finally {
      setLoadingDetail(false)
    }
  }

  const totalPages = Math.ceil(total / limit)
  const normalizedSearch = searchQuery.trim().toLowerCase()
  const visibleItems = normalizedSearch ? items.filter((item) => [item.code, item.name, categories[item.category_id || ""]?.name, item.donorProfile?.full_name, item.donorProfile?.username].some((value) => value?.toLowerCase().includes(normalizedSearch))) : items

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="rounded-[1.75rem] border bg-card/80 p-5 shadow-sm backdrop-blur">
          <div className="flex items-center gap-2">
            <PackageOpenIcon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-2xl font-bold tracking-tight">Quản lý Kho hàng</h2>
          </div>
          <p className="text-muted-foreground mt-1">
            Quản lý các sản phẩm đã nhập kho và in mã QR code
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { key: "in_stock", label: "Trong kho", icon: Boxes, tone: "bg-emerald-500/10 text-emerald-700" },
            { key: "listed", label: "Đã lên kệ", icon: ShoppingBag, tone: "bg-blue-500/10 text-blue-700" },
            { key: "reserved", label: "Đã giữ chỗ", icon: Clock3, tone: "bg-amber-500/10 text-amber-700" },
            { key: "delivered", label: "Đã bàn giao", icon: CircleCheckBig, tone: "bg-teal-500/10 text-teal-700" },
            { key: "discarded", label: "Đã loại bỏ", icon: Trash2, tone: "bg-red-500/10 text-red-700" },
          ].map((item) => <button type="button" key={item.key} onClick={() => { setStatusFilter(item.key); setPage(1) }} className={`admin-surface flex items-center justify-between p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${statusFilter === item.key ? "ring-2 ring-primary/35" : ""}`}><div><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{(statusTotals[item.key] || 0).toLocaleString("vi-VN")}</p></div><div className={`rounded-2xl p-3 ${item.tone}`}><item.icon className="size-5" /></div></button>)}
        </div>

        <Card className="admin-surface">
          <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Danh sách sản phẩm</CardTitle>
              <Badge variant="secondary">{total}</Badge>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Tìm mã, tên, người tặng..." className="w-full pl-9 sm:w-[260px]" /></div><Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value || "all"); setPage(1) }}><SelectTrigger className="w-full sm:w-[170px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tất cả trạng thái</SelectItem>{Object.entries(statusConfig).map(([value, config]) => <SelectItem value={value} key={value}>{config.label}</SelectItem>)}</SelectContent></Select></div>
          </CardHeader>
          <CardContent>
            <div className="admin-table-wrap"><Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã Hàng</TableHead>
                  <TableHead>Tên Sản Phẩm</TableHead>
                  <TableHead>Danh mục</TableHead>
                  <TableHead>Trạng Thái</TableHead>
                  <TableHead>Tình Trạng</TableHead>
                  <TableHead>Số lượng</TableHead>
                  <TableHead>Ngày Nhập</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : visibleItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <PackageOpenIcon className="h-8 w-8" />
                        <p>{searchQuery ? "Không tìm thấy vật phẩm phù hợp" : "Kho hàng đang trống"}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono font-medium">
                        {item.code}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div><p>{item.name}</p><p className="mt-0.5 text-xs font-normal text-muted-foreground">{item.donorProfile?.full_name || item.donorProfile?.username || "Không rõ người tặng"}</p></div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{categories[item.category_id || ""]?.name || "Chưa phân loại"}</TableCell>
                      <TableCell>
                        <Badge variant={statusConfig[item.status]?.variant || "secondary"}>
                          {statusConfig[item.status]?.label || item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {conditionLabels[item.condition] || item.condition}
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums">{item.quantity}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(item.imported_at).toLocaleDateString("vi-VN")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1"><Button variant="secondary" size="sm" onClick={() => viewItem(item)}><Eye className="size-4" /></Button><Button
                          variant="outline"
                          size="sm"
                          onClick={() => setQrItem(item)}
                          className="gap-2"
                        >
                          <PrinterIcon className="h-4 w-4" />
                          <span>In QR</span>
                        </Button></div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table></div>

            {total > 0 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Hiển thị {(page - 1) * limit + 1}–{Math.min(page * limit, total)} / {total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Trước
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Sau
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!qrItem} onOpenChange={() => setQrItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Mã QR Sản Phẩm</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-6 space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border">
              {qrItem && (
                <QRCodeSVG
                  value={qrItem.code}
                  size={200}
                  level="H"
                  includeMargin={false}
                />
              )}
            </div>
            
            <div className="text-center space-y-1">
              <p className="font-mono text-lg font-bold tracking-wider">{qrItem?.code}</p>
              <p className="text-sm font-medium">{qrItem?.name}</p>
              <p className="text-xs text-muted-foreground pt-2">
                Quét mã này bằng ứng dụng Charity Platform để thực hiện thao tác tiếp nhận / trao tặng.
              </p>
            </div>
            
            <Button className="w-full gap-2" onClick={() => window.print()}>
              <PrinterIcon className="h-4 w-4" />
              In Nhãn Sản Phẩm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailItem} onOpenChange={(open) => !open && setDetailItem(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>Chi tiết vật phẩm trong kho</DialogTitle></DialogHeader>
          {loadingDetail || !detailItem ? <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" /></div> : <div className="space-y-5"><div className="rounded-3xl border bg-muted/30 p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono text-sm text-primary">{detailItem.code}</p><h3 className="mt-1 text-xl font-bold">{detailItem.name}</h3><p className="mt-1 text-sm text-muted-foreground">{categories[detailItem.category_id || ""]?.name || "Chưa phân loại"}</p></div><Badge variant={statusConfig[detailItem.status]?.variant || "secondary"}>{statusConfig[detailItem.status]?.label || detailItem.status}</Badge></div></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[{ label: "Số lượng", value: detailItem.quantity }, { label: "Tình trạng", value: conditionLabels[detailItem.condition] || detailItem.condition }, { label: "Ngày nhập", value: new Date(detailItem.imported_at).toLocaleDateString("vi-VN") }, { label: "Cập nhật", value: new Date(detailItem.updated_at).toLocaleDateString("vi-VN") }].map((entry) => <div key={entry.label} className="rounded-2xl border p-3"><p className="text-xs text-muted-foreground">{entry.label}</p><p className="mt-1 font-semibold">{entry.value}</p></div>)}</div><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border p-4"><p className="flex items-center gap-2 font-semibold"><UserRound className="size-4 text-primary" />Người quyên góp</p><p className="mt-3 text-sm">{detailItem.donorProfile?.full_name || detailItem.donorProfile?.username || "Chưa có thông tin"}</p><p className="text-xs text-muted-foreground">{detailItem.donor_id || "Không có donor ID"}</p></div><div className="rounded-2xl border p-4"><p className="font-semibold">Ghi chú kho</p><p className="mt-3 text-sm text-muted-foreground">{detailItem.note || "Không có ghi chú"}</p></div></div><div><h4 className="font-semibold">Lịch sử trạng thái</h4>{history.length === 0 ? <p className="mt-3 rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Chưa có lịch sử thay đổi.</p> : <div className="mt-3 space-y-3">{history.map((entry) => <div key={entry.id} className="flex gap-3 rounded-2xl border p-3"><div className="mt-0.5 rounded-full bg-primary/10 p-2"><Clock3 className="size-4 text-primary" /></div><div><p className="text-sm font-medium">{entry.from_status ? `${statusConfig[entry.from_status]?.label || entry.from_status} → ` : ""}{statusConfig[entry.to_status]?.label || entry.to_status}</p><p className="mt-0.5 text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString("vi-VN")}</p>{entry.note && <p className="mt-2 text-sm text-muted-foreground">{entry.note}</p>}</div></div>)}</div>}</div></div>}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
