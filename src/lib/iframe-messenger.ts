export interface IframeMessage {
  type: 'IFRAME_READY' | 'AUTH_STATUS' | 'USER_ACTION' | 'HEIGHT_CHANGE' | 'NAVIGATION';
  payload?: unknown;
  source: 'ircapp' | 'portfolio';
  timestamp: number;
}

export class IframeMessenger {
  private allowedOrigins: string[];
  private messageHandlers: Map<string, (payload: unknown) => void>;

  constructor(allowedOrigins: string[] = ['https://www.webrooster.it', 'https://webrooster.it']) {
    this.allowedOrigins = allowedOrigins;
    this.messageHandlers = new Map();
    this.setupListener();
  }

  private setupListener() {
    if (typeof window === 'undefined') return;

    window.addEventListener('message', (event) => {
      // Verifica origine
      if (!this.allowedOrigins.includes(event.origin)) {
        console.warn('[IframeMessenger] Message from untrusted origin:', event.origin);
        return;
      }

      try {
        const message = event.data as IframeMessage;
        if (message.source === 'portfolio') {
          const handler = this.messageHandlers.get(message.type);
          if (handler) {
            handler(message.payload);
          }
        }
      } catch (error) {
        console.error('[IframeMessenger] Error processing message:', error);
      }
    });
  }

  public sendToParent(type: IframeMessage['type'], payload?: unknown) {
    if (typeof window === 'undefined' || !window.parent) return;

    const message: IframeMessage = {
      type,
      payload,
      source: 'ircapp',
      timestamp: Date.now(),
    };

    // Invia a tutti gli origin permessi
    this.allowedOrigins.forEach(origin => {
      window.parent.postMessage(message, origin);
    });
  }

  public on(type: string, handler: (payload: unknown) => void) {
    this.messageHandlers.set(type, handler);
  }

  public off(type: string) {
    this.messageHandlers.delete(type);
  }

  public isInIframe(): boolean {
    if (typeof window === 'undefined') return false;
    return window.self !== window.top;
  }
}

// Singleton instance
let messengerInstance: IframeMessenger | null = null;

export function getIframeMessenger(): IframeMessenger {
  if (!messengerInstance) {
    messengerInstance = new IframeMessenger();
  }
  return messengerInstance;
}
