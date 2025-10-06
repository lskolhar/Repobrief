'use client';

import React, { useState, useEffect } from 'react';
import { useProjectsCtx } from '@/hooks/project-context';
import { Users, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';

type TeamMember = {
  userId: string;
  createdAt: string;
  displayName?: string;
  email?: string;
  imageUrl?: string;
};

export default function TeamMembers() {
  const { projectId } = useProjectsCtx();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const fetchTeamMembers = async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/members`);
      if (!response.ok) {
        throw new Error('Failed to fetch team members');
      }

      const data = await response.json();
      setMembers(data.members);
    } catch (error) {
      console.error('Error fetching team members:', error);
      toast.error('Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchTeamMembers();
    }
  }, [projectId]);

  const handleOpenModal = () => {
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  return (
    <>
      <button
        onClick={handleOpenModal}
        className="flex items-center gap-1 text-sm font-medium hover:text-blue-600 transition-colors"
      >
        <Users className="h-4 w-4" />
        <span>Team Members ({members.length})</span>
      </button>

      {/* Team Members Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Team Members</h3>
              <button 
                onClick={handleCloseModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p>No team members yet</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {members.map((member) => (
                  <div 
                    key={member.userId} 
                    className="flex items-center p-3 bg-gray-50 rounded-md"
                  >
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 mr-3">
                      {member.displayName ? member.displayName.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <div className="font-medium">
                        {member.displayName || 'User ' + member.userId.substring(0, 6)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {member.email || `Joined ${new Date(member.createdAt).toLocaleDateString()}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md text-sm font-medium hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
