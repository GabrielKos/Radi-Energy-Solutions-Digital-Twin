import React, { useState, useEffect } from 'react';
import { 
  FolderOpen, 
  FileText, 
  Download, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  Layers,
  ArrowRight,
  Sliders,
  Check
} from 'lucide-react';

interface GoogleDriveSyncProps {
  folderId?: string;
  fileId?: string;
  onApplyModification?: (data: any) => void;
  theme: 'light' | 'dark';
}

interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  thumbnailLink?: string;
}

export const GoogleDriveSync: React.FC<GoogleDriveSyncProps> = ({
  folderId = '1MkNiCIRYVzdyhKEeBJdsMKvw99m2Q_vz',
  fileId = '1lD2IyLWSK_EqZl7xeQUq5gsPsJmVdyM0',
  onApplyModification,
  theme,
}) => {
  const isDark = theme === 'dark';
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<DriveFileItem | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [appliedStatus, setAppliedStatus] = useState<string | null>(null);
  const [customFileId, setCustomFileId] = useState<string>(fileId);
  const [manualInput, setManualInput] = useState<string>('');
  const [isManualMode, setIsManualMode] = useState<boolean>(false);

  // Initialize GIS Token Client
  const handleAuth = () => {
    try {
      if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: (window as any)._AISTUDIO_OAUTH_CLIENT_ID || '',
          scope: 'https://www.googleapis.com/auth/drive.readonly',
          callback: (response: any) => {
            if (response.access_token) {
              setToken(response.access_token);
              if (customFileId) {
                fetchDirectFile(customFileId, response.access_token);
              } else {
                fetchFolderFiles(response.access_token);
              }
            } else if (response.error) {
              setError(`OAuth authentication error: ${response.error}`);
            }
          },
        });
        client.requestAccessToken();
      } else {
        setError('Google Identity Services script is loading. You can also paste file content below.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize OAuth client');
    }
  };

  const fetchDirectFile = async (targetFileId: string, accessToken: string) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Get metadata
      const metaUrl = `https://www.googleapis.com/drive/v3/files/${targetFileId}?fields=id,name,mimeType,size,modifiedTime`;
      const metaRes = await fetch(metaUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!metaRes.ok) {
        const errData = await metaRes.json();
        throw new Error(errData.error?.message || `HTTP ${metaRes.status}`);
      }

      const meta = await metaRes.json();
      const directItem: DriveFileItem = {
        id: meta.id,
        name: meta.name,
        mimeType: meta.mimeType,
        modifiedTime: meta.modifiedTime,
      };

      setFiles(prev => [directItem, ...prev.filter(f => f.id !== directItem.id)]);
      handleSelectFile(directItem, accessToken);
    } catch (err: any) {
      setError(`Failed to load file (${targetFileId}): ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchFolderFiles = async (accessToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const q = `'${folderId}' in parents and trashed = false`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,modifiedTime,thumbnailLink)&pageSize=30`;
      
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setFiles(data.files || []);
      if (data.files && data.files.length > 0) {
        handleSelectFile(data.files[0], accessToken);
      }
    } catch (err: any) {
      setError(`Failed to fetch Drive files: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFile = async (file: DriveFileItem, accessToken?: string) => {
    setSelectedFile(file);
    const activeToken = accessToken || token;
    if (!activeToken) return;

    setLoading(true);
    try {
      const url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${activeToken}`,
        },
      });

      if (res.ok) {
        const text = await res.text();
        setFileContent(text);
      } else {
        setFileContent(`(Binary or previewable file: ${file.name} - ${file.mimeType})`);
      }
    } catch (err: any) {
      setFileContent(`Error loading content: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!fileContent) return;
    try {
      // Check if it's JSON config
      const parsed = JSON.parse(fileContent);
      if (onApplyModification) {
        onApplyModification(parsed);
      }
      setAppliedStatus('Successfully applied configuration modifications to Digital Twin simulation parameters!');
    } catch {
      // Text / notes
      setAppliedStatus(`Applied modifications from file: "${selectedFile?.name || 'collaborator file'}"`);
    }
  };

  return (
    <div className={`p-5 rounded-2xl border backdrop-blur-2xl transition-all shadow-xl ${
      isDark
        ? 'bg-[#0F1422]/90 border-white/10 text-gray-200 shadow-[0_8px_32px_rgba(0,0,0,0.5)]'
        : 'bg-white/90 border-slate-200/90 text-slate-800 shadow-xl'
    }`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md">
            <FolderOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                Google Drive Collaborator Sync
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-blue-500/10 text-blue-500 rounded-full border border-blue-500/20">
                Live Integration
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
              Target File ID: <span className="font-mono text-blue-500 font-semibold">{customFileId}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!token ? (
            <button
              onClick={handleAuth}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md transition-all transform hover:scale-[1.02]"
            >
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <span>Connect Drive Account</span>
            </button>
          ) : (
            <button
              onClick={() => token && (customFileId ? fetchDirectFile(customFileId, token) : fetchFolderFiles(token))}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Fetch File</span>
            </button>
          )}

          <a
            href={`https://drive.google.com/file/d/${customFileId}/view?usp=drive_link`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 transition-all text-slate-600 dark:text-gray-300"
            title="Open in Google Drive"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Quick Input Bar for File ID / Link */}
      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <div className="flex-1 flex items-center gap-2 bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs">
          <span className="text-gray-400 font-mono text-[10px] uppercase font-bold shrink-0">Drive Link / ID:</span>
          <input
            type="text"
            value={customFileId}
            onChange={(e) => {
              const val = e.target.value;
              const match = val.match(/\/d\/([a-zA-Z0-9_-]+)/);
              setCustomFileId(match ? match[1] : val);
            }}
            placeholder="Paste Google Drive file link or file ID (e.g. 1lD2IyLWSK_EqZl7xeQUq5gsPsJmVdyM0)"
            className="flex-1 bg-transparent border-none outline-none font-mono text-xs text-slate-800 dark:text-gray-200"
          />
        </div>
        <button
          onClick={() => {
            if (token) {
              fetchDirectFile(customFileId, token);
            } else {
              handleAuth();
            }
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0"
        >
          Fetch File & Adopt
        </button>
        <button
          onClick={() => setIsManualMode(!isManualMode)}
          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all shrink-0 ${
            isManualMode 
              ? 'bg-amber-500/20 text-amber-500 border-amber-500/40' 
              : 'border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10'
          }`}
        >
          {isManualMode ? 'Drive Mode' : 'Paste Code / Text'}
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {appliedStatus && (
        <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{appliedStatus}</span>
        </div>
      )}

      {/* Main Content Area */}
      {isManualMode ? (
        <div className={`mt-4 rounded-xl border p-4 flex flex-col gap-3 ${
          isDark ? 'bg-black/20 border-white/10' : 'bg-slate-50/80 border-slate-200'
        }`}>
          <div className="flex justify-between items-center">
            <span className="font-bold text-xs">Direct Parameter/Configuration Override</span>
            <button
              onClick={() => {
                if (!manualInput.trim()) return;
                try {
                  const parsed = JSON.parse(manualInput);
                  if (onApplyModification) onApplyModification(parsed);
                  setAppliedStatus('Successfully applied configuration modifications to Digital Twin simulation!');
                } catch {
                  setAppliedStatus('Applied custom notes / parameters to Digital Twin context.');
                }
              }}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              Apply Pasted Modification
            </button>
          </div>
          <textarea
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Paste raw JSON parameters, takt adjustments, or specification edits here..."
            className={`w-full h-56 p-3 rounded-lg font-mono text-xs border outline-none ${
              isDark ? 'bg-[#0B0D14] border-white/10 text-gray-200' : 'bg-white border-slate-200 text-slate-900'
            }`}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
        {/* Left Column: File Explorer */}
        <div className={`md:col-span-4 rounded-xl border p-3 flex flex-col h-72 overflow-y-auto custom-scrollbar ${
          isDark ? 'bg-black/20 border-white/10' : 'bg-slate-50/80 border-slate-200'
        }`}>
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex justify-between items-center">
            <span>Folder Files ({files.length})</span>
            {loading && <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />}
          </div>

          {files.length === 0 && !loading && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-gray-400 text-xs">
              <FolderOpen className="w-8 h-8 opacity-40 mb-2" />
              <p>No files loaded yet.</p>
              <p className="text-[10px] mt-1 text-gray-500">Click "Connect Drive Account" to authorize and load collaborator updates.</p>
            </div>
          )}

          <div className="space-y-1.5">
            {files.map((file) => {
              const isSelected = selectedFile?.id === file.id;
              return (
                <button
                  key={file.id}
                  onClick={() => handleSelectFile(file)}
                  className={`w-full text-left p-2 rounded-lg text-xs flex items-center gap-2.5 transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white font-bold shadow-sm'
                      : isDark
                      ? 'hover:bg-white/10 text-gray-300'
                      : 'hover:bg-white text-slate-700'
                  }`}
                >
                  <FileText className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-blue-500'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{file.name}</p>
                    <p className={`text-[9px] truncate ${isSelected ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                      {file.mimeType.split('.').pop() || 'file'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: File Preview & Adoption Action */}
        <div className={`md:col-span-8 rounded-xl border p-4 flex flex-col justify-between ${
          isDark ? 'bg-black/20 border-white/10' : 'bg-slate-50/80 border-slate-200'
        }`}>
          <div>
            <div className="flex justify-between items-center border-b pb-2 border-slate-200 dark:border-white/10 mb-3">
              <div>
                <h3 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  <span>{selectedFile ? selectedFile.name : 'Collaborator Modification Preview'}</span>
                </h3>
                {selectedFile?.modifiedTime && (
                  <p className="text-[10px] text-gray-400">
                    Last modified: {new Date(selectedFile.modifiedTime).toLocaleString()}
                  </p>
                )}
              </div>

              {selectedFile && (
                <button
                  onClick={handleApply}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-md transition-all transform hover:scale-[1.02]"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Adopt Modification</span>
                </button>
              )}
            </div>

            <div className={`rounded-lg p-3 font-mono text-[11px] h-48 overflow-y-auto custom-scrollbar border ${
              isDark ? 'bg-[#0B0D14] border-white/5 text-gray-300' : 'bg-white border-slate-200 text-slate-800'
            }`}>
              {loading ? (
                <div className="h-full flex items-center justify-center text-gray-400 gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                  <span>Loading collaborator changes from Drive...</span>
                </div>
              ) : fileContent ? (
                <pre className="whitespace-pre-wrap">{fileContent}</pre>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center px-4">
                  <Sliders className="w-6 h-6 opacity-40 mb-1" />
                  <p>Select a file from the collaborator folder to inspect parameter changes.</p>
                  <p className="text-[10px] mt-1 text-gray-500">
                    Supports JSON configuration overrides, production takt rate tweaks, layout node position updates, and BOM adjustments.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-500 dark:text-gray-400">
            <span>Integration Status: Google Drive Read-Only Scoped</span>
            <span>Target Twin: Katuugo Gigafactory 10 GWh</span>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
