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
import { ShoppingBagIcon, Ban, EyeIcon } from "lucide-react"

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Active", variant: "default" },
  reserved: { label: "Reserved", variant: "secondary" },
  closed: { label: "Closed", variant: "outline" },
  blocked: { label: "Blocked", variant: "destructive" },
}

interface ListingDetailsDialogProps {
  detailListing: any | null
  onClose: () => void
  onCloseListing: () => void
}

export function ListingDetailsDialog({
  detailListing,
  onClose,
  onCloseListing,
}: ListingDetailsDialogProps) {
  if (!detailListing) return null

  const isActive = detailListing.status === "active"

  return (
    <Dialog open={!!detailListing} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBagIcon className="h-5 w-5" />
            {detailListing.title}
          </DialogTitle>
          <DialogDescription>Chi tiết tin đăng gian hàng 0 đồng</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Main Info */}
          <div className="grid grid-cols-2 gap-4 text-sm bg-muted/50 p-4 rounded-lg">
            <div>
              <span className="text-muted-foreground block mb-1">Chủ gian hàng (Người đăng):</span>
              <span className="font-medium">
                {detailListing.ownerProfile 
                  ? (detailListing.ownerProfile.full_name || detailListing.ownerProfile.name || `@${detailListing.ownerProfile.username || ''}`) 
                  : (detailListing.group_id ? 'Nhóm thiện nguyện' : (detailListing.user_id?.substring(0, 8) + "..."))}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">Trạng thái:</span>
              <Badge variant={statusConfig[detailListing.status]?.variant || "secondary"}>
                {statusConfig[detailListing.status]?.label || detailListing.status}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">Số lượng / Tồn kho:</span>
              <span className="font-medium">{detailListing.quantity_available} / {detailListing.quantity_total}</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">Lượt xem:</span>
              <span className="font-medium flex items-center gap-1">
                <EyeIcon className="h-4 w-4 text-muted-foreground" />
                {detailListing.view_count}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground block mb-1">Khu vực / Địa chỉ:</span>
              <span className="font-medium">{detailListing.district_name || 'Không rõ'}, {detailListing.province_name || 'Không rõ'}</span>
            </div>
          </div>

          {/* Description */}
          {detailListing.description && (
            <div>
              <span className="text-sm font-medium">Mô tả tin đăng:</span>
              <p className="text-sm mt-1 bg-secondary/50 p-3 rounded whitespace-pre-wrap">{detailListing.description}</p>
            </div>
          )}

          {/* Images */}
          {detailListing.images && detailListing.images.length > 0 && (
            <div>
              <span className="text-sm font-medium mb-2 block">Hình ảnh đính kèm ({detailListing.images.length}):</span>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {detailListing.images.map((img: any) => (
                  <div key={img.id} className="relative min-w-[150px] h-[150px] rounded-md overflow-hidden border">
                    {/* Fallback styling for images if URLs are broken */}
                    <img 
                      src={img.url} 
                      alt="Listing Image" 
                      className="object-cover w-full h-full"
                      onError={(e) => { (e.target as any).src = 'https://via.placeholder.com/150?text=No+Image' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6 flex sm:justify-between items-center border-t pt-4">
          <div>
            {isActive && (
              <Button variant="destructive" onClick={onCloseListing}>
                <Ban className="w-4 h-4 mr-2" /> Đóng tin đăng
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={onClose}>
            Thoát
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
