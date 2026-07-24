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
  ShoppingBag,
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
      value: stats.totalAccounts,
      icon: Users,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950",
    },
    {
      title: "Nhóm thiện nguyện",
      value: stats.totalGroups,
      icon: HeartHandshake,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950",
    },
    {
      title: "Quyên góp",
      value: stats.totalDonations,
      icon: Package,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-50 dark:bg-orange-950",
    },
    {
      title: "Gian hàng",
      value: stats.totalListings,
      icon: ShoppingBag,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-950",
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {statCards.map((card) => (
        <Card key={card.title} className="@container/card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription>{card.title}</CardDescription>
              <div className={`rounded-lg p-2 ${card.bg}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </div>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {loading ? <Skeleton className="h-8 w-20" /> : card.value.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
