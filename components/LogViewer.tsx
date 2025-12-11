import React, { useEffect, useRef } from 'react';
import { ProcessingLog } from '../types';

interface LogViewerProps {
  logs: ProcessingLog[];
}

export const LogViewer: React.FC<LogViewerProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (logs.length === 0) return null;

  return (
    <div className="bg-slate-900 text-slate-300 p-4 rounded-lg font-mono text-sm h-48 overflow-y-auto border border-slate-700 shadow-inner">
      <div className="flex items-center gap-2 mb-2 text-slate-400 border-b border-slate-700 pb-2">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
        <span className="text-xs uppercase tracking-wider font-semibold">Workflow Agent Logs</span>
      </div>
      <ul className="space-y-1">
        {logs.map((log, idx) => (
          <li key={idx} className="flex gap-2">
            <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
            <span className={`${
              log.type === 'success' ? 'text-green-400' : 
              log.type === 'action' ? 'text-blue-400' : 'text-slate-300'
            }`}>
              {log.type === 'action' && '> '}
              {log.message}
            </span>
          </li>
        ))}
        <div ref={bottomRef} />
      </ul>
    </div>
  );
};