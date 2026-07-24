import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Group } from "@/types"
import { communityApi } from "@/lib/api/client"
import { toast } from "sonner"
import { useState } from "react"

interface GroupDetailsDialogProps {
  dialogGroup: Group | null
  dialogAction: "approve" | "suspend" | "view"
  loadingDetails: boolean
  groupDetails: any
  groupMembers: any[]
  groupPosts: any[]
  onClose: () => void
  onRefresh?: () => void
}

export function GroupDetailsDialog({
  dialogGroup,
  dialogAction,
  loadingDetails,
  groupDetails,
  groupMembers,
  groupPosts,
  onClose,
  onRefresh,
}: GroupDetailsDialogProps) {
  const [updatingUser, setUpdatingUser] = useState<string | null>(null)

  if (dialogAction !== "view") return null

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

  return (
    <Dialog
      open={!!dialogGroup && dialogAction === "view"}
      onOpenChange={() => onClose()}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Thông tin chi tiết nhóm</DialogTitle>
          <DialogDescription>
            Chi tiết, thành viên và bài viết gần đây
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {loadingDetails ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : groupDetails ? (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info">Thông tin</TabsTrigger>
                <TabsTrigger value="members">Thành viên ({groupMembers.length})</TabsTrigger>
                <TabsTrigger value="posts">Bài viết ({groupPosts.length})</TabsTrigger>
              </TabsList>
              
              <TabsContent value="info" className="space-y-4 mt-4 text-sm">
                {groupDetails.cover_image_url && (
                  <div className="h-32 w-full rounded-md overflow-hidden bg-muted">
                    <img src={groupDetails.cover_image_url} alt="Cover" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-muted-foreground mb-1">Tên nhóm</p>
                    <p className="font-medium">{groupDetails.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Khu vực</p>
                    <p className="font-medium">{groupDetails.province_code || "—"}</p>
                  </div>
                </div>
                {groupDetails.description && (
                  <div>
                    <p className="text-muted-foreground mb-1">Mô tả</p>
                    <p className="bg-secondary p-3 rounded text-secondary-foreground text-xs whitespace-pre-wrap">{groupDetails.description}</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="members" className="mt-4">
                {groupMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Không có thành viên nào</p>
                ) : (
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
                )}
              </TabsContent>
              
              <TabsContent value="posts" className="mt-4">
                {groupPosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Không có bài viết nào</p>
                ) : (
                  <div className="space-y-3">
                    {groupPosts.map((p: any) => (
                      <div key={p.id} className="text-sm border-b pb-3 last:border-0">
                        <p className="font-medium mb-1 truncate">{p.title || p.content?.substring(0, 50) + "..." || "Bài viết không có tiêu đề"}</p>
                        <div className="flex justify-between items-center">
                          <Badge variant="secondary" className="text-[10px]">{p.post_type}</Badge>
                          <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString("vi-VN")}</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 mt-2 text-xs text-destructive hover:bg-destructive/10"
                          onClick={async () => {
                            if (!confirm("Bạn có chắc muốn xóa bài viết này không?")) return;
                            try {
                              await communityApi.deletePost(p.id);
                              toast.success("Xóa bài viết thành công!");
                              if (onRefresh) onRefresh();
                            } catch (e: any) {
                              toast.error("Lỗi xóa bài viết: " + e.message);
                            }
                          }}
                        >
                          Xóa bài viết
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <p className="text-center text-muted-foreground">Không tải được thông tin.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
