
import React, { useState, useEffect } from 'react';

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseNotes: string;
  releaseUrl: string;
}

const UpdateBanner: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [status, setStatus] = useState<'idle' | 'available' | 'downloading' | 'ready'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkUpdate();
  }, []);

  const checkUpdate = async () => {
    try {
      const apiBase = (import.meta.env.VITE_API_BASE as string) || '';
      const resp = await fetch(`${apiBase}/api/check-update`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.updateAvailable) {
          setUpdateInfo(data);
          setStatus('available');
        }
      }
    } catch (err) {
      console.warn('Update check failed', err);
    }
  };

  const startDownload = async () => {
    setStatus('downloading');
    setProgress(0);
    setError(null);

    try {
      const apiBase = (import.meta.env.VITE_API_BASE as string) || '';
      
      // Start download (non-blocking)
      const downloadResp = await fetch(`${apiBase}/api/download-update`, { method: 'POST' });
      if (!downloadResp.ok) throw new Error(await downloadResp.text());

      // Poll progress
      const pollId = setInterval(async () => {
        try {
          const progResp = await fetch(`${apiBase}/api/download-progress`);
          if (progResp.ok) {
            const { progress } = await progResp.json();
            
            if (progress === -1) {
              setError('Ошибка при загрузке файла');
              setStatus('available');
              clearInterval(pollId);
              return;
            }

            setProgress(progress);
            if (progress >= 100) {
              clearInterval(pollId);
              setStatus('ready');
            }
          }
        } catch (e) {
          console.warn('Polling error', e);
        }
      }, 800);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
      setStatus('available');
    }
  };

  const applyUpdate = async () => {
    try {
      const apiBase = (import.meta.env.VITE_API_BASE as string) || '';
      const resp = await fetch(`${apiBase}/api/apply-update`, { method: 'POST' });
      
      if (!resp.ok) {
        const msg = await resp.text();
        throw new Error(msg || 'Не удалось запустить обновление');
      }

      // The app will exit, UI will freeze or show "restarting"
      setStatus('idle');
      alert('Приложение перезагружается для установки обновления...');
    } catch (err) {
      alert('Ошибка при запуске обновления: ' + (err instanceof Error ? err.message : ''));
    }
  };

  if (status === 'idle') return null;

  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-xl animate-slideDown">
      <div className="max-w-7xl mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg backdrop-blur-md">
            <span className="text-xl">🚀</span>
          </div>
          <div>
            <p className="font-bold text-sm">Доступна новая версия {updateInfo?.latestVersion}!</p>
            <p className="text-[10px] text-blue-100 opacity-80">Ваша версия: {updateInfo?.currentVersion}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-1 max-w-md">
          {status === 'downloading' ? (
            <div className="w-full space-y-1">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                <span>Загрузка обновления...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden backdrop-blur-sm">
                <div 
                  className="bg-white h-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          ) : status === 'ready' ? (
            <p className="text-sm font-medium animate-pulse">Обновление скачано и готово к установке.</p>
          ) : (
            <div className="hidden md:block text-xs text-blue-100 line-clamp-1 max-w-xs opacity-70">
              {updateInfo?.releaseNotes || 'Улучшения стабильности и новые функции.'}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {status === 'available' && (
            <button
              onClick={startDownload}
              className="bg-white text-blue-700 px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-50 transition-colors shadow-sm active:scale-95"
            >
              Обновить сейчас
            </button>
          )}
          {status === 'ready' && (
            <button
              onClick={applyUpdate}
              className="bg-green-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-green-600 transition-all shadow-lg active:scale-95 animate-bounce-short"
            >
              Перезапустить
            </button>
          )}
          <button
            onClick={() => setStatus('idle')}
            className="text-white/60 hover:text-white p-1 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
      {error && (
        <div className="bg-red-500 text-[10px] text-center py-1">
          Ошибка: {error}
        </div>
      )}
    </div>
  );
};

export default UpdateBanner;
