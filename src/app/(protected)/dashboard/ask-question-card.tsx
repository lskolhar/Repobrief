"use client";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProjectsCtx } from '@/hooks/project-context';
import { Loader2, Save, Clock } from "lucide-react";
import { api } from '@/trpc/react';
import SafeMarkdown from '@/components/safe-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface SavedQuestion {
  id: string;
  question: string;
  answer: string;
  referencedFiles: any[];
  createdAt: string;
}

interface AskQuestionCardProps {
  open?: boolean;
  setOpen?: (open: boolean) => void;
  project?: any;
  onQuestionSaved?: () => void;
}

const AskQuestionCard = (props: AskQuestionCardProps = {}) => {
  // Use props if provided, otherwise use context
  const projectContext = useProjectsCtx();
  const projectToUse = props.project || projectContext.project;
  
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [referencedFiles, setReferencedFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [localOpen, setLocalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // Referenced files tab index (must be top-level for hooks order)
  const [activeTab, setActiveTab] = useState(0);
  
  // Use props for open/setOpen if provided, otherwise use local state
  const open = props.open !== undefined ? props.open : localOpen;
  const setOpen = props.setOpen || setLocalOpen;
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [savedQuestions, setSavedQuestions] = useState<SavedQuestion[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<SavedQuestion | null>(null);
  const [viewingSaved, setViewingSaved] = useState(false);
  
  // Check if we're on the Q&A page
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const isQAPage = pathname.includes('/qa');

  // Fetch saved questions when the project changes
  useEffect(() => {
    if (projectToUse?.id) {
      fetchSavedQuestions();
    }
  }, [projectToUse?.id]);

  // Function to fetch saved questions
  const fetchSavedQuestions = async () => {
    if (!projectToUse?.id) return;
    
    setLoadingSaved(true);
    try {
      const response = await fetch(`/api/get-saved-questions?projectId=${projectToUse.id}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch saved questions');
      }
      
      setSavedQuestions(data.savedQuestions || []);
    } catch (err) {
      console.error("Error fetching saved questions:", err);
    } finally {
      setLoadingSaved(false);
    }
  };

  // Function to view a saved question
  const viewSavedQuestion = (question: SavedQuestion) => {
    setSelectedQuestion(question);
    setViewingSaved(true);
    setOpen(true);
    setActiveFileIndex(0);
  };

  async function handleAskQuestion(e: React.FormEvent) {
    e.preventDefault();
    setAnswer("");
    setReferencedFiles([]);
    setLoading(true);
    setOpen(true);
    const projectId = projectToUse?.id;
    if (!question.trim() || !projectId) return;
    
    setLoading(true);
    setAnswer("");
    setReferencedFiles([]);
    
    try {
      const response = await fetch('/api/qa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          projectId,
        }),
      });
      let data: any = {};
      try {
        data = await response.json();
        console.log('[AskQuestionCard] API response:', data);
      } catch (jsonErr) {
        console.error('[AskQuestionCard] Error parsing JSON:', jsonErr);
        setAnswer('Sorry, there was a problem processing the server response.');
        setLoading(false);
        return;
      }

      if (!response.ok) {
        // Always show the error or answer from backend
        // Clean and format the answer before displaying
      let answer = data.answer || data.message || 'Failed to get answer';
      answer = cleanMarkdown(answer);
      // Optionally: split answer into points if it looks like a list
      if (answer.includes('\n')) {
        const points = answer.split(/\n+/).filter(Boolean);
        if (points.length > 1) {
          answer = points.map((p: string, i: number) => `${i + 1}. ${p.replace(/^[-*\d.\s]+/, '')}`).join('\n');
        }
      }
      setAnswer(answer);
        setLoading(false);
        return;
      }

      // Always set referencedFiles, even if empty
      setReferencedFiles(Array.isArray(data.referencedFiles) ? data.referencedFiles : []);

      if (data.answer) {
        setAnswer(data.answer);
      } else {
        setAnswer("Sorry, no answer was generated.");
      }
    } catch (err: any) {
      console.error("[AskQuestionCard] Error in handleAskQuestion:", err);
      setAnswer(err?.message || 'Sorry, there was an unexpected error.');
      setReferencedFiles([]);
    } finally {
      setLoading(false);
    }
  }

  // Get the saveAnswer mutation
  const saveAnswer = api.project.saveAnswer.useMutation();

  async function handleSaveAnswer() {
    if (!projectToUse?.id || !question || !answer) return;
    
    // Format the answer before saving (same as display logic)
    let formattedAnswer = answer;
    const keywords = [
      'TypeScript', 'Python', 'Yarn', 'npm', 'pnpm', 'ESLint', 'Prettier', 'Jest', 'TypeDoc', 'Docusaurus',
      'Codecov', 'Docker', 'Quarto', 'EditorConfig', 'dlib', 'face_recognition', 'NumPy', 'SciPy', 'scikit-image', 'Pillow', 'OpenCV', 'CUDA', 'PyInstaller',
      'Next.js', 'React', 'Redux', 'Tailwind', 'Express', 'Prisma', 'Gemini', 'LangChain', 'GPT', 'Turbo', 'Bun'
    ];
    keywords.forEach(word => {
      const reg = new RegExp(`(?<!<b>)\\b${word}\\b(?!<\\/b>)`, 'g');
      formattedAnswer = formattedAnswer.replace(reg, `<b>${word}</b>`);
    });
    // Remove all stray markdown bold/italic markers before further formatting
    formattedAnswer = formattedAnswer
      .replace(/\*\*(.*?)\*\*/gim, '<b>$1</b>')
      .replace(/\*(.*?)\*/gim, '<i>$1</i>')
      .replace(/\*\*/g, '') // Remove any remaining stray **
      .replace(/\*/g, '')    // Remove any remaining stray *
      .replace(/__([^_]+)__/g, '<b>$1</b>')
      .replace(/_([^_]+)_/g, '<i>$1</i>');
    const lines = formattedAnswer.split(/\n|\r|\u2022|\-/).map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length > 1) {
      formattedAnswer = '<ul>' + lines.map(line => `<li>${line.replace(/^\*+\s*/, '')}</li>`).join('') + '</ul>';
    } else {
      formattedAnswer = formattedAnswer
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/<b>(.*?)<\/b>/gim, '<b>$1</b>')
        .replace(/<i>(.*?)<\/i>/gim, '<i>$1</i>')
        .replace(/^\s*\- (.*$)/gim, '<li>$1</li>')
        .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
        .replace(/`([^`]+)`/gim, '<code>$1</code>')
        .replace(/\n{2,}/g, '</p><p>')
        .replace(/([^<p>][^\n]+)(?=\n|$)/g, '<p>$1</p>');
    }

    setSaving(true);
    try {
      // Use TRPC mutation instead of fetch
      const result = await saveAnswer.mutateAsync({
        projectId: projectToUse.id,
        question,
        answer: formattedAnswer,
        referencedFiles
      });
      
      alert("Answer saved successfully");
      // Refresh saved questions if we're on the QA page
      if (isQAPage) {
        fetchSavedQuestions();
      }
    } catch (err) {
      console.error("Error saving answer:", err);
      alert("Failed to save answer");
    } finally {
      setSaving(false);
    }
  }

  // Main render for dashboard and QA page: always show dialog/modal UI
  return (
    <Card className="relative col-span-3">
      <CardContent>
        <form onSubmit={handleAskQuestion} className="flex flex-col gap-4">
          <div className="font-semibold text-lg mb-2">Ask a question</div>
          <textarea
            className="w-full rounded border p-2"
            placeholder="Which file should I edit to change the homepage?"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            rows={4}
          />
          <Button type="submit" disabled={loading || !question.trim()}> {loading ? "Asking..." : "Ask RepoBrief"}</Button>
        </form>
      </CardContent>
      <Dialog open={open} onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setViewingSaved(false);
          setSelectedQuestion(null);
        }
      }}>
        <DialogContent className="flex flex-col items-start gap-4 py-6 px-6 max-w-4xl mx-auto bg-white" style={{background: 'white', maxHeight: '90vh', overflowY: 'auto'}}>
          <DialogTitle className="sr-only">Ask a Question Result</DialogTitle>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white rounded-full shadow p-2" style={{height: 40, width: 40}}>
                <img src="/logo.png" alt="repobrief logo" style={{height: 30, width: 30, objectFit: 'contain'}} />
              </div>
            </div>
            {!viewingSaved && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSaveAnswer} 
                disabled={saving || !answer}
                className="flex items-center gap-1"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                <span>Save Answer</span>
              </Button>
            )}
          </div>
          {/* Question */}
          <div className="font-medium text-lg mb-4">
            {viewingSaved && selectedQuestion 
              ? selectedQuestion.question 
              : question}
          </div>
          {/* Answer */}
          <div className="text-sm w-full">
            <div className="whitespace-pre-wrap">
              <div className="text-base leading-relaxed prose prose-blue max-w-none">
                {(() => {
                  let ans = (viewingSaved && selectedQuestion ? selectedQuestion.answer : answer) || '';
                  const keywords = [
                    'TypeScript', 'Python', 'Yarn', 'npm', 'pnpm', 'ESLint', 'Prettier', 'Jest', 'TypeDoc', 'Docusaurus',
                    'Codecov', 'Docker', 'Quarto', 'EditorConfig', 'dlib', 'face_recognition', 'NumPy', 'SciPy', 'scikit-image', 'Pillow', 'OpenCV', 'CUDA', 'PyInstaller',
                    'Next.js', 'React', 'Redux', 'Tailwind', 'Express', 'Prisma', 'Gemini', 'LangChain', 'GPT', 'Turbo', 'Bun'
                  ];
                  function escapeRegExp(str: string) {
                    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                  }
                  keywords.forEach(word => {
                    const safeWord = escapeRegExp(word);
                    const reg = new RegExp(`\\b${safeWord}\\b`, 'gi');
                    ans = ans.replace(reg, `**${word}**`);
                  });
                  return (
                    <SafeMarkdown>
                      {cleanMarkdown(ans)}
                    </SafeMarkdown>
                  );
                })()}
              </div>
            </div>
            {/* Code References Section */}
            {(() => {
              const files = (viewingSaved && selectedQuestion 
                ? selectedQuestion.referencedFiles 
                : referencedFiles);
              if (!files || files.length === 0) return null;
              return (
                <div className="mt-6">
                  <div className="font-semibold mb-2">Code References</div>
                  <div className="space-y-4">
                    {files.map((ref: any, idx: number) => (
                      <div key={ref.fileName + idx} className="border rounded-md p-3 bg-white shadow-sm">
                        <div className="font-mono text-sm text-blue-700 mb-2">
                          {ref.fileName} <span className="text-gray-400">(lines {ref.startLine}-{ref.endLine})</span>
                        </div>
                        {ref.summary && (
                          <div className="text-xs text-gray-500 mb-2">{ref.summary}</div>
                        )}
                        <pre className="rounded bg-gray-100 overflow-x-auto p-2 text-xs">
                          <code>
                            {ref.codeSnippet}
                          </code>
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
          <button
            onClick={() => {
              setOpen(false);
              setViewingSaved(false);
              setSelectedQuestion(null);
            }}
            className="text-white font-medium w-full h-full"
          >
            Close
          </button>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Utility to clean up orphaned markdown symbols
function cleanMarkdown(md: string): string {
  // Remove stray ** or * not surrounding text
  let cleaned = md.replace(/\*\*(\s*)\*\*/g, '$1'); // Remove empty bold
  cleaned = cleaned.replace(/\*\*(?![^\*]+\*\*)/g, ''); // Remove unmatched **
  cleaned = cleaned.replace(/\*(\s*)\*/g, '$1'); // Remove empty italics
  cleaned = cleaned.replace(/\*(?![^\*]+\*)/g, ''); // Remove unmatched *
  // Optionally, remove other stray markdown symbols
  return cleaned;
}

export default AskQuestionCard;
