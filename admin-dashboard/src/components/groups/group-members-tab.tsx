import { Badge } from "@/components/ui/badge"
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
import { Group } from "@/types"

interface GroupMembersTabProps {
  groupMembers: any[]
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
    return <p className="text-sm text-muted-foreground text-center py-4">Không có thành viên nào</p>
  }

  return (
    <div className="space-y-3">
      {groupMembers.map((m: any) => (
        <div key={m.id} className="flex justify-between items-center text-sm border-b pb-2 last:border-0">
          <div className="overflow-hidden mr-2">
            <p className="font-medium truncate">
              {m.profile ? (m.profile.full_name || `@${m.profile.username}`) : m.user_id}
            </p>
            <p className="text-xs text-muted-foreground">Tham gia: {new Date(m.joined_at).toLocaleDateString("vi-VN")}</p>
          </div>
          <Select
            value={m.role}
            onValueChange={(v) => handleRoleChange(m.user_id, v)}
            disabled={updatingUser === m.user_id}
          >
            <SelectTrigger className="w-[140px] h-8 text-xs">
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
