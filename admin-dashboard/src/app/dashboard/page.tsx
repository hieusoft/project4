"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/admin-layout"
import { marketplaceApi, communityApi, identityApi, donationApi } from "@/lib/api/client"

import { OverviewCards } from "@/components/dashboard/overview-cards"
import { SystemStatusOverview } from "@/components/dashboard/system-status"
import { ActivityChart } from "@/components/dashboard/activity-chart"
import { RecentActivity } from "@/components/dashboard/recent-activity"

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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const [accountsRes, groupsRes, overview, donationsRes, listingsRes, chartRes, pendingGroupsRes] = await Promise.allSettled([
          identityApi.listAccounts({ limit: 1 }),
          communityApi.listGroups({ limit: 5 }),
          marketplaceApi.getOverview(),
          // @ts-ignore
          typeof donationApi.listDonations === 'function' ? donationApi.listDonations({ limit: 5 }) : Promise.resolve({ data: { meta: { total: 0 }, items: [] } }),
          marketplaceApi.getListings({ limit: 1 }),
          marketplaceApi.getStats({ limit: 7 }),
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
             "Giao dịch": d.items_delivered || 0
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
      <div className="px-4 lg:px-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight">Tổng quan</h2>
          <p className="text-muted-foreground">
            Nền tảng Kết nối Quyên góp Thiện nguyện
          </p>
        </div>

        <OverviewCards stats={stats} loading={loading} />

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
