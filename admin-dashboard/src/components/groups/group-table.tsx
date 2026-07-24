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
import { Group } from "@/types"
import { CheckCircle, XCircle, HeartHandshakeIcon, EyeIcon } from "lucide-react"

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "ACTIVE", variant: "default" },
  pending: { label: "PENDING", variant: "secondary" },
  suspended: { label: "SUSPENDED", variant: "destructive" },
  closed: { label: "CLOSED", variant: "outline" },
}

interface GroupTableProps {
  groups: Group[]
  loading: boolean
  total: number
  page: number
  limit: number
  onPageChange: (newPage: number) => void
  onActionClick: (group: Group, action: "approve" | "suspend") => void
  onViewClick: (group: Group) => void
}

export function GroupTable({
  groups,
  loading,
  total,
  page,
  limit,
  onPageChange,
  onActionClick,
  onViewClick,
}: GroupTableProps) {
  const totalPages = Math.ceil(total / limit)

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tên nhóm</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Thành viên</TableHead>
            <TableHead>Đánh giá</TableHead>
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
          ) : groups.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-12">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <HeartHandshakeIcon className="h-8 w-8" />
                  <p>Không tìm thấy nhóm</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            groups.map((group) => (
              <TableRow key={group.id}>
                <TableCell className="font-medium">{group.name}</TableCell>
                <TableCell className="text-muted-foreground font-mono text-sm">
                  {group.slug}
                </TableCell>
                <TableCell>
                  <Badge variant={statusConfig[group.status]?.variant || "secondary"}>
                    {statusConfig[group.status]?.label || group.status}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums">{group.member_count}</TableCell>
                <TableCell className="tabular-nums">{group.reputation_score}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(group.created_at).toLocaleDateString("vi-VN")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onViewClick(group)}
                    >
                      <EyeIcon className="h-4 w-4" />
                    </Button>
                    
                    {group.status === "pending" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onActionClick(group, "approve")}
                      >
                        <CheckCircle className="h-4 w-4 mr-1 hidden lg:block" />
                        Duyệt
                      </Button>
                    )}
                    {group.status === "active" && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onActionClick(group, "suspend")}
                      >
                        <XCircle className="h-4 w-4 mr-1 hidden lg:block" />
                        Đình chỉ
                      </Button>
                    )}
                  </div>
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
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Sau
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
