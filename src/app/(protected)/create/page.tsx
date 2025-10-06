'use client';
import { api } from '@/trpc/react';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useUser } from '@clerk/nextjs';

// Define the form input type
type FormInput = {
  repourl: string;
  projectName: string;
  githubtoken?: string;
};

type CreditCheckData = {
  fileCount: number;
  userCredits: number;
};

const CreatePage = () => {
  const { register, handleSubmit, reset } = useForm<FormInput>();
  const createProject = api.project.createProject.useMutation();
  const checkCreditsMutation = api.project.checkCredits.useMutation();
  const { user } = useUser();
  const [creditCheckData, setCreditCheckData] = useState<CreditCheckData | null>(null);

  const onSubmit = async (data: FormInput) => {
    if (!user) {
      toast.error('You must be logged in to create a project');
      return;
    }

    // If we don't have credit check data, perform the check
    if (!creditCheckData) {
      checkCreditsMutation.mutate({
        githubUrl: data.repourl,
        githubToken: data.githubtoken
      }, {
        onSuccess: (response) => {
          setCreditCheckData({
            fileCount: response.fileCount,
            userCredits: response.userCredits
          });
          toast.success('Credits checked successfully');
        },
        onError: (error) => {
          toast.error('Failed to check credits: ' + error.message);
        }
      });
      return;
    }

    // If we have credit check data, validate and create project
    if (creditCheckData.fileCount > creditCheckData.userCredits) {
      toast.error('Not enough credits to create this project');
      return;
    }

    createProject.mutate({
      githuburl: data.repourl,
      name: data.projectName,
      githubtoken: data.githubtoken
    }, {
      onSuccess: () => {
        toast.success('Project created successfully');
        reset();
        setCreditCheckData(null);
      },
      onError: (error) => {
        console.error('Project creation error:', error);
        toast.error(`Failed to create project: ${error.message}`);
      }
    });
  };

  return (
    <div className="flex items-center gap-12 h-full justify-center">
      <img src="/undraw_github.svg" className="h-56 w-auto" alt="GitHub Illustration" />
      <div>
        <h1 className="font-semibold text-2xl">Link your GitHub repository</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Enter the URL of your repository to link it to RepoBrief.
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input
            type="text"
            placeholder="Project Name"
            {...register('projectName', { required: true })}
            className="w-full p-2 border border-gray-300 rounded"
          />
          <input
            type="text"
            placeholder="GitHub Repository URL"
            {...register('repourl', { required: true })}
            className="w-full p-2 border border-gray-300 rounded"
          />
          <input
            type="text"
            placeholder="GitHub Token (optional)"
            {...register('githubtoken')}
            className="w-full p-2 border border-gray-300 rounded"
          />

          {/* Credit info section */}
          {creditCheckData && (
            <div className="bg-blue-50 border border-blue-200 rounded p-4 my-2">
              <div className="text-blue-700 font-semibold mb-1">Credit Usage</div>
              <div className="flex flex-col gap-1 text-sm">
                <span><b>Credits required</b>: {creditCheckData.fileCount}</span>
                <span><b>Your credits</b>: {creditCheckData.userCredits}</span>
                <span><b>Credits left after creation</b>: {creditCheckData.userCredits - creditCheckData.fileCount}</span>
              </div>
              {creditCheckData.fileCount > creditCheckData.userCredits && (
                <div className="text-red-600 mt-2">You do not have enough credits to create this project.</div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={
              createProject.status === 'pending' ||
              checkCreditsMutation.status === 'pending' ||
              !!(creditCheckData && creditCheckData.fileCount > creditCheckData.userCredits)
            }
            className="bg-blue-600 text-white px-4 py-2 rounded w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createProject.status === 'pending' ? 'Creating...' :
             checkCreditsMutation.status === 'pending' ? 'Checking Credits...' :
             creditCheckData ? 'Create Project' : 'Check Credits'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreatePage;
