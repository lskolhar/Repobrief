"use client";
import React, { useState } from "react";
import { Tabs, TabsList } from "@/components/ui/tabs";
import Prism from "react-syntax-highlighter";
import { lucario } from "react-syntax-highlighter/dist/esm/styles/prism";

export type FileReference = {
  fileName: string;
  summary: string;
  sourceCode?: string;
};

interface CodeReferencesProps {
  references: FileReference[];
}

const CodeReferences: React.FC<CodeReferencesProps> = ({ references }) => {
  const [tab, setTab] = useState(references[0]?.fileName || "");

  if (!references || references.length === 0) return null;

  return (
    <div className="max-w-[70vw]">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="overflow-x-scroll flex gap-2 bg-gray-200 p-1 rounded-md">
          {references.map((file) => (
            <button
              key={file.fileName}
              className={
                `px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ` +
                (tab === file.fileName
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted")
              }
              onClick={() => setTab(file.fileName)}
            >
              {file.fileName}
            </button>
          ))}
        </TabsList>
        <div className="mt-4">
          {references.map((file) =>
            tab === file.fileName ? (
              <div
                key={file.fileName}
                className="max-h-[40vh] overflow-scroll max-w-7xl rounded-md"
              >
                <div className="mb-2 font-semibold">{file.summary}</div>
                <Prism language="typescript" style={lucario}>
                  {file.sourceCode || "No source code available."}
                </Prism>
              </div>
            ) : null
          )}
        </div>
      </Tabs>
    </div>
  );
};

export default CodeReferences;
