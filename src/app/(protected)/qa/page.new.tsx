'use client'
import React, { useState } from 'react'
import { useProjectsCtx } from '@/hooks/project-context'
import { api } from '@/trpc/react'
import { Loader2, Clock } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { type Question } from '@prisma/client'

interface QuestionWithReferencedFiles extends Question {
  referencedFiles: Array<{
    fileName: string;
    sourceCode: string;
  }>;
}

const QAPage = () => {
  const { project } = useProjectsCtx();
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionWithReferencedFiles | null>(null);
  const [open, setOpen] = useState(false);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Fetch saved questions using TRPC
  const { data: questionsData, isLoading, refetch } = api.project.getQuestions.useQuery(
    { projectId: project?.id || '' },
    { enabled: !!project?.id }
  );
  
  // Ensure questions is always an array to fix TypeScript errors
  const questions = Array.isArray(questionsData) ? questionsData : [];
  
  // Function to view a saved question
  const viewSavedQuestion = (question: QuestionWithReferencedFiles) => {
    setSelectedQuestion(question);
    setActiveFileIndex(0);
    setOpen(true);
  };

  // Function to ask a question
  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !project?.id) return;
    
    setLoading(true);
    
    try {
      const response = await fetch('/api/qa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          projectId: project.id,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to get answer');
      }
      
      // After getting the answer, redirect to dashboard
      window.location.href = `/dashboard?project=${project.id}`;
    } catch (error) {
      console.error('Error asking question:', error);
      alert('Failed to get answer. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="p-6">
      {project ? (
        <>
          {/* Ask Question Section - Direct input like dashboard */}
          <Card className="mb-8">
            <CardContent className="pt-6">
              <h2 className="text-xl font-bold mb-4">Ask a Question</h2>
              <form onSubmit={handleAskQuestion} className="space-y-4">
                <textarea
                  className="w-full border rounded-md p-3 min-h-[120px]"
                  placeholder="Type your question here..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading || !question.trim()}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Ask RepoBrief'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
          
          {/* Single Saved Questions Section */}
          <div>
            <h2 className="text-xl font-bold mb-4">Saved Questions</h2>
            <div className="border rounded-lg p-6 bg-white">
              {isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : !Array.isArray(questions) || questions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No saved questions yet. Ask a question and click "Save Answer" to save it.
                </div>
              ) : (
                <div className="space-y-4">
                  {(questions as QuestionWithReferencedFiles[]).map((question: QuestionWithReferencedFiles) => (
                    <div 
                      key={question.id} 
                      className="border rounded-md p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => viewSavedQuestion(question)}
                    >
                      <div className="font-medium">{question.question}</div>
                      <div className="text-sm text-muted-foreground mt-1 flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {new Date(question.createdAt).toLocaleDateString()} {new Date(question.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Question View Dialog */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="flex flex-col items-start gap-4 py-6 px-6 max-w-4xl mx-auto bg-white" style={{background: 'white', maxHeight: '90vh', overflowY: 'auto'}}>
              <DialogTitle className="sr-only">Saved Question</DialogTitle>
              
              <div className="flex items-center bg-white rounded-full shadow p-2 mb-2" style={{height: 40, width: 40}}>
                <img src="/logo.png" alt="repobrief logo" style={{height: 30, width: 30, objectFit: 'contain'}} />
              </div>
              
              <div className="w-full">
                {selectedQuestion && (
                  <>
                    {/* Question */}
                    <div className="font-medium text-lg mb-4">{selectedQuestion.question}</div>
                    
                    {/* Answer */}
                    <div className="text-sm">
                      <div className="whitespace-pre-wrap">
                        <div className="text-base leading-relaxed">
                          {selectedQuestion.answer.split('\n').map((line: string, i: number) => {
                            // Check if this is a section heading (all caps followed by colon)
                            const isSectionHeading = /^[A-Z\s]+:/.test(line);
                            
                            // Check if this is a code snippet line
                            const isCodeLine = line.trim().startsWith('<') || 
                                              line.trim().startsWith('function') ||
                                              line.trim().startsWith('import') ||
                                              line.trim().startsWith('export') ||
                                              line.trim().startsWith('class') ||
                                              line.trim().startsWith('const') ||
                                              line.trim().startsWith('let') ||
                                              line.trim().startsWith('var') ||
                                              /^\s*[a-zA-Z_]+\([^)]*\)\s*{/.test(line);
                            
                            // Check if this is a line number reference
                            const isLineReference = /^Lines \d+-\d+|^Line \d+/.test(line);
                            
                            // Check if this is a list item
                            const isList = /^[\-\*]\s/.test(line);
                            
                            if (isSectionHeading) {
                              return (
                                <div key={i} className="font-bold text-lg mt-6 mb-3 text-blue-700 border-b pb-1">
                                  {line}
                                </div>
                              );
                            } else if (isLineReference) {
                              return (
                                <div key={i} className="font-semibold text-md mt-3 mb-2 text-gray-700">
                                  {line}
                                </div>
                              );
                            } else if (isCodeLine) {
                              return (
                                <div key={i} className="font-mono text-sm bg-gray-100 p-1 my-1 rounded">
                                  {line}
                                </div>
                              );
                            } else if (isList) {
                              return (
                                <div key={i} className="ml-4 mb-1">
                                  {/* Render HTML content if it contains HTML tags */}
                                  {line.includes('<b>') || line.includes('</b>') ? (
                                    <div dangerouslySetInnerHTML={{ __html: line }} />
                                  ) : (
                                    line
                                  )}
                                </div>
                              );
                            } else if (line.trim() === '') {
                              return <div key={i} className="h-3"></div>; // Empty line spacing
                            } else {
                              // Render HTML content if it contains HTML tags
                              return (
                                <div key={i} className="mb-2">
                                  {line.includes('<b>') || line.includes('</b>') ? (
                                    <div dangerouslySetInnerHTML={{ __html: line }} />
                                  ) : (
                                    line
                                  )}
                                </div>
                              );
                            }
                          })}
                        </div>
                      </div>
                    </div>
                    
                    {/* File tabs */}
                    {selectedQuestion.referencedFiles && selectedQuestion.referencedFiles.length > 0 && (
                      <div className="w-full mt-6 border rounded-md overflow-hidden" style={{ maxHeight: '400px' }}>
                        {/* File tabs */}
                        <div className="flex overflow-x-auto bg-gray-100">
                          {Array.from(new Set(selectedQuestion.referencedFiles.map((file) => 
                            file.fileName.split('/').pop() || file.fileName
                          ))).map((uniqueFileName: string, index: number) => {
                            // Find the first file with this name
                            const fileIndex = selectedQuestion.referencedFiles.findIndex((file) => 
                              (file.fileName.split('/').pop() || file.fileName) === uniqueFileName
                            );
                            
                            return (
                              <button
                                key={index}
                                onClick={() => setActiveFileIndex(fileIndex)}
                                className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
                                  fileIndex === activeFileIndex ? 'bg-blue-500 text-white' : 'hover:bg-gray-200'
                                }`}
                              >
                                {uniqueFileName}
                              </button>
                            );
                          })}
                        </div>
                        
                        {/* File content */}
                        <div className="bg-gray-900 text-white p-4 overflow-x-auto" style={{ minHeight: '200px', maxHeight: '300px', overflowY: 'auto' }}>
                          {selectedQuestion.referencedFiles[activeFileIndex]?.sourceCode ? (
                            <pre className="font-mono text-xs">
                              {selectedQuestion.referencedFiles[activeFileIndex].sourceCode}
                            </pre>
                          ) : (
                            <div className="text-gray-400">No source code available</div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          Please select a project to view saved questions.
        </div>
      )}
    </div>
  );
};

export default QAPage;
