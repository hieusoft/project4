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
import { Group } from "@/types"
import { GroupMembersTab } from "./group-members-tab"
import { GroupPostsTab } from "./group-posts-tab"

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
  if (dialogAction !== "view") return null

  return (
    <Dialog
      open={!!dialogGroup && dialogAction === "view"}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Chi tiết Nhóm</DialogTitle>
          <DialogDescription>
            {dialogGroup?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {loadingDetails ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : groupDetails ? (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info">Thông tin</TabsTrigger>
                <TabsTrigger value="members">Thành viên ({groupMembers.length})</TabsTrigger>
                <TabsTrigger value="posts">Bài viết ({groupPosts.length})</TabsTrigger>
              </TabsList>
              
              <TabsContent value="info" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-semibold text-muted-foreground">Mã nhóm</p>
                    <p>{groupDetails.id}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-muted-foreground">Người tạo (Owner)</p>
                    <p>{groupDetails.owner_id}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="font-semibold text-muted-foreground">Mô tả</p>
                    <p className="whitespace-pre-wrap">{groupDetails.description || "Không có mô tả"}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-muted-foreground">Trạng thái</p>
                    <Badge variant={groupDetails.status === 'active' ? 'default' : 'secondary'}>
                      {groupDetails.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="font-semibold text-muted-foreground">Ngày tạo</p>
                    <p>{new Date(groupDetails.created_at).toLocaleDateString("vi-VN")}</p>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="members" className="mt-4">
                <GroupMembersTab 
                  groupMembers={groupMembers} 
                  dialogGroup={dialogGroup} 
                  onRefresh={onRefresh} 
                />
              </TabsContent>
              
              <TabsContent value="posts" className="mt-4">
                <GroupPostsTab 
                  groupPosts={groupPosts} 
                  onRefresh={onRefresh} 
                />
              </TabsContent>
            </Tabs>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Lỗi tải dữ liệu</p>
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
