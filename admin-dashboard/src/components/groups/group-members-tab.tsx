
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useState } from "react"
import { communityApi } from "@/lib/api/client"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Group, GroupMember } from "@/types"
import { CalendarDays, ShieldCheck, Users } from "lucide-react"
import { SafeImage } from "@/components/ui/safe-image"

interface GroupMembersTabProps {
  groupMembers: GroupMember[]
  dialogGroup: Group | null
  onRefresh?: () => void
}

export function GroupMembersTab({ groupMembers, dialogGroup, onRefresh }: GroupMembersTabProps) {
  const [updatingUser, setUpdatingUser] = useState<string | null>(null)

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!dialogGroup) return
    setUpdatingUser(userId)
    try {
      await communityApi.setMemberRole(dialogGroup.id, userId, newRole)
      toast.success("Đã cập nhật vai trò thành công!")
      if (onRefresh) onRefresh()
    } catch (err: any) {
      toast.error(`Lỗi cập nhật vai trò: ${err.message}`)
    } finally {
      setUpdatingUser(null)
    }
  }

  if (groupMembers.length === 0) {
    return <div className="flex flex-col items-center rounded-2xl border border-dashed py-12 text-center text-muted-foreground"><Users className="mb-3 size-8" /><p className="font-medium">Chưa có thành viên</p><p className="mt-1 text-xs">Danh sách thành viên được duyệt sẽ xuất hiện tại đây.</p></div>
  }

  return (
    <div className="space-y-2">
      {groupMembers.map((m) => (
        <div key={m.id} className="flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-bold text-primary">
              <SafeImage src={m.profile?.avatar_url} alt="" className="size-full object-cover" fallback={(m.profile?.full_name || m.profile?.username || "?").charAt(0).toUpperCase()} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold">{m.profile?.full_name || m.profile?.username || "Chưa có thông tin"}</p>{m.role === "owner" && <Badge variant="outline" className="gap-1"><ShieldCheck className="size-3" />Chủ nhóm</Badge>}</div>
              <p className="truncate text-xs text-muted-foreground">@{m.profile?.username || m.user_id.slice(0, 8)}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="size-3" />Tham gia {new Date(m.joined_at || m.created_at).toLocaleDateString("vi-VN")}</p>
            </div>
          </div>
          <Select
            value={m.role}
            onValueChange={(v) => v && handleRoleChange(m.user_id, v)}
            disabled={updatingUser === m.user_id}
          >
            <SelectTrigger className="h-9 w-full text-xs sm:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Thành viên</SelectItem>
              <SelectItem value="moderator">Người kiểm duyệt</SelectItem>
              <SelectItem value="owner">Chủ nhóm</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  )
}
