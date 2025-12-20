'use client';

import { useState, useEffect } from 'react';

interface Document {
  id: string;
  filename: string;
  uploadDate: string;
  chunks: number;
  avgValidation: number;
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return (
        <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
    case 'docx':
    case 'doc':
      return (
        <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
    case 'txt':
      return (
        <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
    case 'md':
      return (
        <svg className="w-8 h-8 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
    default:
      return (
        <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
  }
}

export default function KBManager({ onLoadComplete }: { onLoadComplete?: () => void }) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>('');

  // Get session ID on mount
  useEffect(() => {
    import('@/lib/session').then(({ getOrCreateSessionId }) => {
      const sid = getOrCreateSessionId();
      setSessionId(sid);
    });
  }, []);

  async function loadDocuments() {
    if (!sessionId) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/kb', {
        headers: {
          'x-session-id': sessionId,
        },
      });
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
      // Call the callback when loading is complete
      if (onLoadComplete) {
        onLoadComplete();
      }
    }
  }

  async function deleteDocument(filename: string) {
    if (!confirm(`Delete ${filename}?`)) return;
    if (!sessionId) return;
    
    setDeleting(filename);
    try {
      const response = await fetch('/api/kb', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
        },
        body: JSON.stringify({ filename })
      });
      
      if (response.ok) {
        setDocuments(docs => docs.filter(d => d.filename !== filename));
      }
    } catch (error) {
      console.error('Failed to delete document:', error);
    } finally {
      setDeleting(null);
    }
  }

  useEffect(() => {
    if (sessionId) {
      loadDocuments();
    }
  }, [sessionId]);

  if (loading && documents.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        Loading documents...
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-xs text-gray-400">
        No documents yet. Upload docs to K-Base using the upload button above.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map(doc => (
        <div
          key={doc.id}
          className="group flex items-start gap-3 p-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg border border-gray-700/50 transition-all duration-200 cursor-pointer"
        >
          {/* File Icon */}
          <div className="flex-shrink-0 mt-0.5">
            {getFileIcon(doc.filename)}
          </div>
          
          {/* File Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {doc.filename}
            </p>
            <div className="flex items-center justify-between mt-1 flex-wrap">
              <span className="text-[10px] text-gray-400 whitespace-nowrap">
                {new Date(doc.uploadDate).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
              <span
                className={`text-[10px] whitespace-nowrap ${
                  doc.avgValidation >= 0.9
                    ? 'text-green-400'
                    : doc.avgValidation >= 0.7
                    ? 'text-yellow-400'
                    : 'text-red-400'
                }`}
              >
                {doc.avgValidation >= 0.9 ? 'High Relevance' : doc.avgValidation >= 0.7 ? 'Acceptable Relevance' : 'Low Relevance'}
              </span>
            </div>
          </div>
          
          {/* Delete Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteDocument(doc.filename);
            }}
            disabled={deleting === doc.filename}
            className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-all disabled:opacity-50"
            title="Delete"
          >
            {deleting === doc.filename ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}
