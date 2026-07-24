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
import { Eye, ShoppingBagIcon, ImageIcon } from "lucide-react"

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Active", variant: "default" },
  reserved: { label: "Reserved", variant: "secondary" },
  closed: { label: "Closed", variant: "outline" },
  blocked: { label: "Blocked", variant: "destructive" },
}

interface ListingTableProps {
  listings: any[]
  loading: boolean
  total: number
  page: number
  limit: number
  onPageChange: (newPage: number) => void
  onViewClick: (listing: any) => void
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tiêu đề</TableHead>
            <TableHead>Người đăng / Nhóm</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Tồn kho</TableHead>
            <TableHead>Ảnh</TableHead>
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
                <TableCell className="font-medium max-w-[250px] truncate">
                  {listing.title}
                </TableCell>
                <TableCell>
                  <span className="font-medium">
                    {listing.ownerProfile 
                      ? (listing.ownerProfile.full_name || listing.ownerProfile.name || `@${listing.ownerProfile.username || ''}`) 
                      : (listing.group_id ? 'Nhóm thiện nguyện' : (listing.user_id?.substring(0, 8) + "..."))}
                  </span>
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
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <ImageIcon className="h-4 w-4" />
                    <span className="tabular-nums">{listing.images?.length || 0}</span>
                  </div>
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
