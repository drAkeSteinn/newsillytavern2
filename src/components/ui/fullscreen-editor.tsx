'use client';

import { ReactNode, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EditorTab {
  value: string;
  label: string;
  icon: ReactNode;
}

interface FullscreenEditorProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  initialTab?: string;
  tabs: EditorTab[];
  children: ReactNode;
  /** Optional separator between specific tab groups */
  separatorAfter?: string[];
  /** Extra content rendered in the sidebar footer */
  footer?: ReactNode;
  /** Header actions (buttons on the right side of the header) */
  headerActions?: ReactNode;
  /** Bottom action bar (Save/Cancel buttons) */
  actions?: ReactNode;
  className?: string;
}

export function FullscreenEditor({
  open,
  onClose,
  title,
  subtitle,
  initialTab,
  tabs,
  children,
  separatorAfter,
  footer,
  headerActions,
  actions,
  className,
}: FullscreenEditorProps) {
  const [prevOpen, setPrevOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab || tabs[0]?.value || '');

  // Reset active tab when panel opens (setState during render — React-recommended pattern)
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open && initialTab) {
      setActiveTab(initialTab);
    }
  }

  // Close panel on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const separatorSet = separatorAfter ? new Set(separatorAfter) : null;

  return (
    <>
      <AnimatePresence mode="wait">
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className={cn(
              "fixed inset-0 z-50 bg-background",
              className
            )}
          >
            <div className="h-full flex">
              {/* Sidebar */}
              <motion.aside
                initial={{ x: -16, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.25, delay: 0.05, ease: 'easeOut' }}
                className="w-14 md:w-60 border-r bg-muted/30 flex flex-col flex-shrink-0"
              >
                {/* Sidebar header */}
                <div className="flex items-center justify-between px-2 py-3 md:px-4 border-b">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg font-semibold truncate">{title}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={onClose}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Scrollable navigation */}
                <ScrollArea className="flex-1">
                  <TooltipProvider delayDuration={400}>
                    <nav className="p-1.5 md:p-2 space-y-0.5">
                      {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.value;
                        return (
                          <div key={tab.value}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => setActiveTab(tab.value)}
                                  className={cn(
                                    'w-full flex items-center gap-3 rounded-md text-sm transition-all duration-150',
                                    'px-0 md:px-3 py-2 justify-center md:justify-start',
                                    isActive
                                      ? 'bg-primary/10 text-primary font-medium shadow-sm'
                                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                                  )}
                                >
                                  <Icon className={cn(
                                    'w-4 h-4 shrink-0 transition-colors',
                                    isActive && 'text-primary'
                                  )} />
                                  <span className="hidden md:inline truncate">{tab.label}</span>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="md:hidden">
                                {tab.label}
                              </TooltipContent>
                            </Tooltip>
                            {separatorSet?.has(tab.value) && (
                              <Separator className="my-1.5 md:my-2" />
                            )}
                          </div>
                        );
                      })}
                    </nav>
                  </TooltipProvider>
                </ScrollArea>

                {/* Sidebar footer */}
                {footer && (
                  <div className="px-4 py-2 border-t text-xs text-muted-foreground">
                    {footer}
                  </div>
                )}
              </motion.aside>

              {/* Main content area */}
              <motion.main
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.1, ease: 'easeOut' }}
                className="flex-1 overflow-hidden min-w-0"
              >
                {/* Subtitle */}
                {(subtitle || headerActions) && (
                  <div className="flex items-center justify-between px-6 py-4 border-b">
                    {subtitle && (
                      <p className="text-sm text-muted-foreground">{subtitle}</p>
                    )}
                    {headerActions}
                  </div>
                )}

                {/* Tab content */}
                <div className="h-[calc(100%-1px)] overflow-y-auto p-6">
                  {children}
                </div>

                {/* Bottom actions */}
                {actions && (
                  <div className="flex justify-end gap-2 px-6 py-4 border-t bg-background">
                    {actions}
                  </div>
                )}
              </motion.main>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
