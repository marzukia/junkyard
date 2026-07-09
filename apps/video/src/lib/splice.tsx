/**
 * SplicePanel component for multi-video upload and reordering
 */

import { useCallback, useRef, useEffect } from 'react';

export interface Clip {
  file: File;
  url: string;
  duration: number;
  size: number;
  id: string;
}

export function SplicePanel({
  clips,
  setClips,
  onSplice,
  processing,
}: {
  clips: Clip[];
  setClips: React.Dispatch<React.SetStateAction<Clip[]>>;
  onSplice: () => void;
  processing: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((files: FileList) => {
    const newClips: Clip[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('video/')) continue;

      const url = URL.createObjectURL(file);
      newClips.push({
        id: `${Date.now()}_${i}_${Math.random().toString(36).slice(2)}`,
        file,
        url,
        duration: 0,
        size: file.size,
      });
    }

    // Get duration for each clip
    const promises = newClips.map((clip) => {
      return new Promise<void>((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          clip.duration = video.duration;
          resolve();
        };
        video.onerror = () => {
          clip.duration = 0;
          resolve();
        };
        video.src = clip.url;
        // Timeout after 5s if metadata never loads
        setTimeout(() => {
          if (video.readyState === 0) {
            clip.duration = 0;
            resolve();
          }
        }, 5000);
      });
    });

    Promise.all(promises).then(() => {
      setClips((prev) => [...prev, ...newClips]);
    });
  }, [setClips]);

  const removeClip = useCallback((id: string) => {
    setClips((prev) => {
      const clip = prev.find((c) => c.id === id);
      if (clip) URL.revokeObjectURL(clip.url);
      return prev.filter((c) => c.id !== id);
    });
  }, [setClips]);

  const moveClip = useCallback((fromIndex: number, toIndex: number) => {
    setClips((prev) => {
      const newClips = [...prev];
      const [moved] = newClips.splice(fromIndex, 1);
      newClips.splice(toIndex, 0, moved);
      return newClips;
    });
  }, [setClips]);

  const totalDuration = clips.reduce((sum, c) => sum + c.duration, 0);

  useEffect(() => {
    return () => {
      clips.forEach((clip) => URL.revokeObjectURL(clip.url));
    };
  }, [clips]);

  return (
    <div className="splice-panel">
      <div className="splice-upload-section">
        <label
          className="splice-drop-zone"
          onDrop={(e) => {
            e.preventDefault();
            const files = e.dataTransfer.files;
            if (files.length > 0) {
              handleFileSelect(files);
            }
          }}
          onDragOver={(e) => e.preventDefault()}
        >
          <span>Drop multiple videos here or click to select</span>
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          multiple
          onChange={(e) => {
            if (e.target.files) handleFileSelect(e.target.files);
            e.target.value = '';
          }}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className="btn-ghost-sm"
          onClick={() => fileInputRef.current?.click()}
        >
          Select Videos
        </button>
      </div>

      {clips.length > 0 && (
        <div className="splice-clip-list">
          <div className="splice-clip-header">
            <span>{clips.length} clip{clips.length !== 1 ? 's' : ''}</span>
            <span>Total: {formatDuration(totalDuration)}</span>
          </div>
          <ul className="splice-clip-items">
            {clips.map((clip, index) => (
              <li key={clip.id} className="splice-clip-item">
                <span className="splice-clip-order">{index + 1}</span>
                <video
                  src={clip.url}
                  className="splice-clip-thumbnail"
                  controls={false}
                  preload="metadata"
                />
                <div className="splice-clip-info">
                  <span className="splice-clip-name">{clip.file.name}</span>
                  <span className="splice-clip-meta">
                    {formatDuration(clip.duration)} • {formatBytes(clip.size)}
                  </span>
                </div>
                <div className="splice-clip-actions">
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => moveClip(index, Math.max(0, index - 1))}
                    disabled={index === 0}
                    aria-label={`Move ${clip.file.name} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => moveClip(index, Math.min(clips.length - 1, index + 1))}
                    disabled={index === clips.length - 1}
                    aria-label={`Move ${clip.file.name} down`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn-icon btn-icon--danger"
                    onClick={() => removeClip(clip.id)}
                    aria-label={`Remove ${clip.file.name}`}
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="splice-actions">
        <button
          type="button"
          className="btn-accent"
          onClick={onSplice}
          disabled={processing || clips.length < 2}
        >
          {processing ? 'Splicing...' : `Splice ${clips.length} Clip${clips.length !== 1 ? 's' : ''}`}
        </button>
        {clips.length < 2 && (
          <span className="splice-hint">Add at least 2 clips to splice</span>
        )}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}