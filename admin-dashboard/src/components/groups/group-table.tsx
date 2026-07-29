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
import { Group, Profile } from "@/types"
import { CheckCircle, XCircle, HeartHandshakeIcon, EyeIcon, MapPin, Users } from "lucide-react"
import { SafeImage } from "@/components/ui/safe-image"

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Đang hoạt động", variant: "default" },
  pending: { label: "Chờ duyệt", variant: "secondary" },
  suspended: { label: "Đình chỉ", variant: "destructive" },
  closed: { label: "Đã đóng", variant: "outline" },
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
  ownerProfiles: Record<string, Profile>
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
  ownerProfiles,
}: GroupTableProps) {
  const totalPages = Math.ceil(total / limit)

  return (
    <>
      <div className="admin-table-wrap">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nhóm thiện nguyện</TableHead>
            <TableHead>Người phụ trách</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Thành viên</TableHead>
            <TableHead>Khu vực</TableHead>
            <TableHead>Ngày thành lập</TableHead>
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
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 font-bold text-primary">
                      <SafeImage src={group.avatar_url} alt="" className="size-full object-cover" fallback={group.name.charAt(0).toUpperCase()} />
                    </div>
                    <div className="min-w-0">
                      <p className="max-w-52 truncate font-semibold">{group.name}</p>
                      <p className="max-w-52 truncate font-mono text-xs text-muted-foreground">{group.slug}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex min-w-40 items-center gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-bold text-primary">
                      <SafeImage
                        src={ownerProfiles[group.owner_id]?.avatar_url}
                        alt=""
                        className="size-full object-cover"
                        fallback={(ownerProfiles[group.owner_id]?.full_name || ownerProfiles[group.owner_id]?.username || "?").charAt(0).toUpperCase()}
                      />
                    </div>
                    <div className="min-w-0 max-w-44 truncate">
                      <p className="truncate font-medium">{ownerProfiles[group.owner_id]?.full_name || ownerProfiles[group.owner_id]?.username || "Chưa có thông tin"}</p>
                      <p className="truncate text-xs text-muted-foreground">@{ownerProfiles[group.owner_id]?.username || group.owner_id.slice(0, 8)}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={statusConfig[group.status]?.variant || "secondary"}>
                    {statusConfig[group.status]?.label || group.status}
                  </Badge>
                </TableCell>
                <TableCell><span className="flex items-center gap-1.5 font-semibold tabular-nums"><Users className="size-3.5 text-muted-foreground" />{group.member_count}</span></TableCell>
                <TableCell><span className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="size-3.5" />{group.province_code || "Chưa rõ"}</span></TableCell>
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
      </div>

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
