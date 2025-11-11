"use client"

import { useState, useEffect } from "react"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, CheckCircle2, Loader2, Save, User, Users } from "lucide-react"

interface MenuPermission {
  id: number
  key: string
  name: string
  href: string | null
  parentId: number | null
  order: number
  children?: MenuPermission[]
}

interface User {
  id: number
  username: string
  firstName: string
  lastName: string | null
}

interface Role {
  id: number
  name: string
}

export default function UserMenuManagerPage() {
  const { can } = usePermissions()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<"user" | "role">("user")
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [selectedRoleId, setSelectedRoleId] = useState<string>("")
  const [menuPermissions, setMenuPermissions] = useState<MenuPermission[]>([])
  const [selectedMenuIds, setSelectedMenuIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Permission check
  useEffect(() => {
    if (!can(PERMISSIONS.USER_UPDATE) && !can(PERMISSIONS.ROLE_UPDATE)) {
      router.push("/dashboard")
    }
  }, [can, router])

  // Fetch users
  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/users")
        if (res.ok) {
          const data = await res.json()
          setUsers(data.users || [])
        }
      } catch (error) {
        console.error("Failed to fetch users:", error)
      }
    }
    fetchUsers()
  }, [])

  // Fetch roles
  useEffect(() => {
    async function fetchRoles() {
      try {
        const res = await fetch("/api/roles")
        if (res.ok) {
          const data = await res.json()
          setRoles(data || [])
        }
      } catch (error) {
        console.error("Failed to fetch roles:", error)
      }
    }
    fetchRoles()
  }, [])

  // Fetch all menu permissions (hierarchical)
  useEffect(() => {
    async function fetchMenuPermissions() {
      try {
        const res = await fetch("/api/settings/menu-permissions")
        if (res.ok) {
          const data = await res.json()
          if (data.success) {
            setMenuPermissions(data.data.hierarchy || [])
          }
        }
      } catch (error) {
        console.error("Failed to fetch menu permissions:", error)
      }
    }
    fetchMenuPermissions()
  }, [])

  // Load selected user's menu permissions
  async function loadUserMenus(userId: string) {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/settings/menu-permissions/user/${userId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data.accessibleMenuKeys) {
          // Convert keys to IDs
          const keys = new Set(data.data.accessibleMenuKeys)
          const ids = new Set<number>()
          const findIds = (menus: MenuPermission[]) => {
            menus.forEach((menu) => {
              if (keys.has(menu.key)) {
                ids.add(menu.id)
              }
              if (menu.children) {
                findIds(menu.children)
              }
            })
          }
          findIds(menuPermissions)
          setSelectedMenuIds(ids)
        }
      }
    } catch (error) {
      console.error("Failed to load user menus:", error)
      setMessage({ type: "error", text: "Failed to load user menu permissions" })
    } finally {
      setLoading(false)
    }
  }

  // Load selected role's menu permissions
  async function loadRoleMenus(roleId: string) {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/settings/menu-permissions/role/${roleId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data.accessibleMenuKeys) {
          // Convert keys to IDs
          const keys = new Set(data.data.accessibleMenuKeys)
          const ids = new Set<number>()
          const findIds = (menus: MenuPermission[]) => {
            menus.forEach((menu) => {
              if (keys.has(menu.key)) {
                ids.add(menu.id)
              }
              if (menu.children) {
                findIds(menu.children)
              }
            })
          }
          findIds(menuPermissions)
          setSelectedMenuIds(ids)
        }
      }
    } catch (error) {
      console.error("Failed to load role menus:", error)
      setMessage({ type: "error", text: "Failed to load role menu permissions" })
    } finally {
      setLoading(false)
    }
  }

  // Handle user selection
  function handleUserChange(userId: string) {
    setSelectedUserId(userId)
    setSelectedMenuIds(new Set())
    if (userId) {
      loadUserMenus(userId)
    }
  }

  // Handle role selection
  function handleRoleChange(roleId: string) {
    setSelectedRoleId(roleId)
    setSelectedMenuIds(new Set())
    if (roleId) {
      loadRoleMenus(roleId)
    }
  }

  // Toggle menu selection
  function toggleMenu(menuId: number, checked: boolean) {
    const newSelected = new Set(selectedMenuIds)
    if (checked) {
      newSelected.add(menuId)
    } else {
      newSelected.delete(menuId)
    }
    setSelectedMenuIds(newSelected)
  }

  // Select/Deselect all children
  function toggleMenuWithChildren(menu: MenuPermission, checked: boolean) {
    const newSelected = new Set(selectedMenuIds)

    const toggle = (m: MenuPermission) => {
      if (checked) {
        newSelected.add(m.id)
      } else {
        newSelected.delete(m.id)
      }
      if (m.children) {
        m.children.forEach(toggle)
      }
    }

    toggle(menu)
    setSelectedMenuIds(newSelected)
  }

  // Save user menu permissions
  async function saveUserMenus() {
    if (!selectedUserId) return

    setSaving(true)
    setMessage(null)

    try {
      const menuIds = Array.from(selectedMenuIds)
      const res = await fetch(`/api/settings/menu-permissions/user/${selectedUserId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuPermissionIds: menuIds }),
      })

      if (res.ok) {
        setMessage({ type: "success", text: "User menu permissions saved successfully!" })
      } else {
        const error = await res.json()
        setMessage({ type: "error", text: error.error || "Failed to save" })
      }
    } catch (error) {
      console.error("Save error:", error)
      setMessage({ type: "error", text: "An error occurred while saving" })
    } finally {
      setSaving(false)
    }
  }

  // Save role menu permissions
  async function saveRoleMenus() {
    if (!selectedRoleId) return

    setSaving(true)
    setMessage(null)

    try {
      const menuIds = Array.from(selectedMenuIds)
      const res = await fetch(`/api/settings/menu-permissions/role/${selectedRoleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuPermissionIds: menuIds }),
      })

      if (res.ok) {
        setMessage({ type: "success", text: "Role menu permissions saved successfully!" })
      } else {
        const error = await res.json()
        setMessage({ type: "error", text: error.error || "Failed to save" })
      }
    } catch (error) {
      console.error("Save error:", error)
      setMessage({ type: "error", text: "An error occurred while saving" })
    } finally {
      setSaving(false)
    }
  }

  // Render menu tree
  function renderMenuTree(menus: MenuPermission[], level: number = 0) {
    return (
      <div className={level > 0 ? "ml-6 mt-2 border-l-2 border-gray-200 dark:border-gray-700 pl-4" : ""}>
        {menus.map((menu) => {
          const isSelected = selectedMenuIds.has(menu.id)
          const hasChildren = menu.children && menu.children.length > 0

          return (
            <div key={menu.id} className="mb-3">
              <div className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
                <Checkbox
                  id={`menu-${menu.id}`}
                  checked={isSelected}
                  onCheckedChange={(checked) => toggleMenu(menu.id, checked as boolean)}
                />
                <Label
                  htmlFor={`menu-${menu.id}`}
                  className="flex-1 cursor-pointer font-medium text-gray-900 dark:text-gray-100"
                >
                  {menu.name}
                  {menu.href && (
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {menu.href}
                    </span>
                  )}
                </Label>
                {hasChildren && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleMenuWithChildren(menu, !isSelected)}
                    className="text-xs"
                  >
                    {isSelected ? "Deselect All" : "Select All"}
                  </Button>
                )}
              </div>

              {hasChildren && renderMenuTree(menu.children!, level + 1)}
            </div>
          )
        })}
      </div>
    )
  }

  const selectedUser = users.find((u) => u.id === parseInt(selectedUserId))
  const selectedRole = roles.find((r) => r.id === parseInt(selectedRoleId))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">User Menu Manager</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Assign sidebar menu permissions to users and roles
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Menu Permission Management</CardTitle>
          <CardDescription>
            Select a user or role, then check the menus they should have access to
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "user" | "role")}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="user" className="gap-2">
                <User className="h-4 w-4" />
                By User
              </TabsTrigger>
              <TabsTrigger value="role" className="gap-2">
                <Users className="h-4 w-4" />
                By Role
              </TabsTrigger>
            </TabsList>

            <TabsContent value="user" className="space-y-4">
              <div>
                <Label htmlFor="user-select">Select User</Label>
                <Select value={selectedUserId} onValueChange={handleUserChange}>
                  <SelectTrigger id="user-select">
                    <SelectValue placeholder="Choose a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.username} - {user.firstName} {user.lastName || ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedUser && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Managing menus for: {selectedUser.firstName} {selectedUser.lastName} (@
                    {selectedUser.username})
                  </p>
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : selectedUserId ? (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-[500px] overflow-y-auto">
                  {renderMenuTree(menuPermissions)}
                </div>
              ) : null}

              {selectedUserId && !loading && (
                <div className="flex items-center gap-4">
                  <Button
                    onClick={saveUserMenus}
                    disabled={saving}
                    className="gap-2"
                    variant="default"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save User Menus
                      </>
                    )}
                  </Button>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedMenuIds.size} menus selected
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="role" className="space-y-4">
              <div>
                <Label htmlFor="role-select">Select Role</Label>
                <Select value={selectedRoleId} onValueChange={handleRoleChange}>
                  <SelectTrigger id="role-select">
                    <SelectValue placeholder="Choose a role..." />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id.toString()}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedRole && (
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                  <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                    Managing menus for role: {selectedRole.name}
                  </p>
                  <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                    All users with this role will see these menus
                  </p>
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : selectedRoleId ? (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-[500px] overflow-y-auto">
                  {renderMenuTree(menuPermissions)}
                </div>
              ) : null}

              {selectedRoleId && !loading && (
                <div className="flex items-center gap-4">
                  <Button
                    onClick={saveRoleMenus}
                    disabled={saving}
                    className="gap-2"
                    variant="default"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save Role Menus
                      </>
                    )}
                  </Button>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedMenuIds.size} menus selected
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {message && (
            <div
              className={`mt-4 p-4 rounded-lg border flex items-center gap-2 ${
                message.type === "success"
                  ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200"
                  : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
              <p className="font-medium">{message.text}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-900 dark:text-yellow-100">
            <AlertCircle className="h-5 w-5" />
            Important Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-yellow-800 dark:text-yellow-200">
          <p>• Users must have the corresponding RBAC permissions to access menu routes</p>
          <p>• Menu permissions only control sidebar visibility, not route access</p>
          <p>• Users must log out and log back in to see menu changes</p>
          <p>• Direct user menu assignments override role-based menus</p>
        </CardContent>
      </Card>
    </div>
  )
}
