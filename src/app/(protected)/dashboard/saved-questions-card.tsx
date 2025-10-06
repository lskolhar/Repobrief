"use client";
import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useProjectsCtx } from '@/hooks/project-context';
import { Loader2, Clock } from "lucide-react";

interface SavedQuestion {
  id: string;
  question: string;
  answer: string;
  referencedFiles: any[];
  createdAt: string;
}

const SavedQuestionsCard = () => {
  const { project } = useProjectsCtx();
  const [savedQuestions, setSavedQuestions] = useState<SavedQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<SavedQuestion | null>(null);
  const [open, setOpen] = useState(false);
  const [activeFileIndex, setActiveFileIndex] = useState(0);

  // Fetch saved questions when the project changes
  useEffect(() => {
    if (project?.id) {
      fetchSavedQuestions();
    }
  }, [project?.id]);

  // Function to fetch saved questions
  const fetchSavedQuestions = async () => {
    if (!project?.id) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/get-saved-questions?projectId=${project.id}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch saved questions');
      }
      
      setSavedQuestions(data.savedQuestions || []);
    } catch (err) {
      console.error("Error fetching saved questions:", err);
    } finally {
      setLoading(false);
    }
  };

  // Function to view a saved question
  const viewSavedQuestion = (question: SavedQuestion) => {
    setSelectedQuestion(question);
    setActiveFileIndex(0);
    setOpen(true);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <Card className="col-span-3">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Saved Questions</CardTitle>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchSavedQuestions}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : savedQuestions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No saved questions yet. Ask a question and click "Save Answer" to save it.
          </div>
        ) : (
          <div className="space-y-4">
            {savedQuestions.map((question) => (
              <div 
                key={question.id} 
                className="border rounded-md p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => viewSavedQuestion(question)}
              >
                <div className="font-medium">{question.question}</div>
                <div className="text-sm text-muted-foreground mt-1 flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  {formatDate(question.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Dialog to view saved question */}
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
                      {selectedQuestion.answer.split('\n').map((line, i) => {
                        // Check if this is a heading-like line (all caps or first letter caps)
                        const isHeading = /^[A-Z][A-Za-z\s]+:/.test(line) || 
                                        /^[A-Z\s]+$/.test(line);
                        
                        // Check if this is a list item
                        const isList = /^[\-\*]\s/.test(line);
                        
                        if (isHeading) {
                          return (
                            <div key={i} className="font-semibold text-lg mt-4 mb-2">
                              {line}
                            </div>
                          );
                        } else if (isList) {
                          return (
                            <div key={i} className="ml-4 mb-1">
                              {line}
                            </div>
                          );
                        } else if (line.trim() === '') {
                          return <div key={i} className="h-4"></div>; // Empty line spacing
                        } else {
                          return <div key={i} className="mb-2">{line}</div>;
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
                      {Array.from(new Set(selectedQuestion.referencedFiles.map((file: any) => 
                        file.fileName.split('/').pop() || file.fileName
                      ))).map((uniqueFileName: string, index: number) => {
                        // Find the first file with this name
                        const fileIndex = selectedQuestion.referencedFiles.findIndex((file: any) => 
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
          
          {/* Close button */}
          <div className="w-full mt-4 border-t pt-4 flex justify-center">
            <div className="w-full h-8 bg-blue-600 rounded-md flex items-center justify-center">
              <button 
                onClick={() => setOpen(false)}
                className="text-white font-medium w-full h-full"
              >
                Close
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default SavedQuestionsCard;
