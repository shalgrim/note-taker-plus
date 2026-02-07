import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '../hooks/useStore';
import { healthApi } from '../services/api';

export default function SettingsPage() {
  const { apiKey, setApiKey, showHints, setShowHints } = useStore();
  const [inputKey, setInputKey] = useState(apiKey || '');

  // Check service health
  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['health-services'],
    queryFn: healthApi.services,
    enabled: !!apiKey,
    refetchInterval: 30000,
  });

  const handleSaveKey = () => {
    setApiKey(inputKey || null);
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      {/* API Key Section */}
      <section className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">API Configuration</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300 mb-2">
              API Key
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                id="apiKey"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="Enter your API key"
                className="flex-1 bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSaveKey}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
              >
                Save
              </button>
            </div>
            <p className="text-sm text-gray-400 mt-2">
              Your API key is stored locally and used to authenticate with the backend.
            </p>
          </div>
        </div>
      </section>

      {/* Service Status Section */}
      {apiKey && (
        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Service Status</h2>
          {healthLoading ? (
            <p className="text-gray-400">Checking services...</p>
          ) : health ? (
            <div className="space-y-3">
              <ServiceStatus
                name="Ollama (Local LLM)"
                ok={health.ollama.ok}
                message={health.ollama.message}
              />
              <ServiceStatus
                name="Raindrop.io"
                ok={health.raindrop.ok}
                message={health.raindrop.message}
              />
            </div>
          ) : (
            <p className="text-red-400">Could not connect to backend. Check your API key.</p>
          )}
        </section>
      )}

      {/* Preferences Section */}
      <section className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Preferences</h2>
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={showHints}
              onChange={(e) => setShowHints(e.target.checked)}
              className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-300">Show hints during quiz (when available)</span>
          </label>
        </div>
      </section>

      {/* Instructions Section */}
      <section className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Getting Started</h2>
        <div className="prose prose-invert text-gray-300">
          <ol className="list-decimal list-inside space-y-2">
            <li>Set your API key above (from your backend .env file)</li>
            <li>Make sure Ollama is running: <code className="bg-gray-700 px-2 py-1 rounded">ollama serve</code></li>
            <li>Pull a model: <code className="bg-gray-700 px-2 py-1 rounded">ollama pull llama3.2</code></li>
            <li>Configure your Raindrop.io token in the backend .env file</li>
            <li>Start capturing knowledge!</li>
          </ol>
        </div>
      </section>
    </div>
  );
}

function ServiceStatus({ name, ok, message }: { name: string; ok: boolean; message: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`text-lg ${ok ? 'text-green-500' : 'text-red-500'}`}>
        {ok ? '✓' : '✗'}
      </span>
      <div>
        <p className="text-white font-medium">{name}</p>
        <p className="text-sm text-gray-400">{message}</p>
      </div>
    </div>
  );
}
