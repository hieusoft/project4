import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, HandHeartIcon, ImageIcon } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ItemRequestWithRelations } from "@/types"
import { SafeImage } from "@/components/ui/safe-image"

interface RequestTableProps {
  requests: ItemRequestWithRelations[]
  loading: boolean
  page: number
  limit: number
  total: number
  onPageChange: (page: number) => void
  onViewClick: (request: ItemRequestWithRelations) => void
}

export function RequestTable({ requests, loading, page, limit, total, onPageChange, onViewClick }: RequestTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="outline" className="text-yellow-600">Chờ duyệt</Badge>
      case "approved": return <Badge variant="default" className="bg-blue-500">Đã duyệt</Badge>
      case "scheduled": return <Badge variant="secondary">Đã hẹn lịch</Badge>
      case "completed": return <Badge variant="default" className="bg-emerald-500">Đã bàn giao</Badge>
      case "rejected": return <Badge variant="destructive">Đã từ chối</Badge>
      case "cancelled": return <Badge variant="secondary">Đã hủy</Badge>
      case "no_show": return <Badge variant="destructive">Không đến nhận</Badge>
      default: return <Badge variant="outline">{status.toUpperCase()}</Badge>
    }
  }

  return (
    <>
      <div className="admin-table-wrap">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã YC</TableHead>
              <TableHead>Người nhận</TableHead>
              <TableHead>Vật phẩm</TableHead>
              <TableHead>Nhóm xử lý</TableHead>
              <TableHead>Số lượng</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Ngày tạo</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">Đang tải...</TableCell>
              </TableRow>
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">Không có yêu cầu nào.</TableCell>
              </TableRow>
            ) : (
              requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono font-medium">{r.code || "N/A"}</TableCell>
                  <TableCell>
                    <div className="flex min-w-40 items-center gap-2.5"><div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-bold text-primary"><SafeImage src={r.receiverProfile?.avatar_url} alt="" className="size-full object-cover" fallback={(r.receiverProfile?.full_name || r.receiverProfile?.username || "?").charAt(0).toUpperCase()} /></div><div className="min-w-0"><p className="truncate font-medium">{r.receiverProfile?.full_name || r.receiverProfile?.username || "Chưa có thông tin"}</p><p className="truncate text-xs text-muted-foreground">@{r.receiverProfile?.username || r.receiver_id.slice(0, 8)}</p></div></div>
                  </TableCell>
                  <TableCell><div className="flex min-w-48 items-center gap-3"><div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-muted-foreground"><SafeImage src={r.listing?.images?.[0]?.image_url} alt="" className="size-full object-cover" fallback={<ImageIcon className="size-4" />} /></div><div className="min-w-0"><p className="max-w-48 truncate font-medium">{r.listing?.title || "Không rõ vật phẩm"}</p><p className="max-w-48 truncate text-xs text-muted-foreground" title={r.reason}>{r.reason || "Không có lý do"}</p></div></div></TableCell>
                  <TableCell>
                    {r.group?.name || "Không rõ nhóm"}
                  </TableCell>
                  <TableCell>{r.quantity}</TableCell>
                  <TableCell>{getStatusBadge(r.status)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(r.created_at).toLocaleDateString("vi-VN")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => onViewClick(r)}>
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
      {total > 0 && <div className="mt-4 flex items-center justify-between border-t pt-4">
        <p className="text-sm text-muted-foreground">Hiển thị {(page - 1) * limit + 1}–{Math.min(page * limit, total)} / {total}</p>
        <div className="flex items-center gap-2">
        <button
          className="rounded border px-3 py-1 text-sm hover:bg-muted disabled:opacity-50"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          Trước
        </button>
        <button
          className="rounded border px-3 py-1 text-sm hover:bg-muted disabled:opacity-50"
          disabled={page >= Math.ceil(total / limit)}
          onClick={() => onPageChange(page + 1)}
        >
          Sau
        </button>
        </div>
      </div>}
    </>
  )
}
