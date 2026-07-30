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
import { Package, Check, X, Calendar, Ban, Sparkles, Loader2 } from "lucide-react"
import { Fragment, useState } from "react"
import { aiApi } from "@/lib/api/client"
import { toast } from "sonner"

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
  onAction: (action: "accepted" | "rejected" | "schedule" | "cancel", payload?: any) => void
}

export function DonationDetailsDialog({
  detailDonation,
  onClose,
  onAction,
}: DonationDetailsDialogProps) {
  const [scheduleDate, setScheduleDate] = useState("")
  const [showScheduleInput, setShowScheduleInput] = useState(false)
  const [aiLoading, setAiLoading] = useState<string | null>(null)
  const [aiResults, setAiResults] = useState<Record<string, any>>({})

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

  async function handleAIDetect(itemId: string, images: any[]) {
    const firstImage = images?.find((img: any) => img.image_url) || images?.[0]
    const imageUrl = firstImage?.image_url
    if (!imageUrl) {
      toast.error("Vật phẩm chưa có ảnh để nhận diện")
      return
    }
    setAiLoading(itemId)
    try {
      const res = await aiApi.detectItem(imageUrl)
      setAiResults((prev) => ({ ...prev, [itemId]: res }))
      toast.success("AI đã nhận diện xong!")
    } catch (err: any) {
      toast.error("AI nhận diện thất bại: " + (err.message || "lỗi"))
    } finally {
      setAiLoading(null)
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
                      <TableHead className="text-right">AI</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailDonation.items.map((item: any) => {
                      const aiRes = aiResults[item.id]
                      const isLoading = aiLoading === item.id
                      return (
                        <Fragment key={item.id}>
                          <TableRow>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="tabular-nums">{item.quantity}</TableCell>
                            <TableCell>{item.condition_declared?.toUpperCase() || 'N/A'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="mt-1">
                                {item.status.toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isLoading || !item.images?.length}
                                onClick={() => handleAIDetect(item.id, item.images)}
                              >
                                {isLoading ? (
                                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                ) : (
                                  <Sparkles className="w-4 h-4 mr-1" />
                                )}
                                Nhận diện
                              </Button>
                            </TableCell>
                          </TableRow>
                          {aiRes && (
                            <TableRow>
                              <TableCell colSpan={5} className="bg-blue-50 dark:bg-blue-950/30">
                                <div className="flex flex-wrap gap-3 text-xs">
                                  {aiRes.name && (
                                    <span className="bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded">
                                      <strong>Tên:</strong> {aiRes.name}
                                    </span>
                                  )}
                                  {aiRes.category && (
                                    <span className="bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded">
                                      <strong>Danh mục:</strong> {aiRes.category}
                                    </span>
                                  )}
                                  {aiRes.condition && (
                                    <span className="bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded">
                                      <strong>Tình trạng:</strong> {aiRes.condition}
                                    </span>
                                  )}
                                  {aiRes.confidence != null && (
                                    <span className="bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded">
                                      <strong>Độ tin cậy:</strong> {(aiRes.confidence * 100).toFixed(0)}%
                                    </span>
                                  )}
                                  {aiRes.description && (
                                    <span className="bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded">
                                      <strong>Mô tả:</strong> {aiRes.description}
                                    </span>
                                  )}
                                  {aiRes.error && (
                                    <span className="bg-red-100 dark:bg-red-900/50 px-2 py-1 rounded text-red-700 dark:text-red-300">
                                      {aiRes.error}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      )
                    })}
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
                <Button variant="outline" onClick={() => onAction("rejected")} className="text-destructive hover:text-destructive">
                  Từ chối
                </Button>
                <Button variant="default" onClick={() => onAction("accepted")} className="bg-emerald-600 hover:bg-emerald-700">
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
          </div>
          
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
