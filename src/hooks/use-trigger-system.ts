'use client';

import { useRef, useCallback } from 'react';
import { useTriggerStore } from '@/store/trigger-store';
import { useTavernStore } from '@/store/tavern-store';
import { TriggerScanner } from '@/lib/trigger-scanner';
import { playSoundEffect } from '@/lib/audio-bus';
import type { MessageScanResult, TriggerSystemSettings } from '@/types/triggers';
import { DEFAULT_TRIGGER_SETTINGS } from '@/types/triggers';

// Singleton scanner instance
let triggerScanner: TriggerScanner | null = null;

export function useTriggerSystem() {
  const {
    settings,
    sfxTriggers,
    backgroundTriggers,
    backgroundPacks,
    spriteTriggers,
    spritePacks,
    emotionTriggers,
  } = useTriggerStore();

  const { setActiveBackground } = useTavernStore();
  const lastProcessedMessage = useRef<string>('');
  const streamingBuffer = useRef<string>('');

  // Initialize scanner with current triggers
  const getScanner = useCallback(() => {
    if (!triggerScanner) {
      triggerScanner = new TriggerScanner(settings as TriggerSystemSettings);
    }
    
    // Update scanner configuration
    triggerScanner.updateSettings(settings as TriggerSystemSettings);
    triggerScanner.setSFXTriggers(sfxTriggers);
    triggerScanner.setBackgroundTriggers(backgroundTriggers);
    triggerScanner.setBackgroundPacks(backgroundPacks);
    triggerScanner.setSpriteTriggers(spriteTriggers);
    triggerScanner.setSpritePacks(spritePacks);
    triggerScanner.setEmotionTriggers(emotionTriggers);
    
    return triggerScanner;
  }, [settings, sfxTriggers, backgroundTriggers, backgroundPacks, spriteTriggers, spritePacks, emotionTriggers]);

  /**
   * Process a complete message for triggers
   */
  const processMessage = useCallback((message: string): MessageScanResult => {
    if (!settings.enabled || message === lastProcessedMessage.current) {
      return {
        sfxTriggers: [],
        backgroundTriggers: [],
        spriteTriggers: [],
        emotionTriggers: [],
        detectedKeywords: [],
        detectedEmotions: [],
      };
    }

    lastProcessedMessage.current = message;
    const scanner = getScanner();
    return scanner.scanMessage(message);
  }, [settings.enabled, getScanner]);

  /**
   * Execute triggers from scan result
   */
  const executeTriggers = useCallback(async (result: MessageScanResult) => {
    // Play SFX triggers
    for (const trigger of result.sfxTriggers) {
      try {
        await playSoundEffect(trigger.src, trigger.volume * settings.globalVolume);
        console.log(`[Trigger] SFX: ${trigger.title}`);
      } catch (error) {
        console.error('[Trigger] SFX error:', error);
      }
    }

    // Change background
    for (const trigger of result.backgroundTriggers) {
      if ('backgroundName' in trigger) {
        // Simple background trigger
        const bgPath = `/backgrounds/${trigger.backgroundName}`;
        setActiveBackground(bgPath);
        console.log(`[Trigger] Background: ${trigger.backgroundName}`);
      } else if ('items' in trigger && trigger.items.length > 0) {
        // Background pack
        const item = trigger.items[0];
        if (item?.backgroundLabel) {
          const bgPath = `/backgrounds/${item.backgroundLabel}`;
          setActiveBackground(bgPath);
          console.log(`[Trigger] Background Pack: ${item.backgroundLabel}`);
        }
      }
    }

    // Play emotion sounds
    for (const trigger of result.emotionTriggers) {
      try {
        await playSoundEffect(trigger.src, trigger.volume * settings.globalVolume);
        console.log(`[Trigger] Emotion: ${trigger.title}`);
      } catch (error) {
        console.error('[Trigger] Emotion error:', error);
      }
    }
  }, [settings.globalVolume, setActiveBackground]);

  /**
   * Reset streaming buffer for new message
   */
  const resetStreaming = useCallback(() => {
    streamingBuffer.current = '';
    lastProcessedMessage.current = '';
  }, []);

  return {
    processMessage,
    executeTriggers,
    resetStreaming,
    isEnabled: settings.enabled,
  };
}

// ============ Hook for chat integration ============

export function useChatTriggers() {
  const { processMessage, executeTriggers, resetStreaming, isEnabled } = useTriggerSystem();

  /**
   * Process a complete message when it's received
   */
  const onMessageComplete = useCallback(async (message: string) => {
    if (!isEnabled) return;

    const result = processMessage(message);
    await executeTriggers(result);
  }, [isEnabled, processMessage, executeTriggers]);

  /**
   * Process streaming chunks for realtime triggers
   */
  const onStreamingChunk = useCallback((fullMessage: string) => {
    if (!isEnabled) return;

    const result = processMessage(fullMessage);
    // For streaming, only execute SFX triggers (not backgrounds to avoid flicker)
    result.sfxTriggers.forEach(async (trigger) => {
      try {
        await playSoundEffect(trigger.src, trigger.volume);
      } catch (error) {
        console.error('[Trigger] Streaming SFX error:', error);
      }
    });
  }, [isEnabled, processMessage]);

  return {
    onMessageComplete,
    onStreamingChunk,
    resetStreaming,
  };
}
