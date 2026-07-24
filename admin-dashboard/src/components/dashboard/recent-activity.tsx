import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Users, Package } from "lucide-react"

interface RecentActivityProps {
  recentDonations: any[]
  recentGroups: any[]
  loading: boolean
}

export function RecentActivity({ recentDonations, recentGroups, loading }: RecentActivityProps) {
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      {/* Recent Donations */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Quyên góp mới nhất</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {recentDonations.length === 0 && !loading && (
             <p className="text-sm text-muted-foreground text-center py-4">Chưa có dữ liệu</p>
          )}
          {loading && <div className="space-y-3"><Skeleton className="h-10 w-full"/><Skeleton className="h-10 w-full"/></div>}
          <div className="space-y-4">
            {recentDonations.map(donation => (
              <div key={donation.id} className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0">
                <div className="overflow-hidden mr-2">
                  <p className="text-sm font-medium truncate">{donation.title || "Vật phẩm quyên góp"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(donation.created_at).toLocaleDateString("vi-VN")}</p>
                </div>
                <Badge variant="outline" className="whitespace-nowrap">{donation.status || "PENDING"}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Groups */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Nhóm từ thiện mới</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {recentGroups.length === 0 && !loading && (
             <p className="text-sm text-muted-foreground text-center py-4">Chưa có dữ liệu</p>
          )}
          {loading && <div className="space-y-3"><Skeleton className="h-10 w-full"/><Skeleton className="h-10 w-full"/></div>}
          <div className="space-y-4">
            {recentGroups.map(group => (
              <div key={group.id} className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0">
                <div className="overflow-hidden mr-2">
                  <p className="text-sm font-medium truncate">{group.name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(group.created_at).toLocaleDateString("vi-VN")}</p>
                </div>
                <Badge variant="secondary" className="whitespace-nowrap">{group.member_count || 0} tv</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
