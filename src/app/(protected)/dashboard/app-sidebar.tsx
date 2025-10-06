'use client'

import {
  Sidebar,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarMenu,
  SidebarGroupLabel,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar"
import {
  Bot,
  LayoutDashboard,
  Presentation,
  CreditCard,
  Plus,
} from "lucide-react"
import { useSidebar } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"

const items = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Q&A",
    url: "/qa",
    icon: Bot,
  },
  {
    title: "Meetings",
    url: "/meetings",
    icon: Presentation,
  },
  {
    title: "Billing",
    url: "/billing",
    icon: CreditCard,
  },
]


import { useProjectsCtx } from "@/hooks/project-context";

export function AppSidebar() {
  const pathname = usePathname()
  const { open } = useSidebar()
  const { projects, projectId, setProjectId } = useProjectsCtx();

  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="logo" width={40} height={40} />
          {open && (
            <h1 className="text-xl font-bold text-primary/80">
              RepoBrief
            </h1>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Application Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent className="list-none">
            {items.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild>
                  <Link
                    href={item.url}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md transition-all hover:bg-muted",
                      pathname === item.url && "bg-primary text-white"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="text-sm">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Projects Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Your Projects</SidebarGroupLabel>
          <SidebarGroupContent className="list-none">
            <SidebarMenu>
              {projects.map((project) => (
  <SidebarMenuItem key={project.id}>
    <SidebarMenuButton
      isActive={projectId === project.id}
      onClick={() => setProjectId(project.id)}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md transition cursor-pointer",
        projectId === project.id
          ? "bg-primary text-white !bg-primary !text-white"
          : "hover:bg-muted"
      )}
    >
      <div className="rounded-sm border size-6 flex items-center justify-center text-sm bg-white text-primary">
        {project.name[0]}
      </div>
      <span className="text-sm">{project.name}</span>
    </SidebarMenuButton>
  </SidebarMenuItem>
))}

              {open && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/create">
                      <Button variant="outline" className="w-fit flex items-center gap-1 ml-3 mt-2">
                        <Plus className="w-4 h-4" />
                        Create Project
                      </Button>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
