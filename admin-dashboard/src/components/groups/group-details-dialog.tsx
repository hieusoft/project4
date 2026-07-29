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
import { Group, GroupMember, GroupPost, Profile } from "@/types"
import { MapPin, Settings2, ShieldCheck, Users, CalendarDays, Copy, HeartHandshake, Star, UserRound } from "lucide-react"
import { GroupMembersTab } from "./group-members-tab"
import { GroupPostsTab } from "./group-posts-tab"
import { SafeImage } from "@/components/ui/safe-image"

interface GroupDetailsDialogProps {
  dialogGroup: Group | null
  dialogAction: "approve" | "suspend" | "view"
  loadingDetails: boolean
  groupDetails: Group | null
  groupMembers: GroupMember[]
  groupPosts: GroupPost[]
  ownerProfile?: Profile
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
  ownerProfile,
  onClose,
  onRefresh,
}: GroupDetailsDialogProps) {
  if (dialogAction !== "view") return null

  return (
    <Dialog
      open={!!dialogGroup && dialogAction === "view"}
      onOpenChange={(open) => !open && onClose()}
    >
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Hồ sơ nhóm thiện nguyện</DialogTitle>
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
              <TabsList className="grid h-auto w-full grid-cols-3">
                <TabsTrigger value="info" className="px-2">Thông tin</TabsTrigger>
                <TabsTrigger value="members" className="px-2">Thành viên <span className="hidden sm:inline">({groupMembers.length})</span></TabsTrigger>
                <TabsTrigger value="posts" className="px-2">Bài viết <span className="hidden sm:inline">({groupPosts.length})</span></TabsTrigger>
              </TabsList>
              
              <TabsContent value="info" className="mt-4 space-y-4">
                <div className="relative overflow-hidden rounded-3xl border bg-muted/30">
                  <div className="h-28 bg-gradient-to-r from-[#5c1018] via-primary to-secondary">
                    <SafeImage src={groupDetails.cover_url} alt="" className="size-full object-cover opacity-70" fallback={null} />
                  </div>
                  <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end">
                    <div className="-mt-12 flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border-4 border-background bg-primary/10 text-3xl font-bold text-primary shadow-lg">
                      <SafeImage src={groupDetails.avatar_url} alt="" className="size-full object-cover" fallback={groupDetails.name.charAt(0).toUpperCase()} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-bold">{groupDetails.name}</h3>
                        <Badge variant={groupDetails.status === "active" ? "default" : groupDetails.status === "pending" ? "secondary" : groupDetails.status === "closed" ? "outline" : "destructive"}>
                          {groupDetails.status === "active" ? "Đang hoạt động" : groupDetails.status === "pending" ? "Chờ duyệt" : groupDetails.status === "suspended" ? "Đình chỉ" : "Đã đóng"}
                        </Badge>
                      </div>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">/{groupDetails.slug}</p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { icon: Users, label: "Thành viên", value: groupDetails.member_count.toLocaleString("vi-VN") },
                    { icon: Star, label: "Điểm uy tín", value: groupDetails.reputation_score.toLocaleString("vi-VN") },
                    { icon: CalendarDays, label: "Ngày thành lập", value: new Date(groupDetails.created_at).toLocaleDateString("vi-VN") },
                    { icon: ShieldCheck, label: "Mã nhóm", value: `${groupDetails.id.slice(0, 8)}...` },
                  ].map(({ icon: Icon, label, value }) => <div key={label} className="rounded-2xl border bg-card p-3"><Icon className="size-4 text-primary" /><p className="mt-2 text-xs text-muted-foreground">{label}</p><p className="mt-0.5 truncate font-semibold">{value}</p></div>)}
                </div>
                <div className="grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
                  <div className="rounded-2xl border p-4"><div className="flex items-center gap-2 font-semibold"><HeartHandshake className="size-4 text-primary" />Giới thiệu</div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{groupDetails.description || "Nhóm chưa cập nhật phần giới thiệu."}</p></div>
                  <div className="space-y-4"><div className="rounded-2xl border p-4"><div className="flex items-center gap-2 font-semibold"><UserRound className="size-4 text-primary" />Người phụ trách</div><div className="mt-3 flex items-center gap-3"><div className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-bold text-primary"><SafeImage src={ownerProfile?.avatar_url} alt="" className="size-full object-cover" fallback={(ownerProfile?.full_name || ownerProfile?.username || "?").charAt(0).toUpperCase()} /></div><div className="min-w-0"><p className="truncate text-sm font-semibold">{ownerProfile?.full_name || ownerProfile?.username || "Chưa có thông tin"}</p><p className="truncate text-xs text-muted-foreground">@{ownerProfile?.username || groupDetails.owner_id.slice(0, 8)}</p></div></div></div><div className="rounded-2xl border p-4"><div className="flex items-center gap-2 font-semibold"><MapPin className="size-4 text-primary" />Khu vực hoạt động</div><p className="mt-3 text-sm text-muted-foreground">{[groupDetails.address, groupDetails.district_code, groupDetails.province_code].filter(Boolean).join(", ") || "Chưa cập nhật địa chỉ"}</p><div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Settings2 className="size-3.5" />{groupDetails.allow_member_post ? "Cho phép thành viên đăng bài" : "Hạn chế thành viên đăng bài"}</div><div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Copy className="size-3.5" />{groupDetails.require_post_review ? "Bài viết cần duyệt" : "Bài viết đăng trực tiếp"}</div></div></div>
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
