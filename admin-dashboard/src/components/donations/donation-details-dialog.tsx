import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
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
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Package, Calendar, Ban, Clock } from "lucide-react"
import { useState, useEffect } from "react"
import { donationApi } from "@/lib/api/client"
import { DonationTimelineEntry, DonationWithDonor } from "@/types"
import { SafeImage } from "@/components/ui/safe-image"

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Chờ duyệt", variant: "secondary" },
  accepted: { label: "Đã chấp nhận", variant: "default" },
  scheduled: { label: "Đã hẹn lịch", variant: "secondary" },
  received: { label: "Đã nhận", variant: "default" },
  completed: { label: "Hoàn thành", variant: "default" },
  rejected: { label: "Bị từ chối", variant: "destructive" },
  cancelled: { label: "Đã hủy", variant: "outline" },
}

const timelineLabels: Record<string, string> = {
  created: "Đơn quyên góp được tạo",
  reviewed_accepted: "Đơn đã được chấp nhận",
  reviewed_rejected: "Đơn đã bị từ chối",
  reviewed: "Đơn đã được kiểm duyệt",
  scheduled: "Đã xác nhận lịch bàn giao",
  received: "Nhóm đã tiếp nhận vật phẩm",
  item_accepted: "Vật phẩm đã được duyệt",
  item_rejected: "Vật phẩm bị từ chối",
  inventory_in_stock: "Vật phẩm đã nhập kho",
  inventory_listed: "Vật phẩm đã được đưa lên gian hàng",
  inventory_reserved: "Vật phẩm đã được giữ chỗ",
  inventory_delivered: "Vật phẩm đã được bàn giao",
  inventory_discarded: "Vật phẩm đã được loại khỏi kho",
}

interface DonationDetailsDialogProps {
  detailDonation: DonationWithDonor | null
  onClose: () => void
  onAction: (action: "accepted" | "rejected" | "schedule" | "cancel", payload?: Record<string, any>) => void
  currentUser: Record<string, unknown> | null
}

