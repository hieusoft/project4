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
import { Skeleton } from "@/components/ui/skeleton"
import { Eye, ShoppingBagIcon, ImageIcon, MapPin } from "lucide-react"
import { ListingWithRelations } from "@/types"
import { SafeImage } from "@/components/ui/safe-image"

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Đang hiển thị", variant: "default" },
  reserved: { label: "Đã giữ chỗ", variant: "secondary" },
  closed: { label: "Đã hoàn tất", variant: "outline" },
  blocked: { label: "Đã khóa", variant: "destructive" },
}

interface ListingTableProps {
  listings: ListingWithRelations[]
  loading: boolean
  total: number
  page: number
  limit: number
  onPageChange: (newPage: number) => void
  onViewClick: (listing: ListingWithRelations) => void
}

export function ListingTable({
  listings,
  loading,
  total,
  page,
  limit,
  onPageChange,
  onViewClick,
}: ListingTableProps) {
  const totalPages = Math.ceil(total / limit)

  return (
    <>
      <div className="admin-table-wrap">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tiêu đề</TableHead>
            <TableHead>Người đăng / Nhóm</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Tồn kho</TableHead>
            <TableHead>Khu vực</TableHead>
            <TableHead>Ngày tạo</TableHead>
            <TableHead className="text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 7 }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : listings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-12">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <ShoppingBagIcon className="h-8 w-8" />
                  <p>Không tìm thấy tin đăng</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            listings.map((listing) => (
              <TableRow key={listing.id}>
                <TableCell><div className="flex min-w-56 items-center gap-3"><div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-muted-foreground"><SafeImage src={listing.images?.[0]?.image_url} alt="" className="size-full object-cover" fallback={<ImageIcon className="size-5" />} /></div><div className="min-w-0"><p className="max-w-52 truncate font-semibold">{listing.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{listing.category?.name || "Chưa phân loại"}</p></div></div>
                </TableCell>
                <TableCell>
                  <span className="font-medium">
                     {listing.group?.name || "Nhóm thiện nguyện"}
                   </span>
                   <p className="mt-0.5 text-xs text-muted-foreground">Đăng bởi {listing.creatorProfile?.full_name || listing.creatorProfile?.username || listing.created_by.slice(0, 8)}</p>
                </TableCell>
                <TableCell>
                  <Badge variant={statusConfig[listing.status]?.variant || "secondary"}>
                    {statusConfig[listing.status]?.label || listing.status}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums">
                  {listing.quantity_available}/{listing.quantity_total}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-4 w-4" /><span>{listing.province_code || "Chưa rõ"}</span></div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(listing.created_at).toLocaleDateString("vi-VN")}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewClick(listing)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Chi tiết
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Hiển thị {(page - 1) * limit + 1}–{Math.min(page * limit, total)} / {total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              Trước
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
              Sau
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
