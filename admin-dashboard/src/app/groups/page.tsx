"use client"

import { AdminLayout } from "@/components/admin-layout"
import { useEffect, useState, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { communityApi, identityApi } from "@/lib/api/client"
import { Group, GroupMember, GroupPost, Profile } from "@/types"
import { Search, HeartHandshakeIcon, Users, Clock3, ShieldAlert, CheckCircle2 } from "lucide-react"

import { GroupTable } from "@/components/groups/group-table"
import { GroupActionDialog } from "@/components/groups/group-action-dialog"
import { GroupDetailsDialog } from "@/components/groups/group-details-dialog"

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [statusTotals, setStatusTotals] = useState<Record<string, number>>({})
  const [ownerProfiles, setOwnerProfiles] = useState<Record<string, Profile>>({})
  
  // Dialog States
  const [dialogGroup, setDialogGroup] = useState<Group | null>(null)
  const [dialogAction, setDialogAction] = useState<"approve" | "suspend" | "view">("approve")
  const [groupDetails, setGroupDetails] = useState<Group | null>(null)
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([])
  const [groupPosts, setGroupPosts] = useState<GroupPost[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)
  
  const limit = 20

  const fetchGroups = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit }
      if (statusFilter !== "all") params.status = statusFilter
      if (searchQuery) params.q = searchQuery
      const res = await communityApi.listGroups(params)
      const items = res.data.items
      setGroups(items)
      setTotal(res.data.meta.total)
      if (items.length > 0) {
        const profileRes = await identityApi.getProfilesBatch(items.map((group) => group.owner_id))
        setOwnerProfiles(Object.fromEntries(profileRes.data.map((profile) => [profile.id, profile])))
      } else {
        setOwnerProfiles({})
      }
    } catch (err: any) {
      toast.error("Lỗi tải danh sách nhóm: " + err.message)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, searchQuery])

  const fetchStatusTotals = useCallback(async () => {
    const statuses = ["pending", "active", "suspended", "closed"]
    const results = await Promise.allSettled(statuses.map((status) => communityApi.listGroups({ status, limit: 1 })))
    setStatusTotals(Object.fromEntries(statuses.map((status, index) => [status, results[index].status === "fulfilled" ? results[index].value.data.meta.total : 0])))
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchGroups()
    fetchStatusTotals()
  }, [fetchGroups, fetchStatusTotals])

  async function handleActionConfirm() {
    if (!dialogGroup) return
    try {
      if (dialogAction === "approve") {
        await communityApi.approveGroup(dialogGroup.id)
        toast.success(`Đã duyệt nhóm "${dialogGroup.name}"`)
      } else if (dialogAction === "suspend") {
        await communityApi.suspendGroup(dialogGroup.id)
        toast.success(`Đã đình chỉ nhóm "${dialogGroup.name}"`)
      }
      setDialogGroup(null)
      fetchGroups()
      fetchStatusTotals()
    } catch (err: any) {
      toast.error("Thao tác thất bại: " + err.message)
    }
  }

  async function handleViewDetails(group: Group) {
    setDialogGroup(group)
    setDialogAction("view")
    setLoadingDetails(true)
    setGroupDetails(null)
    setGroupMembers([])
    setGroupPosts([])
    try {
      const [detailsRes, membersRes, postsRes] = await Promise.allSettled([
        communityApi.getGroup(group.id),
        communityApi.listMembers(group.id, { limit: 10 }),
        communityApi.listPosts(group.id, { limit: 5 })
      ])
      
      if (detailsRes.status === "fulfilled") setGroupDetails(detailsRes.value.data)
      if (membersRes.status === "fulfilled") {
        const members = membersRes.value.data.items as GroupMember[]
        if (members.length > 0) {
          const profileRes = await identityApi.getProfilesBatch(members.map((member) => member.user_id))
          const profiles = Object.fromEntries(profileRes.data.map((profile) => [profile.id, profile]))
          setGroupMembers(members.map((member) => ({ ...member, profile: profiles[member.user_id] })))
        }
      }
      if (postsRes.status === "fulfilled") setGroupPosts(postsRes.value.data.items || [])
    } catch (err: any) {
      toast.error("Lỗi tải thông tin: " + err.message)
    } finally {
      setLoadingDetails(false)
    }
  }

  function handleActionClick(group: Group, action: "approve" | "suspend") {
    setDialogGroup(group)
    setDialogAction(action)
  }

  function closeDialog() {
    setDialogGroup(null)
  }

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="rounded-[1.75rem] border bg-card/80 p-5 shadow-sm backdrop-blur">
          <div className="flex items-center gap-2">
            <HeartHandshakeIcon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-2xl font-bold tracking-tight">Nhóm thiện nguyện</h2>
          </div>
          <p className="text-muted-foreground mt-1">
            Kiểm duyệt cộng đồng, theo dõi thành viên và đảm bảo hoạt động nhóm lành mạnh
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { key: "active", label: "Đang hoạt động", icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-500/10" },
            { key: "pending", label: "Chờ duyệt", icon: Clock3, tone: "text-amber-700 bg-amber-500/10" },
            { key: "suspended", label: "Đang đình chỉ", icon: ShieldAlert, tone: "text-red-700 bg-red-500/10" },
            { key: "closed", label: "Đã đóng", icon: Users, tone: "text-slate-700 bg-slate-500/10" },
          ].map((item) => (
            <button type="button" key={item.key} onClick={() => { setStatusFilter(item.key); setPage(1) }} className={`admin-surface flex items-center justify-between p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${statusFilter === item.key ? "ring-2 ring-primary/35" : ""}`}>
              <div><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{(statusTotals[item.key] || 0).toLocaleString("vi-VN")}</p></div>
              <div className={`rounded-2xl p-3 ${item.tone}`}><item.icon className="size-5" /></div>
            </button>
          ))}
        </div>

        <Card className="admin-surface">
          <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <CardTitle>Danh sách</CardTitle>
              <Badge variant="secondary">{total} nhóm</Badge>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm nhóm..."
                  className="w-full pl-8 sm:w-[240px]"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setPage(1)
                  }}
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v ?? "all")
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Trạng thái" />
                </SelectTrigger>
                <SelectContent>
                   <SelectItem value="all">Tất cả trạng thái</SelectItem>
                   <SelectItem value="pending">Chờ duyệt</SelectItem>
                   <SelectItem value="active">Đang hoạt động</SelectItem>
                   <SelectItem value="suspended">Đang đình chỉ</SelectItem>
                   <SelectItem value="closed">Đã đóng</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <GroupTable
              groups={groups}
              loading={loading}
              total={total}
              page={page}
              limit={limit}
              onPageChange={setPage}
              onActionClick={handleActionClick}
              onViewClick={handleViewDetails}
              ownerProfiles={ownerProfiles}
            />
          </CardContent>
        </Card>
      </div>

      <GroupActionDialog
        dialogGroup={dialogGroup}
        dialogAction={dialogAction}
        onClose={closeDialog}
        onConfirm={handleActionConfirm}
      />

      <GroupDetailsDialog
        dialogGroup={dialogGroup}
        dialogAction={dialogAction}
        loadingDetails={loadingDetails}
        groupDetails={groupDetails}
        groupMembers={groupMembers}
        groupPosts={groupPosts}
        ownerProfile={dialogGroup ? ownerProfiles[dialogGroup.owner_id] : undefined}
        onClose={() => setDialogGroup(null)}
        onRefresh={() => dialogGroup && handleViewDetails(dialogGroup)}
      />
    </AdminLayout>
  )
}
