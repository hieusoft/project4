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
import { Donation } from "@/types"
import { Package, Check, X, Calendar, Ban } from "lucide-react"
import { useState } from "react"

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Chờ duyệt", variant: "secondary" },
  accepted: { label: "Đã chấp nhận", variant: "default" },
  scheduled: { label: "Đã hẹn lịch", variant: "secondary" },
  received: { label: "Đã nhận", variant: "default" },
  completed: { label: "Hoàn thành", variant: "default" },
  rejected: { label: "Bị từ chối", variant: "destructive" },
  cancelled: { label: "Đã hủy", variant: "outline" },
}

interface DonationDetailsDialogProps {
  detailDonation: any | null
  onClose: () => void
  onAction: (action: "accept" | "reject" | "schedule" | "cancel", payload?: any) => void
}

export function DonationDetailsDialog({
  detailDonation,
  onClose,
  onAction,
}: DonationDetailsDialogProps) {
  const [scheduleDate, setScheduleDate] = useState("")
  const [showScheduleInput, setShowScheduleInput] = useState(false)

  if (!detailDonation) return null

  const isPending = detailDonation.status === "pending"
  const isAccepted = detailDonation.status === "accepted"
  const isScheduled = detailDonation.status === "scheduled"
  const canCancel = isAccepted || isScheduled

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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {detailDonation.code} — {detailDonation.title}
          </DialogTitle>
          <DialogDescription>Chi tiết đơn quyên góp</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm bg-muted/50 p-4 rounded-lg">
            <div>
              <span className="text-muted-foreground block mb-1">Người quyên góp:</span>
              <span className="font-medium">
                {detailDonation.donorProfile ? (detailDonation.donorProfile.full_name || `@${detailDonation.donorProfile.username}`) : detailDonation.donor_id}
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
                    {detailDonation.items.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="tabular-nums">{item.quantity}</TableCell>
                        <TableCell>{item.condition_declared}</TableCell>
                        <TableCell>
                          <Badge variant={statusConfig[item.status]?.variant || "secondary"}>
                            {item.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6 flex sm:justify-between items-center border-t pt-4">
          <div className="flex items-center gap-2">
            {isPending && (
              <>
                <Button variant="default" onClick={() => onAction("accept")} className="bg-emerald-600 hover:bg-emerald-700">
                  <Check className="w-4 h-4 mr-2" /> Duyệt đơn
                </Button>
                <Button variant="destructive" onClick={() => onAction("reject")}>
                  <X className="w-4 h-4 mr-2" /> Từ chối
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
          </div>
          
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
