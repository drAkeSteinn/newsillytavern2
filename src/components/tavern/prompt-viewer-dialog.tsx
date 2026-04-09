'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PromptSection } from '@/types';

interface PromptViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: PromptSection[];
}

export function PromptViewerDialog({ open, onOpenChange, sections }: PromptViewerDialogProps) {
  const [copied, setCopied] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set(sections.map((_, i) => i)));

  const toggleSection = (index: number) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedSections(new Set(sections.map((_, i) => i)));
  };

  const collapseAll = () => {
    setExpandedSections(new Set());
  };

  // Get clean prompt text (without section labels)
  const getCleanPrompt = () => {
    return sections.map(s => s.content).join('\n\n');
  };

  // Get formatted prompt with section labels
  const getFormattedPrompt = () => {
    return sections.map(s => `[${s.label}]\n${s.content}`).join('\n\n');
  };

  const handleCopyClean = async () => {
    await navigator.clipboard.writeText(getCleanPrompt());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyFormatted = async () => {
    await navigator.clipboard.writeText(getFormattedPrompt());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg">Prompt Viewer</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={expandAll}
                className="h-7 text-xs"
              >
                Expand All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={collapseAll}
                className="h-7 text-xs"
              >
                Collapse All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyClean}
                className="h-7 text-xs"
              >
                {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                Copy Clean
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleCopyFormatted}
                className="h-7 text-xs"
              >
                {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                Copy with Labels
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-3 p-4">
            {sections.map((section, index) => (
              <div
                key={index}
                className="border rounded-lg overflow-hidden"
              >
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(index)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-left font-medium text-sm transition-colors',
                    section.color,
                    'hover:brightness-95'
                  )}
                >
                  {expandedSections.has(index) ? (
                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 flex-shrink-0" />
                  )}
                  <span>{section.label}</span>
                  <span className="text-xs opacity-60 ml-auto">
                    ~{Math.ceil(section.content.length / 4).toLocaleString()} tokens
                  </span>
                </button>

                {/* Section Content */}
                {expandedSections.has(index) && (
                  <div className="p-3 bg-background/50 border-t">
                    <pre className="text-xs whitespace-pre-wrap break-words font-mono text-muted-foreground leading-relaxed">
                      {section.content}
                    </pre>
                  </div>
                )}
              </div>
            ))}

            {sections.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No prompt data available</p>
                <p className="text-xs mt-1">The prompt will be available after generating a response</p>
              </div>
            )}
          </div>
          </ScrollArea>
        </div>

        {/* Footer with stats */}
        <div className="px-4 py-2 border-t bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {sections.length} sections • ~{Math.ceil(getCleanPrompt().length / 4).toLocaleString()} total tokens
          </span>
          <span>
            {getCleanPrompt().length.toLocaleString()} characters
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
