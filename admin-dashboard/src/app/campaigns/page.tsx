"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/context/auth-context"
import { AdminLayout } from "@/components/admin-layout"
import { donationApi, communityApi, identityApi } from "@/lib/api/client"
import type { Campaign, CampaignWithGroup, Group, Profile } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { SearchIcon, EyeIcon, PackageIcon, CheckCircleIcon, XCircleIcon, TruckIcon } from "lucide-react"

function formatDate(d: string | null): string {
  if (!d) return ""
  const date = new Date(d)
  const dd = String(date.getDate()).padStart(2, "0")
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const yyyy = date.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

const STATUS_LABELS: Record<string, string> = {
  active: "Đang mở",
  fulfilled: "Đã giao",
  closed: "Đã đóng",
  cancelled: "Đã hủy",
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  fulfilled: "secondary",
  closed: "outline",
  cancelled: "destructive",
}

export default function CampaignsPage() {
  const { currentUser, isAuthLoading } = useAuth()
  const [campaigns, setCampaigns] = useState<CampaignWithGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20
  const [selected, setSelected] = useState<CampaignWithGroup | null>(null)
  const [closeDialog, setCloseDialog] = useState(false)
  const [deliverDialog, setDeliverDialog] = useState(false)
  const [closeReason, setCloseReason] = useState("")
  const [deliverNote, setDeliverNote] = useState("")
  const [deliverPhoto, setDeliverPhoto] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  const fetchCampaigns = useCallback(async () => {
    setLoading(true)
    try {
      const res = await donationApi.listCampaigns({
        status: statusFilter || undefined,
        limit,
        offset: (page - 1) * limit,
      })
      const data = res.data
      const items = data.items || []
      const groupIds = [...new Set(items.map((c: any) => c.group_id))]
      const groups: Record<string, Group> = {}
      if (groupIds.length > 0) {
        const groupRes = await communityApi.listGroups({ limit: 100 })
        for (const g of groupRes.data.items || []) {
          groups[g.id] = g
        }
      }
      setCampaigns(items.map((c: any) => ({ ...c, group: groups[c.group_id] })))
      setTotal(data.meta?.total || 0)
    } catch (e: any) {
      toast.error(e.message || "Không thể tải danh sách đợt quyên góp")
    } finally {
      setLoading(false)
    }
  }, [statusFilter, page])

  useEffect(() => {
    if (!isAuthLoading && currentUser) fetchCampaigns()
  }, [isAuthLoading, currentUser, fetchCampaigns])

  const filtered = campaigns.filter((c) =>
    !search ||
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  )

  async function handleClose() {
    if (!selected) return
    setActionLoading(true)
    try {
      await donationApi.closeCampaign(selected.id, closeReason || undefined)
      toast.success("Đã đóng đợt quyên góp")
      setCloseDialog(false)
      setCloseReason("")
      fetchCampaigns()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDeliver() {
    if (!selected) return
    setActionLoading(true)
    try {
      await donationApi.deliverCampaign(selected.id, {
        delivery_photo_url: deliverPhoto || undefined,
        delivery_note: deliverNote || undefined,
      })
      toast.success("Đã xác nhận trao tặng thành công")
      setDeliverDialog(false)
      setDeliverNote("")
      setDeliverPhoto("")
      fetchCampaigns()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  if (isAuthLoading || !currentUser) return null

  return (
    <AdminLayout>
      <div className="flex-1 space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Đợt quyên góp</h1>
            <p className="text-sm text-muted-foreground">Quản lý các cuộc quyên góp theo đợt</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên hoặc mã..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(!v || v === "all" ? "" : v); setPage(1) }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="active">Đang mở</SelectItem>
              <SelectItem value="fulfilled">Đã giao</SelectItem>
              <SelectItem value="closed">Đã đóng</SelectItem>
              <SelectItem value="cancelled">Đã hủy</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <PackageIcon className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-sm text-muted-foreground">Chưa có đợt quyên góp nào</p>
              </div>
            ) : (
              <div className="divide-y">
                {filtered.map((c) => {
                  const totalTargets = c.items?.length || 0
                  const fulfilled = c.items?.filter((i) => i.received_quantity >= i.target_quantity).length || 0
                  const totalReceived = c.items?.reduce((s, i) => s + i.received_quantity, 0) || 0
                  const totalTarget = c.items?.reduce((s, i) => s + i.target_quantity, 0) || 0
                  const pct = totalTarget > 0 ? Math.round((totalReceived / totalTarget) * 100) : 0
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-4 p-4 hover:bg-muted/50 cursor-pointer"
                      onClick={() => setSelected(c)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium">{c.code}</span>
                          <Badge variant={STATUS_VARIANTS[c.status] || "default"}>
                            {STATUS_LABELS[c.status] || c.status}
                          </Badge>
                        </div>
                        <p className="mt-1 font-medium truncate">{c.title}</p>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{c.group?.name || "—"}</span>
                          {c.beneficiary_description && <span>· {c.beneficiary_description}</span>}
                          {c.deadline && <span>· Hạn: {formatDate(c.deadline)}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-sm font-medium">{totalReceived}/{totalTarget}</span>
                        <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{fulfilled}/{totalTargets} mục tiêu</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSelected(c) }}>
                        <EyeIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {total > limit && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Hiển thị {(page - 1) * limit + 1}–{Math.min(page * limit, total)} / {total}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Trước
              </Button>
              <Button variant="outline" size="sm" disabled={page * limit >= total} onClick={() => setPage(page + 1)}>
                Sau
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono">{selected?.code}</span>
              {selected && (
                <Badge variant={STATUS_VARIANTS[selected.status] || "default"}>
                  {STATUS_LABELS[selected.status] || selected.status}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{selected.title}</h3>
                {selected.description && <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Nhóm</p>
                  <p className="font-medium">{selected.group?.name || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Địa phương</p>
                  <p className="font-medium">{selected.province_code || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Người thụ hưởng</p>
                  <p className="font-medium">{selected.beneficiary_description || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Hạn đóng góp</p>
                  <p className="font-medium">{selected.deadline ? formatDate(selected.deadline) : "Không giới hạn"}</p>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Mục tiêu quyên góp</h4>
                <div className="space-y-2">
                  {selected.items?.map((item) => {
                    const pct = item.target_quantity > 0 ? Math.round((item.received_quantity / item.target_quantity) * 100) : 0
                    return (
                      <div key={item.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{item.name}</span>
                          <span className="text-sm font-mono">
                            {item.received_quantity}/{item.target_quantity}
                            {item.unit && ` ${item.unit}`}
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full ${pct >= 100 ? "bg-green-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{pct >= 100 ? "Đã đủ" : `Còn thiếu ${item.target_quantity - item.received_quantity}`}</span>
                          {item.condition_required && <span>Tình trạng: {item.condition_required}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {selected.status === "active" && (
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    onClick={() => { setCloseDialog(true); setSelected(selected) }}
                  >
                    <XCircleIcon className="mr-2 h-4 w-4" />
                    Đóng đợt
                  </Button>
                  <Button onClick={() => { setDeliverDialog(true); setSelected(selected) }}>
                    <TruckIcon className="mr-2 h-4 w-4" />
                    Xác nhận trao tặng
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Close Dialog */}
      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đóng đợt quyên góp</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Đóng đợt sẽ không nhận thêm đóng góp. Bạn có chắc?</p>
            <Textarea
              placeholder="Lý do đóng (tuỳ chọn)"
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialog(false)}>Hủy</Button>
            <Button onClick={handleClose} disabled={actionLoading}>
              Xác nhận đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deliver Dialog */}
      <Dialog open={deliverDialog} onOpenChange={setDeliverDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận trao tặng</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Xác nhận đồ quyên góp đã được trao đến tay người cần.</p>
            <Input
              placeholder="URL ảnh trao tặng (tuỳ chọn)"
              value={deliverPhoto}
              onChange={(e) => setDeliverPhoto(e.target.value)}
            />
            <Textarea
              placeholder="Ghi chú (tuỳ chọn)"
              value={deliverNote}
              onChange={(e) => setDeliverNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliverDialog(false)}>Hủy</Button>
            <Button onClick={handleDeliver} disabled={actionLoading}>
              <CheckCircleIcon className="mr-2 h-4 w-4" />
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
