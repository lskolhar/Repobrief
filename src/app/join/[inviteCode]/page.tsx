'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { toast } from 'sonner';

export default function JoinProjectPage({ params }: { params: { inviteCode: string } }) {
  const { inviteCode } = params;
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const [isJoining, setIsJoining] = useState(false);
  const [projectDetails, setProjectDetails] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If user is not signed in, redirect to sign-in page
    if (isLoaded && !isSignedIn) {
      router.push(`/sign-in?redirect=/join/${inviteCode}`);
    }
  }, [isLoaded, isSignedIn, router, inviteCode]);

  useEffect(() => {
    // Fetch project details from the invite code (which is the project ID)
    const fetchProjectDetails = async () => {
      try {
        // In a real implementation, you would validate the invite code
        // For now, we'll assume the invite code is the project ID
        const response = await fetch(`/api/projects/${inviteCode}`);
        
        if (!response.ok) {
          throw new Error('Invalid project ID');
        }
        
        const data = await response.json();
        setProjectDetails({
          id: data.project.id,
          name: data.project.name
        });
      } catch (err) {
        console.error('Error fetching project details:', err);
        setError('This invite link is invalid or has expired');
      }
    };

    if (isSignedIn && inviteCode) {
      fetchProjectDetails();
    }
  }, [inviteCode, isSignedIn]);

  const handleJoinProject = async () => {
    if (!projectDetails || !user) return;
    
    setIsJoining(true);
    try {
      const response = await fetch('/api/projects/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: projectDetails.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to join project');
      }

      toast.success('Successfully joined the project!');
      
      // Redirect to the project dashboard
      setTimeout(() => {
        router.push(`/dashboard?project=${projectDetails.id}`);
      }, 1500);
    } catch (err: any) {
      console.error('Error joining project:', err);
      toast.error(err.message || 'Failed to join project');
    } finally {
      setIsJoining(false);
    }
  };

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Join Project</h1>
          {error ? (
            <p className="mt-2 text-red-500">{error}</p>
          ) : projectDetails ? (
            <p className="mt-2 text-gray-600">
              You've been invited to join <span className="font-semibold">{projectDetails.name}</span>
            </p>
          ) : (
            <p className="mt-2 text-gray-600">Loading project details...</p>
          )}
        </div>

        {!error && projectDetails && (
          <div className="space-y-4">
            <div className="rounded-md bg-blue-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    You'll be added as a team member to this project and will have access to all its features.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleJoinProject}
              disabled={isJoining}
              className="w-full rounded-md bg-blue-600 py-2 px-4 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isJoining ? 'Joining...' : 'Join Project'}
            </button>
          </div>
        )}

        {error && (
          <button
            onClick={() => router.push('/')}
            className="mt-4 w-full rounded-md bg-gray-200 py-2 px-4 text-gray-800 font-medium hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Go to Dashboard
          </button>
        )}
      </div>
    </div>
  );
}
