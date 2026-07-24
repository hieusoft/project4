import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { communityApi } from "@/lib/api/client"
import { toast } from "sonner"

interface GroupPostsTabProps {
  groupPosts: any[]
  onRefresh?: () => void
}

export function GroupPostsTab({ groupPosts, onRefresh }: GroupPostsTabProps) {
  if (groupPosts.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">Không có bài viết nào</p>
  }

  return (
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
  )
}
