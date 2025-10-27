import { useState } from 'react';

export function useSetTopic() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const setTopic = async (channel: string, topic: string) => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch('/api/admin/set-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, topic })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Errore generico');
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError('Errore di rete');
    } finally {
      setLoading(false);
    }
  };

  return { setTopic, loading, error, success };
}
