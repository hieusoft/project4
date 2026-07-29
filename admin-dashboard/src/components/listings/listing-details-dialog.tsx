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
import { ShoppingBagIcon, Ban, EyeIcon, Boxes, ImageIcon, MapPin, UserRound } from "lucide-react"
import { ListingWithRelations } from "@/types"
import { SafeImage } from "@/components/ui/safe-image"

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Đang hiển thị", variant: "default" },
  reserved: { label: "Đã giữ chỗ", variant: "secondary" },
  closed: { label: "Đã hoàn tất", variant: "outline" },
  blocked: { label: "Đã khóa", variant: "destructive" },
}

interface ListingDetailsDialogProps {
  detailListing: ListingWithRelations | null
  onClose: () => void
  onCloseListing: () => void
  currentUser: Record<string, unknown> | null
}

export function ListingDetailsDialog({
  detailListing,
  onClose,
  onCloseListing,
  currentUser,
}: ListingDetailsDialogProps) {
  if (!detailListing) return null

  const isActive = detailListing.status === "active"

  return (
    <Dialog open={!!detailListing} onOpenChange={onClose}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBagIcon className="h-5 w-5" />
            {detailListing.title}
          </DialogTitle>
          <DialogDescription>Chi tiết tin đăng gian hàng 0 đồng</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
            <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-3xl border bg-muted text-muted-foreground">
              <SafeImage src={detailListing.images?.[0]?.image_url} alt={detailListing.title} className="size-full object-cover" fallback={<ImageIcon className="size-12" />} />
            </div>
            <div className="space-y-4 rounded-3xl border bg-muted/30 p-5">
              <div className="flex flex-wrap items-center gap-2"><Badge variant={statusConfig[detailListing.status]?.variant || "secondary"}>{statusConfig[detailListing.status]?.label || detailListing.status}</Badge><Badge variant="outline">{detailListing.category?.name || "Chưa phân loại"}</Badge></div>
              <div><p className="text-xs text-muted-foreground">Nhóm quản lý</p><p className="mt-1 font-semibold">{detailListing.group?.name || "Nhóm thiện nguyện"}</p></div>
              <div><p className="flex items-center gap-1 text-xs text-muted-foreground"><UserRound className="size-3.5" />Người đăng</p><p className="mt-1 font-semibold">{detailListing.creatorProfile?.full_name || detailListing.creatorProfile?.username || detailListing.created_by.slice(0, 8)}</p></div>
              <div className="grid grid-cols-2 gap-3"><div className="rounded-2xl border bg-card p-3"><Boxes className="size-4 text-primary" /><p className="mt-2 text-xs text-muted-foreground">Tồn kho</p><p className="font-bold tabular-nums">{detailListing.quantity_available}/{detailListing.quantity_total}</p></div><div className="rounded-2xl border bg-card p-3"><EyeIcon className="size-4 text-primary" /><p className="mt-2 text-xs text-muted-foreground">Lượt xem</p><p className="font-bold tabular-nums">{detailListing.view_count}</p></div></div>
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="size-4" />{[detailListing.district_code, detailListing.province_code].filter(Boolean).join(", ") || "Chưa cập nhật khu vực"}</p>
              <p className="text-xs text-muted-foreground">Tạo ngày {new Date(detailListing.created_at).toLocaleString("vi-VN")}</p>
            </div>
          </div>

          {/* Description */}
          <div className="rounded-2xl border p-4"><span className="text-sm font-semibold">Mô tả tin đăng</span><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{detailListing.description || "Tin đăng chưa có mô tả."}</p></div>

          {/* Images */}
          {detailListing.images && detailListing.images.length > 0 && (
            <div>
              <span className="text-sm font-medium mb-2 block">Hình ảnh đính kèm ({detailListing.images.length}):</span>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {detailListing.images.map((img) => (
                  <div key={img.id} className="relative flex h-32 min-w-32 items-center justify-center overflow-hidden rounded-2xl border bg-muted text-muted-foreground">
                    <SafeImage src={img.image_url} alt="Ảnh tin đăng" className="size-full object-cover" fallback={<ImageIcon className="size-6" />} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6 flex sm:justify-between items-center border-t pt-4">
          <div>
            {isActive && (!currentUser?.roles || !(currentUser.roles as string[]).includes("PLATFORM_ADMIN")) && (
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
