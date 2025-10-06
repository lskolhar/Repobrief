"use client";
import { SidebarProvider } from '@/components/ui/sidebar'
import { Sidebar } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { UserButton } from "@clerk/nextjs"
import { AppSidebar } from './dashboard/app-sidebar'
import { ProjectProvider } from '@/hooks/project-context' // <-- add this import
type Props = {
    children: React.ReactNode
}
const SidebarLayout = ({ children} : Props) => {
  // Use client-side rendering for components that might cause hydration issues
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);
  return (
    <ProjectProvider>
      <SidebarProvider>
        <AppSidebar />
        <main className='w-full m-2'>
            <div className='flex items-center gap-2 border-sidebar-border bg-sidebar border shadow rounded-md p-2 px-4 '>
                {/* <Searchbar /> */}
                <div className="ml-auto"></div>
                {/* Only render UserButton on the client to prevent hydration errors */}
                {isMounted && <UserButton />}
            </div>
            <div className="h-4"></div>
            {/* main content */}
            <div className='border-sidebar-border bg-sidebar border shadow rounded-md overflow-y-scroll h-[calc(100vh-6rem)] p-4'>
                {children}
            </div>
        </main>
      </SidebarProvider>
    </ProjectProvider>
  )
}

export default SidebarLayout