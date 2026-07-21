"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/admin-layout"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Users,
  HeartHandshake,
  Package,
  ShoppingBag,
  PackageCheck,
  GiftIcon,
  ServerIcon,
  ExternalLinkIcon,
} from "lucide-react"
import { marketplaceApi, communityApi, identityApi } from "@/lib/api/client"

interface OverviewStats {
  totalAccounts: number
  totalGroups: number
  totalDonations: number
  totalListings: number
  totalRequests: number
  totalItemsDelivered: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<OverviewStats>({
    totalAccounts: 0,
    totalGroups: 0,
    totalDonations: 0,
    totalListings: 0,
    totalRequests: 0,
    totalItemsDelivered: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const [accountsRes, groupsRes, overview] = await Promise.allSettled([
          identityApi.listAccounts({ limit: 1 }),
          communityApi.listGroups({ limit: 1 }),
          marketplaceApi.getOverview(),
        ])

        setStats({
          totalAccounts:
            accountsRes.status === "fulfilled"
              ? accountsRes.value.data.meta.total
              : 0,
          totalGroups:
            groupsRes.status === "fulfilled"
              ? groupsRes.value.data.meta.total
              : 0,
          totalDonations: overview.status === "fulfilled" ? overview.value.donations_count || 0 : 0,
          totalListings: overview.status === "fulfilled" ? overview.value.items_listed || 0 : 0,
          totalRequests: overview.status === "fulfilled" ? overview.value.requests_count || 0 : 0,
          totalItemsDelivered: overview.status === "fulfilled" ? overview.value.items_delivered || 0 : 0,
        })
      } catch (err) {
        console.error("Failed to fetch stats:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

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
    <AdminLayout>
      <div className="px-4 lg:px-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight">Tổng quan</h2>
          <p className="text-muted-foreground">
            Nền tảng Kết nối Quyên góp Thiện nguyện
          </p>
        </div>

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

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ServerIcon className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Trạng thái Hệ thống</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: "Identity", slug: "identity", port: 3001 },
                { name: "Community", slug: "community", port: 3002 },
                { name: "Donation", slug: "donation", port: 3003 },
                { name: "Marketplace", slug: "marketplace", port: 3004 },
                { name: "Communication", slug: "communication", port: 3005 },
                { name: "Media", slug: "media", port: 3006 },
                { name: "AI", slug: "ai", port: 3007 },
              ].map((svc) => (
                <ServiceStatus key={svc.slug} name={svc.name} slug={svc.slug} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <GiftIcon className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Thống kê nhanh</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <StatRow
                label="Yêu cầu nhận"
                value={stats.totalRequests}
                loading={loading}
                icon={PackageCheck}
              />
              <StatRow
                label="Đã trao tặng"
                value={stats.totalItemsDelivered}
                loading={loading}
                icon={GiftIcon}
              />
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">Liên kết nhanh</p>
                <div className="mt-2 space-y-1">
                  <a
                    href="http://localhost:8000/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    Swagger API Docs
                    <ExternalLinkIcon className="h-3 w-3" />
                  </a>
                  <a
                    href="http://localhost:15672"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    RabbitMQ Management
                    <ExternalLinkIcon className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}

function StatRow({ label, value, loading, icon: Icon }: { label: string; value: number; loading: boolean; icon: React.ElementType }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      {loading ? <Skeleton className="h-5 w-12" /> : <span className="font-semibold tabular-nums">{value}</span>}
    </div>
  )
}

function ServiceStatus({ name, slug }: { name: string; slug: string }) {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading")

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api"
    fetch(`${base}/${slug}/health`, { signal: AbortSignal.timeout(5000) })
      .then((r) => (r.ok ? setStatus("ok") : setStatus("error")))
      .catch(() => setStatus("error"))
  }, [slug])

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{name}</span>
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            status === "ok" ? "bg-emerald-500" : status === "error" ? "bg-red-500" : "bg-muted"
          }`}
        />
        <span className="text-xs text-muted-foreground">
          {status === "loading" ? "Checking..." : status === "ok" ? "Healthy" : "Error"}
        </span>
      </div>
    </div>
  )
}
