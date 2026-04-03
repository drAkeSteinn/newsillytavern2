'use client';

import { cn } from '@/lib/utils';
import type { ChatMessage as ChatMessageType, PromptSection, ChatboxAppearanceSettings } from '@/types';
import { DEFAULT_CHATBOX_APPEARANCE } from '@/types';
import { Copy, Check, Trash2, RefreshCw, ChevronLeft, ChevronRight, Volume2, Eye, Edit2, Play, X, Check as CheckIcon, Ghost } from 'lucide-react';
import { useState, memo, Fragment, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatDistanceToNow } from 'date-fns';
import { TextFormatter } from './text-formatter';
import { PromptViewerDialog } from './prompt-viewer-dialog';
import { t } from '@/lib/i18n';
import { useTavernStore } from '@/store/tavern-store';

type MessageDisplayMode = 'bubble' | 'compact' | 'full';

interface ChatMessageProps {
  message: ChatMessageType;
  characterName?: string;
  characterAvatar?: string;
  userName?: string;
  userAvatar?: string;
  showTimestamp?: boolean;
  showTokens?: boolean;
  onSwipe?: (direction: 'left' | 'right') => void;
  onDelete?: () => void;
  onRegenerate?: () => void;
  onSpeak?: () => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onReplay?: (messageId: string, content: string, characterId?: string) => void;
  hasAlternatives?: boolean;
  currentIndex?: number;
  totalAlternatives?: number;
  displayMode?: MessageDisplayMode;
  isNarrator?: boolean;
  appearance?: ChatboxAppearanceSettings;
}

