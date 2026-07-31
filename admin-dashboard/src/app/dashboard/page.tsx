"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/admin-layout"
import { communityApi, identityApi, donationApi } from "@/lib/api/client"

import { OverviewCards } from "@/components/dashboard/overview-cards"
import { SystemStatusOverview } from "@/components/dashboard/system-status"
import { ActivityChart } from "@/components/dashboard/activity-chart"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { ImpactOverview } from "@/components/dashboard/impact-overview"

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalAccounts: 0,
    totalGroups: 0,
    totalDonations: 0,
    totalListings: 0,
    totalRequests: 0,
    totalItemsDelivered: 0,
  })
  const [recentGroups, setRecentGroups] = useState<any[]>([])
  const [recentDonations, setRecentDonations] = useState<any[]>([])
  const [chartData, setChartData] = useState<any[]>([])
  const [pendingGroups, setPendingGroups] = useState<any[]>([])
  const [overviewData, setOverviewData] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const [accountsRes, groupsRes, campaignsRes, pendingGroupsRes] = await Promise.allSettled([
          identityApi.listAccounts({ limit: 1 }),
          communityApi.listGroups({ limit: 5 }),
          donationApi.listCampaigns({ limit: 5 }),
          communityApi.listGroups({ status: "pending", limit: 5 })
        ])

        const campaignTotal = campaignsRes.status === "fulfilled" && campaignsRes.value.data?.meta
          ? campaignsRes.value.data.meta.total : 0

        setStats({
          totalAccounts:
            accountsRes.status === "fulfilled" && accountsRes.value.data?.meta
              ? accountsRes.value.data.meta.total
              : 0,
          totalGroups:
            groupsRes.status === "fulfilled" && groupsRes.value.data?.meta
              ? groupsRes.value.data.meta.total
              : 0,
          totalDonations: campaignTotal,
          totalListings: 0,
          totalRequests: 0,
          totalItemsDelivered: 0,
        })

        if (groupsRes.status === "fulfilled" && groupsRes.value.data) {
          setRecentGroups(groupsRes.value.data.items || [])
        }
        if (campaignsRes.status === "fulfilled" && campaignsRes.value.data) {
          setRecentDonations(campaignsRes.value.data.items || [])
        }

        if (pendingGroupsRes.status === "fulfilled" && pendingGroupsRes.value.data) {
          setPendingGroups(pendingGroupsRes.value.data.items || [])
        }
      } catch (err) {
        console.error("Failed to fetch stats:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="relative overflow-hidden rounded-[2rem] border bg-[#5c1018] px-6 py-7 text-white shadow-xl shadow-red-950/15 md:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(134,239,172,0.35),transparent_28rem),linear-gradient(135deg,rgba(20,83,45,0.92),rgba(15,23,42,0.96))]" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="mb-3 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-[#fff5f3] backdrop-blur">
                Trung tâm điều phối thiện nguyện
              </p>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Tổng quan vận hành</h2>
              <p className="mt-3 text-sm leading-6 text-[#fff5f3]/82">
                Theo dõi tài khoản, hội nhóm, đợt quyên góp và tiến trình trao tặng trên toàn hệ thống.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:flex">
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="text-2xl font-bold tabular-nums">{stats.totalDonations.toLocaleString()}</div>
                <div className="text-[#fff5f3]/75">Đợt quyên góp</div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="text-2xl font-bold tabular-nums">{stats.totalGroups.toLocaleString()}</div>
                <div className="text-[#fff5f3]/75">Hội nhóm</div>
              </div>
            </div>
          </div>
        </div>

        <OverviewCards stats={stats} loading={loading} />

        <ImpactOverview overview={overviewData} loading={loading} />

        <SystemStatusOverview stats={stats} loading={loading} />

        <ActivityChart 
          chartData={chartData} 
          pendingGroups={pendingGroups} 
          loading={loading} 
        />

        <RecentActivity 
          recentDonations={recentDonations} 
          recentGroups={recentGroups} 
          loading={loading} 
        />
      </div>
    </AdminLayout>
  )
}
