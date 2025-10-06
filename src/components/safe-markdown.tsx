"use client";

import React, { useState, useEffect } from 'react';

interface SafeMarkdownProps {
  children: string;
  className?: string;
}

/**
 * A simplified SafeMarkdown component that avoids hydration errors
 * by using client-side only rendering with basic HTML formatting
 */
const SafeMarkdown: React.FC<SafeMarkdownProps> = ({ children, className }) => {
  const [isMounted, setIsMounted] = useState(false);
  
  // Only render on client-side to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Process markdown to HTML
  const processMarkdown = () => {
    // Basic markdown processing
    let processed = children
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
      
    return processed;
  };
  
  // During SSR and hydration phase, render a simple div with the same className
  if (!isMounted) {
    return <div className={className}><div className="markdown-placeholder"></div></div>;
  }
  
  // Client-side rendering with processed markdown
  return (
    <div className={className}>
      <div 
        className="safe-markdown-content"
        dangerouslySetInnerHTML={{ 
          __html: processMarkdown() 
        }} 
      />
    </div>
  );
};

export default SafeMarkdown;
