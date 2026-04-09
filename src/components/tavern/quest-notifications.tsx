'use client';

/**
 * QuestNotifications Component
 * 
 * Displays floating notifications for quest events:
 * - Quest activated
 * - Objective completed
 * - Quest completed
 * - Quest failed
 * - Rewards earned
 * 
 * Features:
 * - Animated slide-in/out notifications
 * - Auto-dismiss after configurable timeout
 * - Click to dismiss
 * - Stack multiple notifications
 * - Priority-based coloring
 */

import { useEffect, useState, useCallback } from 'react';
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
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface NotificationItemProps {
  notification: QuestNotification;
  onDismiss: (id: string) => void;
}

// ============================================
// Notification Icons by Type
// ============================================

const notificationIcons: Record<QuestNotification['type'], React.ReactNode> = {
  quest_activated: <Sparkles className="w-5 h-5 text-amber-400" />,
  objective_complete: <Check className="w-5 h-5 text-green-400" />,
  quest_complete: <Star className="w-5 h-5 text-amber-400" />,
  quest_failed: <AlertTriangle className="w-5 h-5 text-red-400" />,
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
  reward_claimed: 'Recompensa',
};

const badgeColors: Record<QuestNotification['type'], string> = {
  quest_activated: 'bg-amber-500/30 text-amber-300',
  objective_complete: 'bg-green-500/30 text-green-300',
  quest_complete: 'bg-amber-500/30 text-amber-300',
  quest_failed: 'bg-red-500/30 text-red-300',
  reward_claimed: 'bg-purple-500/30 text-purple-300',
};

// ============================================
// Main Component
// ============================================

export function QuestNotifications() {
  const questSettings = useTavernStore((state) => state.questSettings);
  const questNotifications = useTavernStore((state) => state.questNotifications);
  const markNotificationRead = useTavernStore((state) => state.markNotificationRead);
  
  // Auto-dismiss notifications
  useEffect(() => {
    if (!questSettings.showNotifications) return;
    
    const unreadNotifications = questNotifications.filter(n => !n.read);
    
    // Auto-mark as read after 5 seconds
    const timers = unreadNotifications.map(notification => {
      return setTimeout(() => {
        markNotificationRead(notification.id);
      }, 5000);
    });
    
    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [questNotifications, questSettings.showNotifications, markNotificationRead]);
  
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
        />
      ))}
    </div>
  );
}

// ============================================
// Notification Item Component
// ============================================

function NotificationItem({ notification, onDismiss }: NotificationItemProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  
  const colors = notificationColors[notification.type] || notificationColors.quest_activated;
  const icon = notificationIcons[notification.type] || notificationIcons.quest_activated;
  
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
          : 'translate-x-full opacity-0'
      )}
    >
      {/* Icon */}
      <div className={cn(
        'flex items-center justify-center w-10 h-10 rounded-lg shrink-0',
        colors.bg
      )}>
        {icon}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0 py-0.5">
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-medium', colors.text)}>
            {notification.questName}
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
    objectiveDescription: string
  ) => {
    addQuestNotification({
      questId,
      questName,
      type: 'objective_complete',
      message: `Objetivo completado: ${objectiveDescription}`,
    });
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
    notifyReward,
  };
}

export default QuestNotifications;
