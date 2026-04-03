'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useTavernStore } from '@/store/tavern-store';

/**
 * This component applies settings from the Zustand store to the application.
 * It syncs the theme with next-themes and applies other visual settings.
 * Add this component once at the root level of your app.
 */
export function SettingsApplier() {
  const { setTheme, theme: currentTheme } = useTheme();
  const { settings } = useTavernStore();

  // Sync theme from store with next-themes
  useEffect(() => {
    if (settings.theme && settings.theme !== currentTheme) {
      setTheme(settings.theme);
    }
  }, [settings.theme, setTheme, currentTheme]);

  // Apply font size as CSS variable and class
  useEffect(() => {
    const root = document.documentElement;
    
    // Set CSS variable for font size
    root.style.setProperty('--app-font-size', `${settings.fontSize}px`);
    
    // Set a data attribute for potential CSS targeting
    root.setAttribute('data-font-size', settings.fontSize.toString());
    
    // Apply font size class to body
    document.body.style.fontSize = `${settings.fontSize}px`;
    
    return () => {
      root.style.removeProperty('--app-font-size');
      root.removeAttribute('data-font-size');
      document.body.style.fontSize = '';
    };
  }, [settings.fontSize]);

  // Apply message display mode as data attribute
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-message-display', settings.messageDisplay);
    
    return () => {
      root.removeAttribute('data-message-display');
    };
  }, [settings.messageDisplay]);

  return null; // This component doesn't render anything
}
