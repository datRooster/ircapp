'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { getIframeMessenger, IframeMessage } from '@/lib/iframe-messenger';

export function useIframeMessenger() {
  const messenger = useRef(getIframeMessenger());
  const [isInIframe, setIsInIframe] = useState(false);

  // Calculate isInIframe only once on mount
  useEffect(() => {
    setIsInIframe(messenger.current.isInIframe());
  }, []);

  const sendMessage = useCallback((type: IframeMessage['type'], payload?: unknown) => {
    messenger.current.sendToParent(type, payload);
  }, []);

  const onMessage = useCallback((type: string, handler: (payload: unknown) => void) => {
    messenger.current.on(type, handler);
    return () => messenger.current.off(type);
  }, []);

  // Notifica il parent quando l'app è pronta
  useEffect(() => {
    if (isInIframe) {
      sendMessage('IFRAME_READY', { ready: true });
    }
  }, [isInIframe, sendMessage]);

  return {
    isInIframe,
    sendMessage,
    onMessage,
  };
}
