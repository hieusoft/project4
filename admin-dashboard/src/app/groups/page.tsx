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
import { Group } from "@/types"
import { Search, HeartHandshakeIcon } from "lucide-react"

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
  
  // Dialog States
  const [dialogGroup, setDialogGroup] = useState<Group | null>(null)
  const [dialogAction, setDialogAction] = useState<"approve" | "suspend" | "view">("approve")
  const [groupDetails, setGroupDetails] = useState<any>(null)
  const [groupMembers, setGroupMembers] = useState<any[]>([])
  const [groupPosts, setGroupPosts] = useState<any[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)
  
  const limit = 20

  const fetchGroups = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit }
      if (statusFilter !== "all") params.status = statusFilter
      if (searchQuery) params.q = searchQuery
      const res = await communityApi.listGroups(params)
      setGroups(res.data.items)
      setTotal(res.data.meta.total)
    } catch (err: any) {
      toast.error("Lỗi tải danh sách nhóm: " + err.message)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, searchQuery])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

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
        const members = membersRes.value.data.items || []
        const membersWithProfiles = await Promise.all(
          members.map(async (m: any) => {
            try {
              const profileRes = await identityApi.getProfile(m.user_id)
              return { ...m, profile: profileRes.data }
            } catch (e) {
              return m
            }
          })
        )
        setGroupMembers(membersWithProfiles)
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
      <div className="px-4 lg:px-6">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <HeartHandshakeIcon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-2xl font-bold tracking-tight">Nhóm thiện nguyện</h2>
          </div>
          <p className="text-muted-foreground mt-1">
            Quản lý các nhóm thiện nguyện
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Danh sách</CardTitle>
              <Badge variant="secondary">{total}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm nhóm..."
                  className="pl-8 w-[200px]"
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
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">PENDING</SelectItem>
                  <SelectItem value="active">ACTIVE</SelectItem>
                  <SelectItem value="suspended">SUSPENDED</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
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
        onClose={() => setDialogGroup(null)}
        onRefresh={() => dialogGroup && handleViewDetails(dialogGroup)}
      />
    </AdminLayout>
  )
}
