"use client"

import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ServerIcon, GiftIcon, PackageCheck, ExternalLinkIcon, RadioTower } from "lucide-react"

interface OverviewStats {
  totalRequests: number
  totalItemsDelivered: number
  [key: string]: unknown
}

interface SystemStatusProps {
  stats: OverviewStats
  loading: boolean
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
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"
    fetch(`${base}/${slug}/health`, { signal: AbortSignal.timeout(5000) })
      .then((r) => (r.ok ? setStatus("ok") : setStatus("error")))
      .catch(() => setStatus("error"))
  }, [slug])

  return (
    <div className="flex items-center justify-between rounded-xl border bg-background/45 px-3 py-2">
      <span className="text-sm font-medium">{name}</span>
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            status === "ok" ? "bg-emerald-500" : status === "error" ? "bg-red-500" : "bg-muted"
          }`}
        />
        <span className="text-xs text-muted-foreground">
          {status === "loading" ? "Đang kiểm tra" : status === "ok" ? "Ổn định" : "Lỗi"}
        </span>
      </div>
    </div>
  )
}

export function SystemStatusOverview({ stats, loading }: SystemStatusProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <Card className="admin-surface">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-700 dark:text-emerald-300">
              <ServerIcon className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Trạng thái hệ thống</CardTitle>
              <p className="text-sm text-muted-foreground">Kiểm tra healthcheck qua Kong Gateway</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {[
            { name: "Identity", slug: "identity" },
            { name: "Community", slug: "community" },
            { name: "Donation", slug: "donation" },
            { name: "Marketplace", slug: "marketplace" },
            { name: "Communication", slug: "communication" },
            { name: "Media", slug: "media" },
            { name: "AI", slug: "ai" },
          ].map((svc) => (
            <ServiceStatus key={svc.slug} name={svc.name} slug={svc.slug} />
          ))}
        </CardContent>
      </Card>

      <Card className="admin-surface">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-amber-500/10 p-2 text-amber-700 dark:text-amber-300">
              <RadioTower className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Vận hành hôm nay</CardTitle>
              <p className="text-sm text-muted-foreground">Theo dõi xử lý và bàn giao</p>
            </div>
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
                href="http://216.108.237.20:8000/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Swagger API Docs
                <ExternalLinkIcon className="h-3 w-3" />
              </a>
              <a
                href="http://216.108.237.20:15672"
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
  )
}
