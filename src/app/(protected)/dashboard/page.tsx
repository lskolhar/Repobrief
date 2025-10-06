'use client'
import React, { useState, useRef, useEffect } from 'react'
import { useUser } from "@clerk/nextjs"
import { useProjectsCtx } from '@/hooks/project-context';
import { Github, ExternalLink, Copy, Check } from 'lucide-react';
import { CommitLog } from './commit-log';
import AskQuestionCard from './ask-question-card';

import MeetingUploadCard from "./meeting-upload-card";
import TeamMembers from './team-members';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
// Credit balance moved to billing page

const DashboardPage = () => {
  const { user } = useUser();
  const { project, projectId, setProjectId } = useProjectsCtx();
  const [isArchiving, setIsArchiving] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const inviteLinkRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Generate invite link based on project ID
  const [inviteLink, setInviteLink] = useState('');

  useEffect(() => {
    if (projectId) {
      setInviteLink(`${window.location.origin}/join/${projectId}`);
    }
  }, [projectId]);

  const handleCopyInviteLink = () => {
    if (inviteLinkRef.current) {
      inviteLinkRef.current.select();
      document.execCommand('copy');
      setCopied(true);
      toast.success('Invite link copied to clipboard');
      
      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    }
  };

  const handleArchiveProject = async () => {
    if (!projectId) return;
    
    setIsArchiving(true);
    try {
      // Make a fetch request to a new API endpoint we'll create
      const response = await fetch(`/api/projects/${projectId}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to archive project');
      }
      
      // Show success message and confirmation dialog
      toast.success('Project archived successfully');
      setShowConfirmation(true);
      
      // Clear the selected project
      setProjectId(null);
      
      // Redirect to home page after 2 seconds
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 2000);
      
    } catch (error: unknown) {
      console.error('Error archiving project:', error);
      toast.error('Failed to archive project');
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div key={projectId} className="p-6">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between flex-wrap gap-y-4 mb-6">
        {/* GitHub Link Banner */}
        <div className="w-fit rounded-md bg-primary px-4 py-3 flex items-center">
          <Github className="size-5 text-white" />
          <p className="ml-2 text-sm font-medium text-white">
            This project is linked to
          </p>
          {project?.githuburl && (
            <a
              href={project.githuburl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-white/80 hover:underline ml-2"
            >
              {project.githuburl}
              <ExternalLink className="ml-1 size-4" />
            </a>
          )}
        </div>

        {/* Team Members, Invite & Archive Buttons */}
        <div className="flex items-center gap-3">
          <TeamMembers />
          <button 
            onClick={() => setShowInviteModal(true)}
            className="text-sm bg-blue-500 hover:bg-blue-600 text-white font-medium py-1 px-3 border border-blue-600 rounded-md shadow-sm"
          >
            Invite Members
          </button>
          <button 
            onClick={handleArchiveProject}
            disabled={isArchiving}
            className="text-sm bg-red-500 hover:bg-red-600 text-white font-medium py-1 px-3 rounded-md shadow-sm transition-colors"
          >
            {isArchiving ? 'Archiving...' : 'Archive'}
          </button>
        </div>
      </div>

      {/* Invite Members Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Invite Team Members</h3>
              <button 
                onClick={() => setShowInviteModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                &times;
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Ask them to copy and paste this link
            </p>
            <div className="relative mb-4">
              <input
                ref={inviteLinkRef}
                type="text"
                value={inviteLink}
                readOnly
                className="w-full p-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleCopyInviteLink}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                title="Copy to clipboard"
              >
                {copied ? (
                  <Check className="h-5 w-5 text-green-500" />
                ) : (
                  <Copy className="h-5 w-5" />
                )}
              </button>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Dialog */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <div className="flex justify-center mb-4">
              <div className="bg-blue-100 rounded-full p-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h3 className="text-center text-lg font-medium mb-2">Project archived</h3>
            <p className="text-center text-sm text-gray-500 mb-4">
              The project has been successfully archived.
            </p>
            <div className="flex justify-center space-x-2">
              <button 
                onClick={() => {
                  setShowConfirmation(false);
                  router.push('/');
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm font-medium"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credit Balance moved to billing page */}

      {/* Main content grid for Ask Question and Meeting cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Re-Embed Button (visible if project selected) */}

        {/* Ask Question Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <AskQuestionCard />
        </div>
        {/* Meeting Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-medium mb-4">Create a new meeting</h2>
          <p className="text-sm text-gray-500 mb-4">
            Analyze your meeting with RepoBrief.<br />
            Powered by AI.
          </p>
          <MeetingUploadCard />
        </div>
      </div>

      {/* Commit Log Section */}
      <div className="mt-8">
        <h2 className="text-lg font-medium mb-4">Recent Commits</h2>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 min-h-[200px]">
          <CommitLog />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;