import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { ArrowDownToLine, CircleCheck, Package, UsersRound } from "lucide-react"

interface ImpactOverviewProps {
  overview: Record<string, number>
  loading: boolean
}

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"]

function Metric({
  label,
  value,
  icon: Icon,
  color,
  loading,
}: {
  label: string
  value: number
  icon: React.ElementType
  color: string
  loading: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-background/55 p-3">
      <div className={`rounded-xl p-2 ${color}`}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="mt-1 h-6 w-16" />
        ) : (
          <p className="text-xl font-bold tabular-nums">{value.toLocaleString("vi-VN")}</p>
        )}
      </div>
    </div>
  )
}

export function ImpactOverview({ overview, loading }: ImpactOverviewProps) {
  const inventoryData = [
    { name: "Đã nhập kho", value: overview.items_received || 0 },
    { name: "Đã lên kệ", value: overview.items_listed || 0 },
    { name: "Đã bàn giao", value: overview.items_delivered || 0 },
  ]
  const hasInventoryData = inventoryData.some((item) => item.value > 0)

  return (
    <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
      <Card className="admin-surface">
        <CardHeader>
          <div>
            <CardTitle className="text-base">Tác động & hiệu suất</CardTitle>
            <p className="text-sm text-muted-foreground">Các chỉ số tích lũy trên toàn nền tảng</p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Metric
            label="Vật phẩm đã nhập kho"
            value={overview.items_received || 0}
            icon={ArrowDownToLine}
            color="bg-sky-500/10 text-sky-700 dark:text-sky-300"
            loading={loading}
          />
          <Metric
            label="Vật phẩm đã bàn giao"
            value={overview.items_delivered || 0}
            icon={CircleCheck}
            color="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            loading={loading}
          />
          <Metric
            label="Người được hỗ trợ"
            value={overview.people_helped || 0}
            icon={UsersRound}
            color="bg-violet-500/10 text-violet-700 dark:text-violet-300"
            loading={loading}
          />
          <Metric
            label="Thành viên mới"
            value={overview.new_members || 0}
            icon={Package}
            color="bg-amber-500/10 text-amber-700 dark:text-amber-300"
            loading={loading}
          />
        </CardContent>
      </Card>

      <Card className="admin-surface">
        <CardHeader>
          <CardTitle className="text-base">Phân bổ dòng vật phẩm</CardTitle>
          <p className="text-sm text-muted-foreground">Kho → gian hàng → bàn giao</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-2">
              <Skeleton className="size-44 rounded-full" />
            </div>
          ) : !hasInventoryData ? (
            <div className="flex min-h-44 flex-col items-center justify-center text-center text-sm text-muted-foreground">
              <Package className="mb-2 size-8 opacity-25" />
              Chưa có dữ liệu dòng vật phẩm
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
              <div className="h-44 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={inventoryData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={76}
                      paddingAngle={4}
                      stroke="none"
                    >
                      {inventoryData.map((item, index) => (
                        <Cell key={item.name} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => Number(value).toLocaleString("vi-VN")} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full space-y-3 sm:max-w-[150px]">
                {inventoryData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                      <span className="truncate">{item.name}</span>
                    </span>
                    <strong className="tabular-nums">{item.value.toLocaleString("vi-VN")}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
