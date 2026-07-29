import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle2, HandHeartIcon, ImageIcon, Package, UserRound } from "lucide-react"
import { DeliveryConfirmation, ItemRequestWithRelations } from "@/types"
import { SafeImage } from "@/components/ui/safe-image"

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Chờ duyệt", variant: "outline" },
  approved: { label: "Đã duyệt", variant: "default" },
  scheduled: { label: "Đã hẹn lịch", variant: "secondary" },
  completed: { label: "Đã bàn giao", variant: "default" },
  rejected: { label: "Đã từ chối", variant: "destructive" },
  cancelled: { label: "Đã hủy", variant: "secondary" },
  no_show: { label: "Không đến nhận", variant: "destructive" },
}

interface RequestDetailsDialogProps {
  detailRequest: ItemRequestWithRelations | null
  confirmation: DeliveryConfirmation | null
  onClose: () => void
}

export function RequestDetailsDialog({
  detailRequest,
  confirmation,
  onClose,
}: RequestDetailsDialogProps) {
  if (!detailRequest) return null

  const statusStr = (detailRequest.status as string) || "unknown"

  return (
    <Dialog open={!!detailRequest} onOpenChange={onClose}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandHeartIcon className="h-5 w-5" />
            Chi tiết Yêu cầu
          </DialogTitle>
          <DialogDescription>Mã: {(detailRequest.code as string) || "N/A"}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.05fr_.95fr]"><div className="flex min-h-64 items-center justify-center overflow-hidden rounded-3xl border bg-muted text-muted-foreground"><SafeImage src={detailRequest.listing?.images?.[0]?.image_url} alt="" className="size-full object-cover" fallback={<ImageIcon className="size-12" />} /></div><div className="space-y-4 rounded-3xl border bg-muted/30 p-5"><div className="flex flex-wrap items-center gap-2"><Badge variant={statusConfig[statusStr]?.variant || "secondary"}>{statusConfig[statusStr]?.label || statusStr}</Badge><Badge variant="outline">Số lượng {detailRequest.quantity}</Badge></div><div><p className="flex items-center gap-1 text-xs text-muted-foreground"><Package className="size-3.5" />Vật phẩm</p><p className="mt-1 font-semibold">{detailRequest.listing?.title || "Không rõ vật phẩm"}</p></div><div><p className="flex items-center gap-1 text-xs text-muted-foreground"><UserRound className="size-3.5" />Người nhận</p><p className="mt-1 font-semibold">{detailRequest.receiverProfile?.full_name || detailRequest.receiverProfile?.username || detailRequest.receiver_id.slice(0, 8)}</p></div><div><p className="text-xs text-muted-foreground">Nhóm xử lý</p><p className="mt-1 font-semibold">{detailRequest.group?.name || "Không rõ nhóm"}</p></div><p className="text-xs text-muted-foreground">Tạo lúc {new Date(detailRequest.created_at).toLocaleString("vi-VN")}</p></div></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[{ label: "Ngày duyệt", value: detailRequest.reviewed_at ? new Date(detailRequest.reviewed_at).toLocaleString("vi-VN") : "Chưa duyệt" }, { label: "Lịch nhận", value: detailRequest.scheduled_at ? new Date(detailRequest.scheduled_at).toLocaleString("vi-VN") : "Chưa hẹn" }, { label: "Hoàn thành", value: detailRequest.completed_at ? new Date(detailRequest.completed_at).toLocaleString("vi-VN") : "Chưa hoàn thành" }, { label: "Cập nhật", value: new Date(detailRequest.updated_at).toLocaleString("vi-VN") }].map((item) => <div key={item.label} className="rounded-2xl border p-3"><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-1 text-sm font-semibold">{item.value}</p></div>)}</div>

          {/* Reason */}
          {detailRequest.reason && (
            <div>
              <span className="text-sm font-medium">Lý do nhận:</span>
              <p className="text-sm mt-1 bg-secondary/50 p-3 rounded whitespace-pre-wrap">{detailRequest.reason as string}</p>
            </div>
          )}

          {/* Delivery Confirmation */}
          {confirmation && (
            <div className="mt-6 border-t pt-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4 text-primary" />Xác nhận bàn giao</h3>
              <div className="grid gap-4 rounded-2xl bg-muted/50 p-4 text-sm sm:grid-cols-2">
                <div>
                   <span className="text-muted-foreground block mb-1">Thời gian xác nhận:</span>
                  <span className="font-medium">
                     {new Date(confirmation.confirmed_at).toLocaleString("vi-VN")}
                  </span>
                </div>
                <div>
                   <span className="text-muted-foreground block mb-1">Người xác nhận:</span>
                  <span className="font-medium">
                     {confirmation.confirmed_by.slice(0, 8)}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block mb-1">Ghi chú (Note):</span>
                  <span className="font-medium">{confirmation.note ? (confirmation.note as string) : "Không có ghi chú"}</span>
                </div>
              </div>

              {/* Photos */}
              <div className="mt-4 flex gap-4 overflow-x-auto">
                {confirmation.photo_url ? (
                  <div className="flex-1"><span className="mb-2 block text-sm font-medium">Ảnh bàn giao:</span><div className="relative flex h-[240px] items-center justify-center overflow-hidden rounded-2xl border bg-muted text-muted-foreground"><SafeImage src={confirmation.photo_url} alt="Ảnh bàn giao" className="size-full object-cover" fallback={<ImageIcon className="size-8" />} /></div></div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Chưa có ảnh xác nhận</p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6 flex justify-end border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
