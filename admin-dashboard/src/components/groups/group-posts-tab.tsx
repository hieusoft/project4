import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { communityApi } from "@/lib/api/client"
import { toast } from "sonner"
import { GroupPost } from "@/types"
import { Heart, MessageCircle, Newspaper, Pin, Trash2 } from "lucide-react"
import { useState } from "react"
import { SafeImage } from "@/components/ui/safe-image"

interface GroupPostsTabProps {
  groupPosts: GroupPost[]
  onRefresh?: () => void
}

export function GroupPostsTab({ groupPosts, onRefresh }: GroupPostsTabProps) {
  const [deletingPost, setDeletingPost] = useState<string | null>(null)

  if (groupPosts.length === 0) {
    return <div className="flex flex-col items-center rounded-2xl border border-dashed py-12 text-center text-muted-foreground"><Newspaper className="mb-3 size-8" /><p className="font-medium">Chưa có bài viết</p><p className="mt-1 text-xs">Nội dung gần đây của nhóm sẽ xuất hiện tại đây.</p></div>
  }

  return (
    <div className="space-y-3">
      {groupPosts.map((p) => (
        <div key={p.id} className="rounded-2xl border p-4 text-sm">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{p.type || "normal"}</Badge>{p.is_pinned && <Badge variant="outline" className="gap-1"><Pin className="size-3" />Đã ghim</Badge>}<Badge variant={p.status === "active" ? "default" : "outline"}>{p.status}</Badge></div><p className="mt-3 line-clamp-3 whitespace-pre-wrap leading-6">{p.content || "Bài viết không có nội dung"}</p></div>{p.images?.[0] && <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-muted-foreground"><SafeImage src={p.images[0].image_url} alt="Ảnh bài viết" className="size-full object-cover" fallback={<Newspaper className="size-6" />} /></div>}</div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
            <div className="flex items-center gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Heart className="size-3.5" />{p.like_count}</span><span className="flex items-center gap-1"><MessageCircle className="size-3.5" />{p.comment_count}</span><span>{new Date(p.created_at).toLocaleDateString("vi-VN")}</span></div>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={deletingPost === p.id}
              onClick={async () => {
                if (!confirm("Bạn có chắc muốn xóa bài viết này không?")) return
                setDeletingPost(p.id)
                try {
                  await communityApi.deletePost(p.id)
                  toast.success("Đã xóa bài viết")
                  onRefresh?.()
                } catch (error) {
                  toast.error("Lỗi xóa bài viết: " + (error instanceof Error ? error.message : "Không xác định"))
                } finally {
                  setDeletingPost(null)
                }
              }}
            >
              <Trash2 className="size-4" />
              {deletingPost === p.id ? "Đang xóa..." : "Xóa bài viết"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
