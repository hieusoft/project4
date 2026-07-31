import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Users,
  HeartHandshake,
  Package,
  Megaphone,
  ArrowUpRight,
} from "lucide-react"

interface OverviewStats {
  totalAccounts: number
  totalGroups: number
  totalDonations: number
  totalListings: number
  totalRequests: number
  totalItemsDelivered: number
}

interface OverviewCardsProps {
  stats: OverviewStats
  loading: boolean
}

export function OverviewCards({ stats, loading }: OverviewCardsProps) {
  const statCards = [
    {
      title: "Tài khoản",
      hint: "Người dùng trên hệ thống",
      value: stats.totalAccounts,
      icon: Users,
      tone: "from-sky-500/16 to-cyan-400/6 text-sky-700 dark:text-sky-300",
    },
    {
      title: "Nhóm thiện nguyện",
      hint: "Cộng đồng đang vận hành",
      value: stats.totalGroups,
      icon: HeartHandshake,
      tone: "from-primary/18 to-secondary/7 text-primary",
    },
    {
      title: "Đợt quyên góp",
      hint: "Đợt đang hoạt động",
      value: stats.totalDonations,
      icon: Package,
      tone: "from-amber-500/18 to-orange-400/7 text-amber-700 dark:text-amber-300",
    },
    {
      title: "Đã trao tặng",
      hint: "Đợt đã hoàn thành",
      value: stats.totalItemsDelivered,
      icon: Megaphone,
      tone: "from-violet-500/18 to-fuchsia-400/7 text-violet-700 dark:text-violet-300",
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {statCards.map((card) => (
        <Card key={card.title} className="@container/card admin-surface relative overflow-hidden border-0">
          <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-br ${card.tone} opacity-80`} />
          <CardHeader className="relative">
            <div className="flex items-center justify-between">
              <div>
                <CardDescription className="font-medium">{card.title}</CardDescription>
                <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
              </div>
              <div className="rounded-2xl border bg-background/70 p-2.5 shadow-sm backdrop-blur">
                <card.icon className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="mt-5 flex items-end justify-between text-3xl font-bold tabular-nums @[250px]/card:text-4xl">
              {loading ? <Skeleton className="h-8 w-20" /> : card.value.toLocaleString()}
              <span className="flex items-center gap-1 rounded-full bg-background/70 px-2 py-1 text-xs font-medium text-muted-foreground">
                <ArrowUpRight className="h-3 w-3" /> Live
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
