import React, { useEffect, useRef, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { LogEntry } from '../types';

interface LoggerProps {
  logs: LogEntry[];
}

export const Logger: React.FC<LoggerProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleCopyAll = async () => {
    const allText = logs.map(log => {
      const time = log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' });
      return `[${time}] ${log.message}`;
    }).join('\n');

    try {
      await navigator.clipboard.writeText(allText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col h-48 sm:h-64 shadow-inner">
      <div className="bg-slate-800 px-3 py-1 text-xs font-mono text-slate-400 border-b border-slate-700 flex justify-between items-center">
        <span>TERMINAL OUTPUT</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-slate-700 px-1.5 rounded">{logs.length} events</span>
          <button
            onClick={handleCopyAll}
            disabled={logs.length === 0}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-all ${
              logs.length === 0 
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                : copied 
                  ? 'bg-green-600 text-white' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
            title="Copy all terminal output"
          >
            {copied ? <Check size={10} /> : <Copy size={10} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1"
      >
        {logs.length === 0 && (
          <div className="text-slate-600 italic">Ready to sync...</div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="break-all">
            <span className="text-slate-500 mr-2">
              [{log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}]
            </span>
            <span className={`
              ${log.type === 'error' ? 'text-red-500 font-bold' : ''}
              ${log.type === 'success' ? 'text-green-500 font-bold' : ''}
              ${log.type === 'warning' ? 'text-yellow-400 font-bold' : ''}
              ${log.type === 'info' ? 'text-slate-300' : ''}
            `}>
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
