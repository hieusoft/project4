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
import { HandHeartIcon } from "lucide-react"

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "PENDING", variant: "outline" },
  approved: { label: "APPROVED", variant: "default" },
  scheduled: { label: "SCHEDULED", variant: "secondary" },
  completed: { label: "COMPLETED", variant: "default" },
  rejected: { label: "REJECTED", variant: "destructive" },
  cancelled: { label: "CANCELLED", variant: "secondary" },
  no_show: { label: "NO_SHOW", variant: "destructive" },
}

interface RequestDetailsDialogProps {
  detailRequest: Record<string, any> | null
  confirmation: Record<string, any> | null
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
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandHeartIcon className="h-5 w-5" />
            Chi tiết Yêu cầu
          </DialogTitle>
          <DialogDescription>Mã: {(detailRequest.code as string) || "N/A"}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Main Info */}
          <div className="grid grid-cols-2 gap-4 text-sm bg-muted/50 p-4 rounded-lg">
            <div>
              <span className="text-muted-foreground block mb-1">Người nhận:</span>
              <span className="font-medium">
                {detailRequest.receiverProfile 
                  ? ((detailRequest.receiverProfile as any).full_name || (detailRequest.receiverProfile as any).username)
                  : ((detailRequest.receiver_id as string)?.substring(0, 8) + "...")}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">Trạng thái:</span>
              <Badge variant={statusConfig[statusStr]?.variant || "secondary"} className={statusStr === "completed" ? "bg-emerald-500" : statusStr === "approved" ? "bg-blue-500" : ""}>
                {statusConfig[statusStr]?.label || statusStr.toUpperCase()}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">Nhóm xử lý:</span>
              <span className="font-medium">
                {detailRequest.groupProfile ? (detailRequest.groupProfile as any).name : "N/A"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">Số lượng yêu cầu:</span>
              <span className="font-medium">{detailRequest.quantity as number}</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">Listing/Item ID:</span>
              <span className="font-medium">{(detailRequest.listing_id as string) || "N/A"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">Ngày tạo:</span>
              <span className="font-medium">
                {detailRequest.created_at ? new Date(detailRequest.created_at as string).toLocaleString("vi-VN") : "N/A"}
              </span>
            </div>
          </div>

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
              <h3 className="text-md font-semibold mb-3">Xác nhận giao hàng (Delivery Confirmation)</h3>
              <div className="grid grid-cols-2 gap-4 text-sm bg-muted/50 p-4 rounded-lg">
                <div>
                  <span className="text-muted-foreground block mb-1">Lịch hẹn (Scheduled At):</span>
                  <span className="font-medium">
                    {confirmation.scheduled_at ? new Date(confirmation.scheduled_at as string).toLocaleString("vi-VN") : "Chưa có"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Hoàn thành lúc:</span>
                  <span className="font-medium">
                    {confirmation.completed_at ? new Date(confirmation.completed_at as string).toLocaleString("vi-VN") : "Chưa hoàn thành"}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block mb-1">Ghi chú (Note):</span>
                  <span className="font-medium">{confirmation.note ? (confirmation.note as string) : "Không có ghi chú"}</span>
                </div>
              </div>

              {/* Photos */}
              <div className="mt-4 flex gap-4 overflow-x-auto">
                {(confirmation.moderator_photo_url || confirmation.receiver_photo_url) ? (
                  <>
                    {confirmation.moderator_photo_url && (
                      <div className="flex-1">
                        <span className="text-sm font-medium block mb-2">Ảnh người giao (Moderator):</span>
                        <div className="relative h-[200px] rounded-md overflow-hidden border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img 
                            src={confirmation.moderator_photo_url as string} 
                            alt="Moderator Photo" 
                            className="object-cover w-full h-full"
                            onError={(e) => { (e.target as any).src = 'https://via.placeholder.com/200?text=No+Image' }}
                          />
                        </div>
                      </div>
                    )}
                    {confirmation.receiver_photo_url && (
                      <div className="flex-1">
                        <span className="text-sm font-medium block mb-2">Ảnh người nhận (Receiver):</span>
                        <div className="relative h-[200px] rounded-md overflow-hidden border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img 
                            src={confirmation.receiver_photo_url as string} 
                            alt="Receiver Photo" 
                            className="object-cover w-full h-full"
                            onError={(e) => { (e.target as any).src = 'https://via.placeholder.com/200?text=No+Image' }}
                          />
                        </div>
                      </div>
                    )}
                  </>
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
