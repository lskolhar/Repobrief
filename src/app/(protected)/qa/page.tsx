'use client'
import React, { useState } from 'react'
import { useProjectsCtx } from '@/hooks/project-context'
import { api } from '@/trpc/react'
import { Loader2, Clock, Save } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import AskQuestionCard from "../dashboard/ask-question-card"
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
  const [askQuestion, setAskQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState("");
  const [referencedFiles, setReferencedFiles] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  
  // Fetch saved questions using TRPC
  const { data, isLoading } = api.project.getQuestions.useQuery(
    { projectId: project?.id || '' },
    { enabled: !!project?.id }
  );
  
  // Ensure questions is always an array to fix TypeScript errors
  const questions: QuestionWithReferencedFiles[] = Array.isArray(data) ? data : [];
  
  // Function to view a saved question
  const viewSavedQuestion = (question: QuestionWithReferencedFiles) => {
    setSelectedQuestion(question);
    setActiveFileIndex(0);
    setOpen(true);
  };
  
  return (
    <div className="p-6">
      {project ? (
        <>
          {/* Ask Question input field - Direct input like dashboard */}
          <div className="mb-6">
            <div className="border rounded-lg p-4 bg-white">
              <h2 className="text-lg font-medium mb-2">Ask a question</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!askQuestion.trim() || !project?.id) return;
                
                setAnswer("");
                setReferencedFiles([]);
                setLoading(true);
                setOpen(true);
                
                try {
                  const response = await fetch('/api/qa', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      question: askQuestion,
                      projectId: project.id,
                    }),
                  });
                  
                  const data = await response.json();
                  
                  if (!response.ok) {
                    throw new Error(data.message || 'Failed to get answer');
                  }
                  
                  if (data.referencedFiles && Array.isArray(data.referencedFiles)) {
                    setReferencedFiles(data.referencedFiles);
                  }
                  
                  if (data.answer) {
                    setAnswer(data.answer);
                  } else {
                    setAnswer("Sorry, no answer was generated.");
                  }
                } catch (error) {
                  console.error('Error asking question:', error);
                  setAnswer("Sorry, there was an error getting the answer.");
                  setReferencedFiles([]);
                } finally {
                  setLoading(false);
                }
              }}>
                <textarea 
                  className="w-full border rounded-md p-2 min-h-[100px] mb-2"
                  placeholder="Type your question here..."
                  value={askQuestion}
                  onChange={(e) => setAskQuestion(e.target.value)}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !askQuestion.trim()}
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
            </div>
          </div>
          
          {/* Saved Questions Section */}
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
          
          {/* Dialog for displaying answers */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="flex flex-col items-start gap-4 py-6 px-6 max-w-4xl mx-auto bg-white" style={{background: 'white', maxHeight: '90vh', overflowY: 'auto'}}>
              <DialogTitle className="sr-only">Question Answer</DialogTitle>
              
              <div className="flex items-center bg-white rounded-full shadow p-2 mb-2" style={{height: 40, width: 40}}>
                <img src="/logo.png" alt="repobrief logo" style={{height: 30, width: 30, objectFit: 'contain'}} />
              </div>
              
              <div className="w-full">
                {/* Question */}
                <div className="font-medium text-lg mb-4">
                  {selectedQuestion ? selectedQuestion.question : askQuestion}
                </div>
                
                {/* Answer */}
                <div className="text-sm">
                  <div className="whitespace-pre-wrap">
                    <div className="text-base leading-relaxed">
                      {/* Import SafeMarkdown component to properly render markdown */}
                      <div className="safe-markdown-content">
                        {/* Process markdown content */}
                        {(() => {
                          const content = selectedQuestion ? selectedQuestion.answer : answer;
                          
                          // Process markdown to HTML
                          let processed = content
                            // Code blocks with language
                            .replace(/```(\w+)\n([\s\S]*?)```/g, '<pre class="bg-gray-800 text-white p-3 rounded overflow-x-auto my-4"><code class="language-$1">$2</code></pre>')
                            // Code blocks without language
                            .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-800 text-white p-3 rounded overflow-x-auto my-4"><code>$1</code></pre>')
                            // Inline code
                            .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded">$1</code>')
                            // Bold
                            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                            // Italic
                            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
                            // Headers
                            .replace(/^### (.*)$/gm, '<h3 class="text-lg font-bold mb-2">$1</h3>')
                            .replace(/^## (.*)$/gm, '<h2 class="text-xl font-bold mb-2">$1</h2>')
                            .replace(/^# (.*)$/gm, '<h1 class="text-2xl font-bold mb-2">$1</h1>')
                            // Lists
                            .replace(/^- (.*)$/gm, '<li>$1</li>')
                            .replace(/(<li>.*<\/li>\n)+/g, '<ul class="list-disc pl-6 mb-4">$&</ul>')
                            // Paragraphs (must come last)
                            .replace(/^(?!<[uh\d]|<pre|<code|<strong|<em|<li|<ul)(.+)$/gm, '<p class="mb-4">$1</p>');
                          
                          return <div dangerouslySetInnerHTML={{ __html: processed }} />;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* File tabs */}
                {(selectedQuestion ? selectedQuestion.referencedFiles : referencedFiles).length > 0 && (
                  <div className="w-full mt-6 border rounded-md overflow-hidden" style={{ maxHeight: '400px' }}>
                    {/* File tabs */}
                    <div className="flex overflow-x-auto bg-gray-100">
                      {Array.from(new Set((selectedQuestion ? selectedQuestion.referencedFiles : referencedFiles).map((file) => 
                        file.fileName.split('/').pop() || file.fileName
                      ))).map((uniqueFileName: string, index: number) => {
                        // Find the first file with this name
                        const fileIndex = (selectedQuestion ? selectedQuestion.referencedFiles : referencedFiles).findIndex((file) => 
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
                      {(selectedQuestion ? selectedQuestion.referencedFiles : referencedFiles)[activeFileIndex]?.sourceCode ? (
                        <pre className="font-mono text-xs">
                          {(selectedQuestion ? selectedQuestion.referencedFiles : referencedFiles)[activeFileIndex].sourceCode}
                        </pre>
                      ) : (
                        <div className="text-gray-400">No source code available</div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Save Answer button - only show when viewing a new answer, not a saved question */}
                {!selectedQuestion && answer && (
                  <div className="mt-4 flex justify-end">
                    <Button 
                      onClick={async () => {
                        if (!project?.id || !askQuestion || !answer) return;
                        
                        setSaving(true);
                        try {
                          const response = await fetch('/api/save-question', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              projectId: project.id,
                              question: askQuestion,
                              answer,
                              referencedFiles
                            }),
                          });
                          
                          if (!response.ok) {
                            throw new Error('Failed to save answer');
                          }
                          
                          alert('Answer saved successfully');
                          // Refresh the questions list
                          // Use the refetch function instead of trying to call the hook directly
                          try {
                            // This will trigger a refetch of the questions data
                            window.location.reload();
                          } catch (refreshErr) {
                            console.error('Error refreshing questions:', refreshErr);
                          }
                        } catch (err) {
                          console.error('Error saving answer:', err);
                          alert('Failed to save answer');
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving}
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save Answer
                    </Button>
                  </div>
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
