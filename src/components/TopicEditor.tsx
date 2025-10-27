import React, { useState } from 'react';
import { useSetTopic } from '../hooks/useSetTopic';

interface TopicEditorProps {
  channelName: string;
}

const TopicEditor: React.FC<TopicEditorProps> = ({ channelName }) => {
  const [topic, setTopicInput] = useState('');
  const { setTopic, loading, error, success } = useSetTopic();

  const handleClick = async () => {
    if (!topic.trim()) return;
    await setTopic(`#${channelName}`, topic);
  };

  return (
    <div className="space-y-2 mt-2">
      <label className="block text-sm font-medium text-gray-300 mb-1">Topic IRC (visibile in Textual e client IRC)</label>
      <textarea
        className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
        rows={2}
        value={topic}
        onChange={e => setTopicInput(e.target.value)}
        placeholder="Imposta il topic del canale IRC..."
      />
      <div className="flex items-center space-x-2">
        <button type="button" onClick={handleClick} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded" disabled={loading}>
          {loading ? 'Salvataggio...' : 'Aggiorna Topic'}
        </button>
        {success && <span className="text-green-400 text-sm">Topic aggiornato!</span>}
        {error && <span className="text-red-400 text-sm">{error}</span>}
      </div>
    </div>
  );
};

export default TopicEditor;
