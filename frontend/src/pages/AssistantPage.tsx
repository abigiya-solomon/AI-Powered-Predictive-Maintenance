import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  User,
  Sparkles,
  Info,
  Terminal,
  Activity,
  Layers,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Code2
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { maintenanceService } from '../services/maintenanceService';
import { GeminiContextPayload, AssistantChatResponse } from '../types';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isSimulated?: boolean;
}

const SUGGESTED_QUESTIONS = [
  'Which sensors contributed to the latest anomaly?',
  'What changed before this alert occurred?',
  'Explain the pressure gradient trend in simple terms.',
  'What should a depot maintenance technician inspect next?',
  'How confident should I be in this alert?',
];

export const AssistantPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [telemetryPayload, setTelemetryPayload] = useState<GeminiContextPayload | null>(null);
  const [showJsonPayload, setShowJsonPayload] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAssistantContext();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadAssistantContext = async () => {
    try {
      const res = await maintenanceService.getAssistantContext();
      if (res && res.payload) {
        setTelemetryPayload(res.payload);
        // Initial welcome message
        setMessages([
          {
            id: 'init-1',
            sender: 'assistant',
            text: `Hello. I am the MetroPT-3 Rolling Stock Compressor Health Assistant.
I have synchronized with the latest scored telemetry for record timestamp **${res.payload.timestamp}**.

- **Subsystem State:** ${res.payload.operating_context.compressor_pumping ? 'PUMPING (Motor Active)' : 'IDLE / UNLOADED'}
- **Model Score:** ${res.payload.model_metadata.score?.toFixed(4)} (Threshold: ${res.payload.model_metadata.threshold?.toFixed(4)})
- **Anomaly Flag:** ${res.payload.model_metadata.anomaly_detected ? 'ACTIVE ANOMALY' : 'NORMAL'}

How can I assist your depot inspection or telemetry diagnosis?`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize assistant context.');
    }
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const promptToSend = customPrompt || inputText;
    if (!promptToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text: promptToSend,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInputText('');
    setLoading(true);
    setError(null);

    try {
      const response: AssistantChatResponse = await maintenanceService.sendAssistantMessage(
        telemetryPayload || undefined,
        promptToSend
      );

      const replyText =
        response.data?.reply ||
        response.data?.simulated_response ||
        'No analysis response returned.';

      const assistantMsg: ChatMessage = {
        id: 'msg-assist-' + Date.now(),
        sender: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString(),
        isSimulated: !response.data?.configured,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setError(`Assistant error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-steel-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="w-6 h-6 text-cyanAccent-400" />
            <h1 className="text-2xl font-bold text-steel-100 tracking-tight">
              AI Maintenance Assistant (Gemini 3.8 Flash)
            </h1>
          </div>
          <p className="text-sm text-steel-400 mt-1">
            Technical conversational reasoning interface for depot engineers, grounded strictly in
            pneumatic physical telemetry and trained One-Class SVM anomaly metrics.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowJsonPayload(!showJsonPayload)}
          className="font-mono text-xs"
        >
          <Code2 className="w-4 h-4 mr-1.5 text-cyanAccent-400" />
          {showJsonPayload ? 'Hide Telemetry JSON' : 'Inspect Gemini 3.8 Payload JSON'}
        </Button>
      </div>

      {error && (
        <Alert type="warning" title="Assistant Notice">
          {error}
        </Alert>
      )}

      {/* Main Grid: Chat UI + Context Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat Conversation Column */}
        <div className="lg:col-span-2 flex flex-col h-[650px] bg-industrial-900 border border-steel-800 rounded-xl overflow-hidden shadow-xl">
          {/* Chat Header */}
          <div className="p-3.5 bg-industrial-950 border-b border-steel-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyanAccent-400 animate-pulse" />
              <span className="text-xs font-mono font-bold text-steel-200">
                Rolling Stock Diagnostic Agent
              </span>
            </div>
            <span className="text-[11px] font-mono text-steel-400">
              Model: gemini-3.8-flash / Rule Engine
            </span>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m) => {
              const isUser = m.sender === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-mono ${
                      isUser
                        ? 'bg-cyanAccent-500 text-industrial-950 font-bold'
                        : 'bg-industrial-800 border border-steel-700 text-cyanAccent-400'
                    }`}
                  >
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div
                    className={`max-w-[85%] rounded-xl p-4 text-xs leading-relaxed space-y-2 font-sans ${
                      isUser
                        ? 'bg-cyan-950/70 border border-cyan-800/80 text-steel-100'
                        : 'bg-industrial-950 border border-steel-800 text-steel-200'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-steel-400 font-mono mb-1">
                      <span>{isUser ? 'Technician' : 'Predictive Maintenance Agent'}</span>
                      <span>{m.timestamp}</span>
                    </div>

                    <div className="whitespace-pre-wrap">{m.text}</div>

                    {!isUser && m.isSimulated && (
                      <div className="pt-2 mt-2 border-t border-steel-800/60 text-[10px] text-amber-400/90 font-mono flex items-center gap-1.5">
                        <Info className="w-3 h-3" />
                        Grounded rule engine output (Gemini API key not configured on ML service)
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-3 text-steel-400 text-xs font-mono p-2">
                <LoadingSpinner size="sm" />
                <span>Formulating telemetry interpretation...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="p-3 bg-industrial-950/60 border-t border-steel-800/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <span className="text-[10px] font-mono text-steel-500 uppercase flex-shrink-0 mr-1">
              Suggestions:
            </span>
            {SUGGESTED_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q)}
                disabled={loading}
                className="px-2.5 py-1 rounded-full bg-industrial-800 hover:bg-industrial-700 text-steel-300 border border-steel-700 text-[11px] whitespace-nowrap transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="p-3 bg-industrial-950 border-t border-steel-800 flex items-center gap-2">
            <input
              type="text"
              placeholder="Ask about compressor sensor dynamics, pressure decay, or inspection protocols..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage();
              }}
              disabled={loading}
              className="flex-1 bg-industrial-900 border border-steel-700 rounded-lg px-3.5 py-2 text-xs text-steel-100 placeholder-steel-500 focus:outline-none focus:border-cyanAccent-500 font-sans"
            />
            <Button
              variant="primary"
              size="md"
              onClick={() => handleSendMessage()}
              disabled={loading || !inputText.trim()}
              className="font-mono text-xs px-4"
            >
              <Send className="w-3.5 h-3.5 mr-1" /> Send
            </Button>
          </div>
        </div>

        {/* Telemetry Context Sidebar */}
        <div className="space-y-4">
          <Card title="Telemetry Context Feed" subtitle="Telemetry snapshot bound to this assistant session">
            {telemetryPayload ? (
              <div className="space-y-3 text-xs font-mono">
                <div className="p-2.5 bg-industrial-950 rounded-lg border border-steel-800">
                  <span className="text-[10px] text-steel-400 uppercase block">Timestamp</span>
                  <span className="text-steel-100 font-bold">{telemetryPayload.timestamp}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-industrial-950 rounded border border-steel-800">
                    <span className="text-[10px] text-steel-400 block">Reservoir</span>
                    <span className="text-cyanAccent-400 font-bold">
                      {telemetryPayload.sensor_telemetry.Reservoir_pressure?.toFixed(2)} bar
                    </span>
                  </div>
                  <div className="p-2 bg-industrial-950 rounded border border-steel-800">
                    <span className="text-[10px] text-steel-400 block">Outlet (TP2)</span>
                    <span className="text-amber-400 font-bold">
                      {telemetryPayload.sensor_telemetry.TP2_compressor_pressure?.toFixed(2)} bar
                    </span>
                  </div>
                  <div className="p-2 bg-industrial-950 rounded border border-steel-800">
                    <span className="text-[10px] text-steel-400 block">Motor Current</span>
                    <span className="text-emerald-400 font-bold">
                      {telemetryPayload.sensor_telemetry.Motor_current?.toFixed(2)} A
                    </span>
                  </div>
                  <div className="p-2 bg-industrial-950 rounded border border-steel-800">
                    <span className="text-[10px] text-steel-400 block">Oil Temp</span>
                    <span className="text-steel-100 font-bold">
                      {telemetryPayload.sensor_telemetry.Oil_temperature?.toFixed(1)} °C
                    </span>
                  </div>
                </div>

                <div className="p-2.5 bg-industrial-950 rounded-lg border border-steel-800 space-y-1">
                  <span className="text-[10px] text-steel-400 uppercase block">Model Metric</span>
                  <div className="flex items-center justify-between">
                    <span className="text-steel-300">Anomaly Score:</span>
                    <span className="font-bold text-rose-400">
                      {telemetryPayload.model_metadata.score?.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-steel-300">Threshold:</span>
                    <span className="text-steel-400">
                      {telemetryPayload.model_metadata.threshold?.toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-steel-400">Loading active telemetry...</p>
            )}
          </Card>

          {/* Actionable Protocol Card */}
          <Card title="Technician Protocols">
            <ul className="text-xs text-steel-300 space-y-2 list-disc list-inside">
              <li>Inspect pneumatic couplings for acoustic whistling leaks.</li>
              <li>Verify purge solenoid valve seat for unsealed exhaust.</li>
              <li>Cross-reference telemetry timestamps with driver logs.</li>
            </ul>
          </Card>
        </div>
      </div>

      {/* JSON Payload Inspector Modal / Section */}
      {showJsonPayload && telemetryPayload && (
        <Card
          title="Downstream Gemini 3.8 Flash Payload Schema (Structured JSON)"
          subtitle="Exact payload structure supplied to the Gemini 3.8 Flash API endpoint"
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(telemetryPayload, null, 2));
              }}
              className="text-xs font-mono"
            >
              Copy JSON
            </Button>
          }
        >
          <pre className="p-4 bg-industrial-950 border border-steel-800 rounded-lg text-xs font-mono text-cyanAccent-300 overflow-x-auto max-h-80">
            {JSON.stringify(telemetryPayload, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
};
