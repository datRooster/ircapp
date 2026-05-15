'use client';

import { useEffect } from 'react';
import { useIframeMessenger } from '@/hooks/useIframeMessenger';

export function IframeProvider({ children }: { children: React.ReactNode }) {
  const { isInIframe, sendMessage, onMessage } = useIframeMessenger();

  useEffect(() => {
    if (!isInIframe) return;

    // Listener per cambiamenti di altezza
    const observer = new ResizeObserver(() => {
      const height = document.documentElement.scrollHeight;
      sendMessage('HEIGHT_CHANGE', { height });
    });

    observer.observe(document.body);
    return () => observer.disconnect();
  }, [isInIframe, sendMessage]);

  useEffect(() => {
    if (!isInIframe) return;

    // Listener per richieste dal parent
    const cleanup = onMessage('USER_ACTION', (payload) => {
      console.log('[IframeProvider] Received action from parent:', payload);
    });

    return cleanup;
  }, [isInIframe, onMessage]);

  return <>{children}</>;
}
