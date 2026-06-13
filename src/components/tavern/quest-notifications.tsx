'use client';

/**
 * QuestNotifications Component
 * 
 * Displays floating notifications for quest events:
 * - Quest activated
 * - Objective completed
 * - Quest completed
 * - Quest failed
 * - Quest updated
 * - Rewards earned
 * 
 * Features:
 * - Animated slide-in/out notifications
 * - Auto-dismiss after configurable timeout (from questSettings)
 * - Click to dismiss
 * - Stack multiple notifications
 * - Priority-based coloring
 * - Duplicate counter: merged notifications show count badge
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useTavernStore } from '@/store';
import type { QuestNotification } from '@/types';
import { cn } from '@/lib/utils';
import { 
  Gift, 
  X, 
  AlertTriangle,
  Sparkles,
  Star,
  Check,
  RefreshCw,
  Layers,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface NotificationItemProps {
  notification: QuestNotification;
  onDismiss: (id: string) => void;
  autoDismissMs: number;
}

// ============================================
// Notification Icons by Type
// ============================================

const notificationIcons: Record<QuestNotification['type'], React.ReactNode> = {
  quest_activated: <Sparkles className="w-5 h-5 text-amber-400" />,
  objective_complete: <Check className="w-5 h-5 text-green-400" />,
  quest_complete: <Star className="w-5 h-5 text-amber-400" />,
  quest_failed: <AlertTriangle className="w-5 h-5 text-red-400" />,
  quest_updated: <RefreshCw className="w-5 h-5 text-cyan-400" />,
  reward_claimed: <Gift className="w-5 h-5 text-purple-400" />,
};

// ============================================
// Notification Colors by Type
// ============================================

const notificationColors: Record<QuestNotification['type'], { bg: string; border: string; text: string }> = {
  quest_activated: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/40',
    text: 'text-amber-400',
  },
  objective_complete: {
    bg: 'bg-green-500/20',
    border: 'border-green-500/40',
    text: 'text-green-400',
  },
  quest_complete: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/40',
    text: 'text-amber-400',
  },
  quest_failed: {
    bg: 'bg-red-500/20',
    border: 'border-red-500/40',
    text: 'text-red-400',
  },
  quest_updated: {
    bg: 'bg-cyan-500/20',
    border: 'border-cyan-500/40',
    text: 'text-cyan-400',
  },
  reward_claimed: {
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/40',
    text: 'text-purple-400',
  },
};

// ============================================
// Badge Labels
// ============================================

const badgeLabels: Record<QuestNotification['type'], string> = {
  quest_activated: 'Nueva',
  objective_complete: 'Progreso',
  quest_complete: 'Completada',
  quest_failed: 'Fallida',
  quest_updated: 'Actualizada',
  reward_claimed: 'Recompensa',
};

const badgeColors: Record<QuestNotification['type'], string> = {
  quest_activated: 'bg-amber-500/30 text-amber-300',
  objective_complete: 'bg-green-500/30 text-green-300',
  quest_complete: 'bg-amber-500/30 text-amber-300',
  quest_failed: 'bg-red-500/30 text-red-300',
  quest_updated: 'bg-cyan-500/30 text-cyan-300',
  reward_claimed: 'bg-purple-500/30 text-purple-300',
};

// ============================================
// Main Component
// ============================================

export function QuestNotifications() {
  const questSettings = useTavernStore((state) => state.questSettings);
  const questNotifications = useTavernStore((state) => state.questNotifications);
  const markNotificationRead = useTavernStore((state) => state.markNotificationRead);
  const dismissedIdsRef = useRef<Set<string>>(new Set());
  
  // Get configurable auto-dismiss time (default 5000ms)
  const autoDismissMs = questSettings.notificationAutoDismissMs ?? 5000;

  // Auto-dismiss notifications
  useEffect(() => {
    if (!questSettings.showNotifications) return;
    
    const unreadNotifications = questNotifications.filter(n => !n.read);
    
    // Auto-mark as read after configurable timeout
    const timers = unreadNotifications.map(notification => {
      // If this notification has duplicates, extend the auto-dismiss time
      const dupCount = notification.duplicateCount ?? 0;
      const extendedMs = autoDismissMs + (dupCount * 2000); // +2s per duplicate
      return setTimeout(() => {
        markNotificationRead(notification.id);
        dismissedIdsRef.current.delete(notification.id);
      }, extendedMs);
    });
    
    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [questNotifications, questSettings.showNotifications, markNotificationRead, autoDismissMs]);
  
  // Don't render if notifications are disabled
  if (!questSettings.showNotifications) {
    return null;
  }
  
  // Only show unread notifications
  const visibleNotifications = questNotifications.filter(n => !n.read).slice(0, 5);
  
  if (visibleNotifications.length === 0) {
    return null;
  }
  
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {visibleNotifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onDismiss={markNotificationRead}
          autoDismissMs={autoDismissMs}
        />
      ))}
    </div>
  );
}

// ============================================
// Notification Item Component
// ============================================

function NotificationItem({ notification, onDismiss, autoDismissMs }: NotificationItemProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  
  const colors = notificationColors[notification.type] || notificationColors.quest_activated;
  const icon = notificationIcons[notification.type] || notificationIcons.quest_activated;
  const duplicateCount = notification.duplicateCount ?? 0;

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, []);
  
  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(notification.id);
    }, 300);
  }, [notification.id, onDismiss]);
  
  return (
    <div
      className={cn(
        'pointer-events-auto',
        'flex items-start gap-3 p-3 rounded-lg border backdrop-blur-md',
        'min-w-[280px] max-w-[350px]',
        'shadow-xl shadow-black/20',
        'transition-all duration-300',
        'bg-gradient-to-br from-slate-900/95 to-slate-800/90',
        colors.border,
        isVisible && !isExiting
          ? 'translate-x-0 opacity-100'
          : 'translate-x-full opacity-0',
        // Pulse effect when there are duplicates
        duplicateCount > 0 && 'animate-[pulse_0.5s_ease-in-out]'
      )}
      key={`${notification.id}-d${duplicateCount}`}
    >
      {/* Icon */}
      <div className={cn(
        'flex items-center justify-center w-10 h-10 rounded-lg shrink-0 relative',
        colors.bg
      )}>
        {icon}
        {/* Duplicate count badge */}
        {duplicateCount > 0 && (
          <span className={cn(
            'absolute -top-1.5 -right-1.5',
            'flex items-center justify-center',
            'min-w-[18px] h-[18px] px-1',
            'rounded-full text-[9px] font-bold',
            'bg-orange-500 text-white',
            'shadow-sm shadow-orange-500/50',
            'animate-[bounce-in_0.3s_ease-out]'
          )}>
            {duplicateCount + 1}
          </span>
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0 py-0.5">
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-medium', colors.text)}>
            {notification.questName || 'Misión'}
          </span>
          <NotificationBadge type={notification.type} />
        </div>
        <p className="text-sm text-white/80 mt-1 line-clamp-2">
          {notification.message}
        </p>
        {notification.rewards && notification.rewards.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5">
            <Gift className="w-3 h-3 text-purple-400" />
            <span className="text-[10px] text-purple-400">
              +{notification.rewards.length} recompensa{notification.rewards.length > 1 ? 's' : ''}
            </span>
          </div>
        )}
        {/* Duplicate info line */}
        {duplicateCount > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <Layers className="w-3 h-3 text-orange-400/60" />
            <span className="text-[10px] text-orange-400/60">
              {duplicateCount + 1} notificaciones similares agrupadas
            </span>
          </div>
        )}
      </div>
      
      {/* Dismiss Button */}
      <button
        onClick={handleDismiss}
        className="shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
      >
        <X className="w-4 h-4 text-white/40 hover:text-white/60" />
      </button>
    </div>
  );
}

