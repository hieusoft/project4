import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface RequestTableProps {
  requests: any[]
  loading: boolean
  page: number
  limit: number
  onPageChange: (page: number) => void
}

export function RequestTable({ requests, loading, page, limit, onPageChange }: RequestTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="outline" className="text-yellow-500">Chờ duyệt</Badge>
      case "approved": return <Badge variant="default" className="bg-blue-500">Đã duyệt</Badge>
      case "completed": return <Badge variant="default" className="bg-emerald-500">Hoàn thành</Badge>
      case "rejected": return <Badge variant="destructive">Từ chối</Badge>
      case "cancelled": return <Badge variant="secondary">Đã hủy</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <>
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã YC</TableHead>
              <TableHead>Người nhận</TableHead>
              <TableHead>Lý do</TableHead>
              <TableHead>Nhóm xử lý</TableHead>
              <TableHead>Số lượng</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Ngày tạo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">Đang tải...</TableCell>
              </TableRow>
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">Không có yêu cầu nào.</TableCell>
              </TableRow>
            ) : (
              requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.code || "N/A"}</TableCell>
                  <TableCell>
                    {r.receiverProfile ? (
                      <div>
                        <p className="font-medium">{r.receiverProfile.full_name}</p>
                        <p className="text-xs text-muted-foreground">{r.receiverProfile.email || r.receiverProfile.phone || r.receiver_id}</p>
                      </div>
                    ) : (
                      <span className="text-xs">{r.receiver_id}</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={r.reason}>
                    {r.reason || "—"}
                  </TableCell>
                  <TableCell>
                    {r.groupProfile ? r.groupProfile.name : "N/A"}
                  </TableCell>
                  <TableCell>{r.quantity}</TableCell>
                  <TableCell>{getStatusBadge(r.status)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(r.created_at).toLocaleDateString("vi-VN")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 mt-4">
        <button
          className="px-3 py-1 text-sm border rounded hover:bg-muted disabled:opacity-50"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          Trước
        </button>
        <span className="text-sm">Trang {page}</span>
        <button
          className="px-3 py-1 text-sm border rounded hover:bg-muted disabled:opacity-50"
          disabled={requests.length < limit}
          onClick={() => onPageChange(page + 1)}
        >
          Sau
        </button>
      </div>
    </>
  )
}
