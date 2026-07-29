"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/admin-layout"
import { marketplaceApi, communityApi, identityApi, donationApi } from "@/lib/api/client"

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
        const [accountsRes, groupsRes, overview, donationsRes, listingsRes, chartRes, pendingGroupsRes] = await Promise.allSettled([
          identityApi.listAccounts({ limit: 1 }),
          communityApi.listGroups({ limit: 5 }),
          marketplaceApi.getOverview(),
          typeof donationApi.listDonations === 'function' ? donationApi.listDonations({ limit: 5 }) : Promise.resolve({ data: { meta: { total: 0 }, items: [] } }),
          marketplaceApi.getListings({ limit: 1 }),
          marketplaceApi.getStats({ limit: 14 }),
          communityApi.listGroups({ status: "pending", limit: 5 })
        ])

        setStats({
          totalAccounts:
            accountsRes.status === "fulfilled" && accountsRes.value.data?.meta
              ? accountsRes.value.data.meta.total
              : 0,
          totalGroups:
            groupsRes.status === "fulfilled" && groupsRes.value.data?.meta
              ? groupsRes.value.data.meta.total
              : 0,
          totalDonations: 
            donationsRes.status === "fulfilled" && donationsRes.value.data?.meta
              ? donationsRes.value.data.meta.total
              : (overview.status === "fulfilled" && overview.value.data ? overview.value.data.donations_count || 0 : 0),
          totalListings: 
            listingsRes.status === "fulfilled" && listingsRes.value.data?.meta
              ? listingsRes.value.data.meta.total
              : (overview.status === "fulfilled" && overview.value.data ? overview.value.data.items_listed || 0 : 0),
          totalRequests: overview.status === "fulfilled" && overview.value.data ? overview.value.data.requests_count || 0 : 0,
          totalItemsDelivered: overview.status === "fulfilled" && overview.value.data ? overview.value.data.items_delivered || 0 : 0,
        })

        if (overview.status === "fulfilled" && overview.value.data) {
          setOverviewData(overview.value.data as Record<string, number>)
        }
        
        if (groupsRes.status === "fulfilled" && groupsRes.value.data) {
          setRecentGroups(groupsRes.value.data.items || [])
        }
        if (donationsRes.status === "fulfilled" && donationsRes.value.data) {
          setRecentDonations(donationsRes.value.data.items || [])
        }
        
        if (chartRes.status === "fulfilled" && chartRes.value.data) {
          const data = Array.isArray(chartRes.value.data) ? chartRes.value.data : []
          setChartData([...data].reverse().map(d => ({
              date: new Date(d.stat_date).toLocaleDateString("vi-VN", { month: "numeric", day: "numeric" }),
              "Quyên góp": d.donations_count || 0,
              "Yêu cầu": d.requests_count || 0,
              "Bàn giao": d.items_delivered || 0
           })))
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
                Theo dõi tài khoản, hội nhóm, quyên góp, gian hàng và tiến trình bàn giao trên toàn hệ thống.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:flex">
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="text-2xl font-bold tabular-nums">{stats.totalRequests.toLocaleString()}</div>
                <div className="text-[#fff5f3]/75">Yêu cầu nhận</div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                <div className="text-2xl font-bold tabular-nums">{stats.totalItemsDelivered.toLocaleString()}</div>
                <div className="text-[#fff5f3]/75">Đã bàn giao</div>
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
