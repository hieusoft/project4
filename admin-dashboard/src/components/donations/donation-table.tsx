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
import { Donation, DonationWithDonor } from "@/types"
import { Eye, PackageIcon, Truck } from "lucide-react"
import { SafeImage } from "@/components/ui/safe-image"

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Chờ duyệt", variant: "outline" },
  accepted: { label: "Đã chấp nhận", variant: "default" },
  scheduled: { label: "Đã hẹn lịch", variant: "secondary" },
  received: { label: "Đã nhận", variant: "default" },
  completed: { label: "Hoàn thành", variant: "default" },
  rejected: { label: "Đã từ chối", variant: "destructive" },
  cancelled: { label: "Đã hủy", variant: "outline" },
}

interface DonationTableProps {
  donations: DonationWithDonor[]
  loading: boolean
  total: number
  page: number
  limit: number
  onPageChange: (newPage: number) => void
  onViewClick: (donation: Donation) => void
}

export function DonationTable({
  donations,
  loading,
  total,
  page,
  limit,
  onPageChange,
  onViewClick,
}: DonationTableProps) {
  const totalPages = Math.ceil(total / limit)

  return (
    <>
      <div className="admin-table-wrap">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mã đơn</TableHead>
            <TableHead>Tiêu đề</TableHead>
            <TableHead>Người quyên góp</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Vật phẩm</TableHead>
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
          ) : donations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-12">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <PackageIcon className="h-8 w-8" />
                  <p>Không tìm thấy đơn quyên góp</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            donations.map((donation) => {
              const previewImage = donation.items?.flatMap((item) => item.images || [])[0]?.image_url
              return (
              <TableRow key={donation.id}>
                <TableCell className="font-mono text-sm">
                  {donation.code}
                </TableCell>
                <TableCell>
                  <div className="flex min-w-48 items-center gap-3"><div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-muted-foreground"><SafeImage src={previewImage} alt="" className="size-full object-cover" fallback={<PackageIcon className="size-4" />} /></div><div className="min-w-0"><p className="max-w-52 truncate font-semibold">{donation.title}</p><p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Truck className="size-3" />{donation.pickup_method === "pickup" ? "Đến lấy" : "Mang đến nhóm"}</p></div></div>
                </TableCell>
                <TableCell>
                  <div className="flex min-w-40 items-center gap-2.5"><div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-bold text-primary"><SafeImage src={donation.donorProfile?.avatar_url} alt="" className="size-full object-cover" fallback={(donation.donorProfile?.full_name || donation.donorProfile?.username || "?").charAt(0).toUpperCase()} /></div><div className="min-w-0"><p className="truncate font-medium">{donation.donorProfile?.full_name || donation.donorProfile?.username || "Chưa có thông tin"}</p><p className="truncate text-xs text-muted-foreground">@{donation.donorProfile?.username || donation.donor_id.substring(0, 8)}</p></div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={statusConfig[donation.status]?.variant || "secondary"}>
                    {statusConfig[donation.status]?.label || donation.status}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums">{donation.items?.length || 0} mục</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(donation.created_at).toLocaleDateString("vi-VN")}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewClick(donation)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Chi tiết
                  </Button>
                </TableCell>
              </TableRow>
            )})
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
