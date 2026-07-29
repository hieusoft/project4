import Link from "next/link"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, BarChart3 } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts"

interface ActivityChartProps {
  chartData: any[]
  pendingGroups: any[]
  loading: boolean
}

export function ActivityChart({ chartData, pendingGroups, loading }: ActivityChartProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="admin-surface lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Hoạt động 14 ngày qua</CardTitle>
              <p className="text-sm text-muted-foreground">So sánh quyên góp, yêu cầu và vật phẩm đã trao</p>
            </div>
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <BarChart3 className="h-4 w-4" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 && !loading && (
             <p className="text-sm text-muted-foreground text-center py-4">Chưa có dữ liệu thống kê</p>
          )}
          {loading && <Skeleton className="h-[300px] w-full" />}
          {chartData.length > 0 && (
            <div style={{ width: '100%', minHeight: 300 }}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.12} />
                  <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Bar dataKey="Quyên góp" fill="var(--chart-2)" radius={[8, 8, 0, 0]} maxBarSize={34} />
                  <Bar dataKey="Yêu cầu" fill="var(--chart-3)" radius={[8, 8, 0, 0]} maxBarSize={34} />
                  <Bar dataKey="Bàn giao" fill="var(--chart-1)" radius={[8, 8, 0, 0]} maxBarSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card className="admin-surface lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-base text-red-600 dark:text-red-400 flex items-center gap-2">
             <AlertCircle className="h-4 w-4" /> Cần duyệt gấp
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingGroups.length === 0 && !loading && (
             <div className="text-center py-8 text-muted-foreground">
               <p className="text-sm">Không có mục nào cần duyệt</p>
             </div>
          )}
          {loading && <div className="space-y-3"><Skeleton className="h-10 w-full"/><Skeleton className="h-10 w-full"/></div>}
          <div className="space-y-4">
            {pendingGroups.map(group => (
              <Link href="/groups" key={group.id}>
                <div className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0 hover:bg-muted/50 p-2 rounded-md transition-colors cursor-pointer">
                  <div className="overflow-hidden mr-2">
                    <p className="text-sm font-medium truncate">{group.name}</p>
                    <p className="text-xs text-muted-foreground">Nhóm thiện nguyện</p>
                  </div>
                  <Badge variant="destructive" className="whitespace-nowrap">Chờ duyệt</Badge>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