export function DonationDetailsDialog({
  detailDonation,
  onClose,
  onAction,
  currentUser,
}: DonationDetailsDialogProps) {
  const [scheduleDate, setScheduleDate] = useState("")
  const [showScheduleInput, setShowScheduleInput] = useState(false)
  const [timeline, setTimeline] = useState<DonationTimelineEntry[]>([])
  const [loadingTimeline, setLoadingTimeline] = useState(false)

  useEffect(() => {
    if (detailDonation?.id) {
      setLoadingTimeline(true)
      donationApi.getDonationTimeline(detailDonation.id)
        .then(res => setTimeline(res.data || []))
        .catch(err => console.error("Failed to fetch timeline:", err))
        .finally(() => setLoadingTimeline(false))
    }
  }, [detailDonation?.id])

  if (!detailDonation) return null

  const isPending = detailDonation.status === "pending"
  const isAccepted = detailDonation.status === "accepted"
  const isScheduled = detailDonation.status === "scheduled"
  const canCancel = isAccepted || isScheduled
  const isPlatformAdmin = !!(currentUser?.roles as string[] | undefined)?.includes("PLATFORM_ADMIN")

  const handleSchedule = () => {
    if (!showScheduleInput) {
      setShowScheduleInput(true)
      return
    }
    if (scheduleDate) {
      onAction("schedule", { scheduled_at: new Date(scheduleDate).toISOString() })
      setShowScheduleInput(false)
    }
  }

  return (
    <Dialog open={!!detailDonation} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {detailDonation.code} — {detailDonation.title}
          </DialogTitle>
          <DialogDescription>Chi tiết đơn quyên góp</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="details">Chi tiết</TabsTrigger>
            <TabsTrigger value="timeline">Lịch sử</TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="space-y-4">
            <div className="grid gap-4 rounded-2xl bg-muted/50 p-4 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground block mb-1">Người quyên góp:</span>
              <span className="font-medium">
                 {detailDonation.donorProfile ? (detailDonation.donorProfile.full_name || `@${detailDonation.donorProfile.username}`) : detailDonation.donor_id.slice(0, 8)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">Trạng thái:</span>
              <Badge variant={statusConfig[detailDonation.status]?.variant || "secondary"}>
                {statusConfig[detailDonation.status]?.label || detailDonation.status}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">Phương thức:</span>
              <span className="font-medium">{detailDonation.pickup_method === "pickup" ? "Giao tận nơi" : "Mang đến"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">Địa chỉ / Lịch hẹn:</span>
              <span className="font-medium">
                {detailDonation.pickup_method === "pickup" ? (detailDonation.pickup_address || "—") : (
                   detailDonation.scheduled_at
                    ? new Date(detailDonation.scheduled_at).toLocaleString("vi-VN")
                    : "Chưa hẹn"
                )}
              </span>
            </div>
          </div>

          {detailDonation.description && (
            <div>
              <span className="text-sm font-medium">Mô tả:</span>
              <p className="text-sm mt-1 bg-secondary/50 p-3 rounded">{detailDonation.description}</p>
            </div>
          )}

          {detailDonation.items && detailDonation.items.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Danh sách vật phẩm ({detailDonation.items.length})</h4>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Tên vật phẩm</TableHead>
                      <TableHead>Số lượng</TableHead>
                      <TableHead>Tình trạng</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                     {detailDonation.items.map((item) => (
                       <TableRow key={item.id}>
                         <TableCell><div className="flex items-center gap-3"><div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-muted-foreground"><SafeImage src={item.images?.[0]?.image_url} alt="" className="size-full object-cover" fallback={<Package className="size-5" />} /></div><div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.images?.length || 0} ảnh</p></div></div></TableCell>
                        <TableCell className="tabular-nums">{item.quantity}</TableCell>
                         <TableCell>{item.condition_declared || "Chưa rõ"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="mt-1">
                             {item.status === "accepted" ? "Đã duyệt" : item.status === "rejected" ? "Từ chối" : "Chờ xử lý"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

          <TabsContent value="timeline">
            {loadingTimeline ? (
              <div className="space-y-4 p-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : timeline.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Không có lịch sử nào
              </div>
            ) : (
              <div className="space-y-4">
                {timeline.map((entry, i) => (
                  <div key={`${entry.at}-${i}`} className="flex gap-4">
                    <div className="mt-1">
                      <div className="rounded-full bg-primary/10 p-2">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {timelineLabels[entry.event] || entry.event.replaceAll("_", " ")}
                      </p>
                      <p className="text-xs text-muted-foreground mb-1">
                         {new Date(entry.at).toLocaleString("vi-VN")}
                      </p>
                      {entry.note && (
                        <p className="text-sm bg-muted/50 p-2 rounded">{entry.note}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6 flex sm:justify-between items-center border-t pt-4">
          <div className="flex items-center gap-2">
            {!isPlatformAdmin && (
              <>
                {isPending && (
                  <>
                    <Button variant="outline" onClick={() => onAction("rejected")} className="text-destructive hover:text-destructive">
                      Từ chối
                    </Button>
                    <Button variant="default" onClick={() => onAction("accepted")}>
                      Chấp nhận
                    </Button>
                  </>
                )}

                {isAccepted && detailDonation.pickup_method === "pickup" && (
                  <div className="flex items-center gap-2">
                    {showScheduleInput ? (
                      <div className="flex items-center gap-2">
                        <Input 
                          type="datetime-local" 
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          className="w-auto h-9"
                        />
                        <Button variant="default" size="sm" onClick={handleSchedule}>Lưu</Button>
                        <Button variant="ghost" size="sm" onClick={() => setShowScheduleInput(false)}>Hủy</Button>
                      </div>
                    ) : (
                      <Button variant="secondary" onClick={handleSchedule}>
                        <Calendar className="w-4 h-4 mr-2" /> Hẹn lịch
                      </Button>
                    )}
                  </div>
                )}

                {canCancel && (
                  <Button variant="outline" className="text-red-500 hover:text-red-600" onClick={() => onAction("cancel")}>
                    <Ban className="w-4 h-4 mr-2" /> Hủy đơn
                  </Button>
                )}
              </>
            )}
          </div>
          
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