// ============================================
// Notification Badge Component
// ============================================

function NotificationBadge({ type }: { type: QuestNotification['type'] }) {
  return (
    <span className={cn(
      'text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium',
      badgeColors[type] || badgeColors.quest_activated
    )}>
      {badgeLabels[type] || type}
    </span>
  );
}

// ============================================
// Hook for Programmatic Notifications
// ============================================

export function useQuestNotifications() {
  const addQuestNotification = useTavernStore((state) => state.addQuestNotification);
  
  const notifyQuestStarted = useCallback((questName: string, questId: string) => {
    addQuestNotification({
      questId,
      questName,
      type: 'quest_activated',
      message: `Nueva misión disponible: ${questName}`,
    });
  }, [addQuestNotification]);
  
  const notifyObjectiveComplete = useCallback((
    questName: string, 
    questId: string, 
    objectiveDescription: string,
    objectiveId?: string,
  ) => {
    addQuestNotification({
      questId,
      questName,
      type: 'objective_complete',
      message: `Objetivo completado: ${objectiveDescription}`,
      objectiveId,
    } as any);
  }, [addQuestNotification]);
  
  const notifyQuestCompleted = useCallback((
    questName: string, 
    questId: string,
    rewards?: QuestNotification['rewards']
  ) => {
    addQuestNotification({
      questId,
      questName,
      type: 'quest_complete',
      message: `¡Misión completada: ${questName}!`,
      rewards,
    });
  }, [addQuestNotification]);
  
  const notifyQuestFailed = useCallback((questName: string, questId: string) => {
    addQuestNotification({
      questId,
      questName,
      type: 'quest_failed',
      message: `Misión fallida: ${questName}`,
    });
  }, [addQuestNotification]);
  
  const notifyQuestUpdated = useCallback((questName: string, questId: string, message: string) => {
    addQuestNotification({
      questId,
      questName,
      type: 'quest_updated',
      message,
    });
  }, [addQuestNotification]);
  
  const notifyReward = useCallback((
    questName: string, 
    questId: string, 
    rewardMessage: string,
    rewards?: QuestNotification['rewards']
  ) => {
    addQuestNotification({
      questId,
      questName,
      type: 'reward_claimed',
      message: rewardMessage,
      rewards,
    });
  }, [addQuestNotification]);
  
  return {
    notifyQuestStarted,
    notifyObjectiveComplete,
    notifyQuestCompleted,
    notifyQuestFailed,
    notifyQuestUpdated,
    notifyReward,
  };
}

export default QuestNotifications;