export const ChatMessageBubble = memo(function ChatMessageBubble({
  message,
  characterName = t('message.assistant'),
  characterAvatar,
  userName = t('message.you'),
  userAvatar,
  showTimestamp = true,
  showTokens = false,
  onSwipe,
  onDelete,
  onRegenerate,
  onSpeak,
  onEdit,
  onReplay,
  hasAlternatives = false,
  currentIndex = 0,
  totalAlternatives = 1,
  displayMode = 'bubble',
  isNarrator = false,
  appearance: appearanceProp
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // Get appearance settings from store if not provided via props
  const storeAppearance = useTavernStore((state) => state.settings.chatboxAppearance);
  const appearance = appearanceProp || storeAppearance || DEFAULT_CHATBOX_APPEARANCE;
  
  // Ensure all nested objects exist with defaults
  const safeAppearance = useMemo(() => ({
    ...DEFAULT_CHATBOX_APPEARANCE,
    ...appearance,
    background: { ...DEFAULT_CHATBOX_APPEARANCE.background, ...appearance?.background },
    font: { ...DEFAULT_CHATBOX_APPEARANCE.font, ...appearance?.font },
    textFormatting: { ...DEFAULT_CHATBOX_APPEARANCE.textFormatting, ...appearance?.textFormatting },
    textColors: { ...DEFAULT_CHATBOX_APPEARANCE.textColors, ...appearance?.textColors },
    bubbles: { ...DEFAULT_CHATBOX_APPEARANCE.bubbles, ...appearance?.bubbles },
    avatars: { ...DEFAULT_CHATBOX_APPEARANCE.avatars, ...appearance?.avatars },
    streaming: { ...DEFAULT_CHATBOX_APPEARANCE.streaming, ...appearance?.streaming },
    input: { ...DEFAULT_CHATBOX_APPEARANCE.input, ...appearance?.input },
  }), [appearance]);

  // Helper function to convert hex color to rgba with transparency
  // Defined early to use in system message handling
  const hexToRgba = useCallback((hex: string, alpha: number): string => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }, []);

  const isCompact = displayMode === 'compact';
  const isFull = displayMode === 'full';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartEdit = () => {
    setEditContent(message.content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    if (editContent.trim()) {
      onEdit?.(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleReplay = () => {
    onReplay?.(message.id, message.content, message.characterId);
  };

  // Always allow viewing prompt for assistant messages
  const hasPromptData = message.metadata?.promptData && message.metadata.promptData.length > 0;

  if (message.isDeleted) return null;

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div 
          className="px-3 py-1.5 rounded-lg text-xs max-w-md text-center"
          style={{
            backgroundColor: hexToRgba(safeAppearance.bubbles.systemBubbleColor, safeAppearance.bubbles.transparency),
            color: safeAppearance.bubbles.systemBubbleTextColor,
            borderRadius: safeAppearance.bubbles.borderRadius,
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  // Determine display name and avatar
  const displayName = isUser ? userName : characterName;
  const displayAvatar = isUser ? userAvatar : characterAvatar;

  // ============================================
  // AVATAR STYLES FROM APPEARANCE SETTINGS
  // ============================================
  const avatarSizeMap = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-12 h-12', xl: 'w-14 h-14' };
  const avatarSize = avatarSizeMap[safeAppearance.avatars.size];
  
  const getAvatarRadius = () => {
    if (!safeAppearance.avatars.show) return 'rounded-none';
    switch (safeAppearance.avatars.shape) {
      case 'circle': return 'rounded-full';
      case 'square': return 'rounded-none';
      case 'rounded': return 'rounded-lg';
      case 'rectangular': return 'rounded-sm';
      default: return 'rounded-full';
    }
  };

  // ============================================
  // BUBBLE STYLES FROM APPEARANCE SETTINGS
  // ============================================
  
  const getBubbleStyle = () => {
    const base = 'relative';
    const radius = safeAppearance.bubbles.borderRadius;
    const maxWidth = safeAppearance.bubbles.maxWidth;
    const transparency = safeAppearance.bubbles.transparency;
    
    let style: React.CSSProperties = {
      borderRadius: radius,
      maxWidth: `${maxWidth}%`,
    };

    // Shadow
    if (safeAppearance.bubbles.shadowEnabled) {
      const shadowIntensity = {
        none: 'none',
        soft: '0 1px 3px rgba(0,0,0,0.1)',
        medium: '0 4px 6px rgba(0,0,0,0.15)',
        strong: '0 10px 15px rgba(0,0,0,0.2)',
      };
      style.boxShadow = shadowIntensity[safeAppearance.bubbles.shadowIntensity];
    }

    // Bubble style type
    switch (safeAppearance.bubbles.style) {
      case 'modern':
        style.boxShadow = style.boxShadow || '0 1px 2px rgba(0,0,0,0.05)';
        break;
      case 'classic':
        style.border = '2px solid currentColor';
        break;
      case 'minimal':
        style.border = '1px solid rgba(255,255,255,0.1)';
        break;
      case 'neon':
        style.boxShadow = '0 0 10px rgba(255,255,255,0.3), 0 0 20px rgba(255,255,255,0.1)';
        break;
      case 'elegant':
        style.border = '1px solid rgba(255,255,255,0.2)';
        style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
        break;
      case 'dark':
        // For dark style, slightly reduce background opacity
        break;
    }

    // Colors based on message type - apply transparency ONLY to background
    if (isNarrator) {
      style.backgroundColor = hexToRgba(safeAppearance.bubbles.narratorBubbleColor, transparency);
      style.color = safeAppearance.bubbles.narratorBubbleTextColor;
    } else if (isUser) {
      style.backgroundColor = hexToRgba(safeAppearance.bubbles.userBubbleColor, transparency);
      style.color = safeAppearance.bubbles.userBubbleTextColor;
    } else {
      style.backgroundColor = hexToRgba(safeAppearance.bubbles.characterBubbleColor, transparency);
      style.color = safeAppearance.bubbles.characterBubbleTextColor;
    }

    return { className: base, style };
  };

  // ============================================
  // FONT STYLES FROM APPEARANCE SETTINGS
  // ============================================
  const fontSizeMap = { xs: 'text-xs', sm: 'text-sm', base: 'text-base', lg: 'text-lg', xl: 'text-xl' };
  const fontWeightMap = { normal: 'font-normal', medium: 'font-medium', semibold: 'font-semibold', bold: 'font-bold' };
  const lineHeightMap = { tight: 'leading-tight', normal: 'leading-normal', relaxed: 'leading-relaxed', loose: 'leading-loose' };
  const letterSpacingMap = { tighter: 'tracking-tighter', tight: 'tracking-tight', normal: 'tracking-normal', wide: 'tracking-wide', wider: 'tracking-wider' };
  
  const getFontFamily = () => {
    switch (safeAppearance.font.fontFamily) {
      case 'system': return 'font-sans';
      case 'serif': return 'font-serif';
      case 'sans': return 'font-sans';
      case 'mono': return 'font-mono';
      case 'custom': return safeAppearance.font.customFontFamily || 'font-sans';
      default: return 'font-sans';
    }
  };

  const fontClasses = cn(
    getFontFamily(),
    fontSizeMap[safeAppearance.font.fontSize],
    fontWeightMap[safeAppearance.font.fontWeight],
    lineHeightMap[safeAppearance.font.lineHeight],
    letterSpacingMap[safeAppearance.font.letterSpacing]
  );

  // Avatar border and gradient colors
  const avatarBorder = isNarrator
    ? safeAppearance.avatars.borderColor || 'border-violet-400/50'
    : isUser
      ? safeAppearance.avatars.borderColor || 'border-blue-500'
      : safeAppearance.avatars.borderColor || 'border-amber-500';
  const avatarGradient = isNarrator
    ? 'from-violet-300 to-violet-500'
    : isUser
      ? 'from-blue-400 to-blue-600'
      : 'from-amber-400 to-orange-600';

  // Message spacing
  const spacingClasses = {
    compact: 'py-1 px-1',
    normal: 'py-3 px-4',
    spacious: 'py-4 px-6'
  };

  // Entry animation
  const getEntryAnimation = () => {
    if (!safeAppearance.animateEntry) return '';
    switch (safeAppearance.entryAnimation) {
      case 'fade': return 'animate-in fade-in-0 duration-200';
      case 'slide': return 'animate-in fade-in-0 slide-in-from-bottom-2 duration-200';
      case 'scale': return 'animate-in fade-in-0 zoom-in-95 duration-200';
      default: return 'animate-in fade-in-0 slide-in-from-bottom-2 duration-200';
    }
  };

  // Full mode: simpler layout, no bubbles
  if (isFull) {
    return (
      <Fragment>
        <div className={cn(
          'group py-2 px-4',
          getEntryAnimation(),
          isUser && 'bg-primary/5',
          isNarrator && 'bg-violet-500/5'
        )}
        style={{ animationDuration: `${safeAppearance.animationDurationMs}ms` }}
        >
          <div className="flex items-center gap-2 mb-1">
            {isNarrator && <Ghost className="w-3.5 h-3.5 text-violet-400" />}
            <span className={cn(
              'font-medium text-sm',
              isNarrator && 'text-violet-400/80'
            )}>{displayName}</span>
            {showTimestamp && (
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
              </span>
            )}
            {showTokens && message.metadata?.tokens && (
              <span className="text-xs text-muted-foreground/70">
                • {message.metadata.tokens} tokens
              </span>
            )}
          </div>
          
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[80px] text-sm"
                autoFocus
              />
              <div className="flex gap-1">
                <Button size="sm" type="button" onClick={handleSaveEdit}>
                  <CheckIcon className="h-3 w-3 mr-1" />
                  {t('common.save')}
                </Button>
                <Button size="sm" type="button" variant="ghost" onClick={handleCancelEdit}>
                  <X className="h-3 w-3 mr-1" />
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <TextFormatter 
              content={message.content} 
              isUser={isUser}
              className={cn('text-sm leading-relaxed', fontClasses)}
              appearance={safeAppearance}
            />
          )}
          
          <div className={cn(
            'flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity'
          )}>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            </Button>
            {!isUser && (
              <>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={() => setShowPromptDialog(true)}
                  title={t('message.viewPrompt')}
                >
                  <Eye className="h-3 w-3" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={handleStartEdit}
                  title={t('message.edit')}
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={handleReplay}
                  title={t('message.replay')}
                >
                  <Play className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onSpeak}>
                  <Volume2 className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRegenerate}>
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {/* Prompt Viewer Dialog for full mode */}
        <PromptViewerDialog
          open={showPromptDialog}
          onOpenChange={setShowPromptDialog}
          sections={message.metadata?.promptData || []}
        />
      </Fragment>
    );
  }

  // Get bubble styles
  const bubbleStyle = getBubbleStyle();

  return (
    <div
      className={cn(
        'group flex gap-3',
        getEntryAnimation(),
        spacingClasses[safeAppearance.messageSpacing],
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
      style={{ animationDuration: `${safeAppearance.animationDurationMs}ms` }}
    >
      {/* Avatar */}
      {safeAppearance.avatars.show && (
        <div className="flex-shrink-0 self-start">
          <div 
            className={cn(
              'overflow-hidden flex items-center justify-center',
              isCompact ? 'w-8 h-8' : avatarSize,
              getAvatarRadius()
            )}
            style={{
              borderWidth: safeAppearance.avatars.showBorder ? safeAppearance.avatars.borderWidth : 0,
              borderColor: safeAppearance.avatars.borderColor,
              borderStyle: 'solid',
            }}
          >
            {displayAvatar ? (
              <img 
                src={displayAvatar} 
                alt={displayName} 
                className="w-full h-full object-cover" 
              />
            ) : (
              <div 
                className={cn(
                  'w-full h-full flex items-center justify-center bg-gradient-to-br',
                  avatarGradient
                )}
              >
                <span className="text-white font-bold text-sm">
                  {displayName?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Message Content */}
      <div className={cn(
        'flex-1',
        isUser ? 'items-end' : 'items-start',
        'flex flex-col'
      )}
      style={{ maxWidth: `${safeAppearance.bubbles.maxWidth}%` }}
      >
        {/* Name and Timestamp - Above the bubble */}
        <div className={cn(
          'flex items-center gap-2 mb-1',
          isUser ? 'flex-row-reverse' : 'flex-row'
        )}>
          {isNarrator && !isUser && <Ghost className="w-3.5 h-3.5 text-violet-400" />}
          <span 
            className={cn(
              'font-medium',
              isCompact ? 'text-xs' : 'text-sm',
              isNarrator && 'text-violet-400/80'
            )}
            style={{ 
              color: isNarrator 
                ? safeAppearance.textColors.narratorMessage 
                : isUser 
                  ? safeAppearance.textColors.userMessage 
                  : safeAppearance.textColors.characterMessage 
            }}
          >
            {displayName}
          </span>
          {showTimestamp && !isCompact && (
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
            </span>
          )}
          {showTokens && !isCompact && message.metadata?.tokens && (
            <span className="text-xs text-muted-foreground/70">
              • {message.metadata.tokens} tokens
            </span>
          )}
        </div>

        {/* Message Bubble */}
        <div 
          className={cn(
            bubbleStyle.className,
            isCompact ? 'px-3 py-2' : 'px-4 py-3',
            isNarrator && 'italic'
          )}
          style={{
            ...bubbleStyle.style,
            borderTopLeftRadius: isUser ? bubbleStyle.style.borderRadius : 4,
            borderTopRightRadius: isUser ? 4 : bubbleStyle.style.borderRadius,
          }}
        >
          {isEditing ? (
            <div className="space-y-2 min-w-[200px]">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[80px] text-sm bg-background/50"
                autoFocus
              />
              <div className="flex gap-1">
                <Button size="sm" type="button" className="h-6 text-xs" onClick={handleSaveEdit}>
                  <CheckIcon className="h-3 w-3 mr-1" />
                  {t('common.save')}
                </Button>
                <Button size="sm" type="button" variant="ghost" className="h-6 text-xs" onClick={handleCancelEdit}>
                  <X className="h-3 w-3 mr-1" />
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <TextFormatter 
              content={message.content} 
              isUser={isUser}
              className={cn(
                'text-sm leading-relaxed',
                isCompact && 'text-xs',
                fontClasses
              )}
              appearance={safeAppearance}
            />
          )}

          {/* Swipe Indicators */}
          {!isUser && !isCompact && !isEditing && (
            <div className="absolute -left-8 top-1/2 -translate-y-1/2 flex flex-col gap-1">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 transition-opacity",
                  hasAlternatives && currentIndex > 0 
                    ? "opacity-0 group-hover:opacity-100" 
                    : "opacity-0 cursor-default"
                )}
                onClick={() => onSwipe?.('left')}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className={cn(
                "text-xs text-center transition-opacity",
                hasAlternatives ? "text-muted-foreground" : "opacity-0"
              )}>
                {currentIndex + 1}/{totalAlternatives}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6 transition-opacity",
                  "opacity-0 group-hover:opacity-100"
                )}
                onClick={() => {
                  // If at last swipe, generate new alternative
                  if (currentIndex === totalAlternatives - 1) {
                    onRegenerate?.();
                  } else {
                    onSwipe?.('right');
                  }
                }}
                title={currentIndex === totalAlternatives - 1 ? t('message.swipe.generate') : t('message.swipe.next')}
              >
                {currentIndex === totalAlternatives - 1 ? (
                  <RefreshCw className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {!isCompact && !isEditing && (
          <div className={cn(
            'flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity',
            isUser ? 'justify-end' : 'justify-start'
          )}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            {!isUser && (
              <>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7"
                  onClick={() => setShowPromptDialog(true)}
                  title={t('message.viewPrompt')}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleStartEdit}
                  title={t('message.edit')}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleReplay}
                  title={t('message.replay')}
                >
                  <Play className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onSpeak}
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onRegenerate}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
      {/* Prompt Viewer Dialog for bubble mode */}
      <PromptViewerDialog
        open={showPromptDialog}
        onOpenChange={setShowPromptDialog}
        sections={message.metadata?.promptData || []}
      />
    </div>
  );
});
