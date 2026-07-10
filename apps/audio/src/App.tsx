/** Audio Converter App */

import { DropZone, Footer, Header, MobileWarning, BrandMark } from "@junkyardsh/kit";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioStore } from "./store";
import type { AudioFile } from "./store";
import { FORMATS, QUALITY_PRESETS, SAMPLE_RATES, CHANNEL_MODES, isAudioFile, type QualityPreset } from "./lib/formats";
import { loadFFmpeg, convertAudio } from "./lib/ffmpeg";
import "./styles.css";

function App() {
  const {
    files,
    format,
    quality,
    customBitrate,
    sampleRate,
    channelMode,
    addFiles,
    removeFile,
    clearAll,
    updateFile,
    setFormat,
    setQuality,
    setCustomBitrate,
    setSampleRate,
    setChannelMode,
  } = useAudioStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const processingRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await loadFFmpeg();
        if (mounted) setFfmpegLoaded(true);
      } catch (err) {
        console.error("[audio] FFmpeg load failed:", err);
        if (mounted) setError("Failed to load audio converter engine. Please refresh the page.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleFiles = useCallback(
    async (acceptedFiles: File[]) => {
      if (processingRef.current) return;

      const audioFiles = acceptedFiles.filter(isAudioFile);
      if (audioFiles.length === 0) {
        setError("No valid audio files detected.");
        return;
      }

      addFiles(audioFiles);
      setError(null);

      if (!ffmpegLoaded) {
        setError("Audio converter engine is still loading. Please wait...");
        return;
      }

      processingRef.current = true;
      setIsProcessing(true);

      try {
        const ffmpeg = await loadFFmpeg();

        for (const file of audioFiles) {
          const id = nextIdForFile(file);
          updateFile(id, { status: "processing", progressPct: 0 });

          const formatDef = FORMATS[format];
          let bitrate: number | null = null;

          if (quality !== "custom" && formatDef.defaultBitrate) {
            bitrate = Math.round(formatDef.defaultBitrate * (QUALITY_PRESETS[quality].multiplier || 1));
          } else if (quality === "custom") {
            bitrate = customBitrate;
          }

          const sampleRateNum = sampleRate === "original" ? null : (sampleRate as number);
          const mono = channelMode === "mono";

          const outputBlob = await convertAudio(
            ffmpeg,
            file,
            file.name,
            formatDef.ext,
            bitrate,
            sampleRateNum || "original",
            mono
          );

          const outputUrl = URL.createObjectURL(outputBlob);
          const outputName = file.name.replace(/\.[^.]+$/, "") + "." + formatDef.ext;

          updateFile(id, {
            status: "done",
            progressPct: 100,
            outputUrl,
            outputName,
            outputSize: outputBlob.size,
          });
        }
      } catch (err) {
        console.error("[audio] Conversion failed:", err);
        setError(err instanceof Error ? err.message : "Conversion failed");
        for (const file of audioFiles) {
          const id = nextIdForFile(file);
          updateFile(id, { status: "error", errorMsg: "Conversion failed" });
        }
      } finally {
        processingRef.current = false;
        setIsProcessing(false);
      }
    },
    [format, quality, customBitrate, sampleRate, channelMode, ffmpegLoaded, addFiles, updateFile]
  );

  function nextIdForFile(file: File): string {
    return files.find((f) => f.file === file)?.id || "";
  }

  const handleRemove = useCallback((id: string) => {
    removeFile(id);
  }, [removeFile]);

  const handleClearAll = useCallback(() => {
    clearAll();
    setError(null);
  }, [clearAll]);

  const handleDownload = useCallback((file: AudioFile) => {
    if (!file.outputUrl || !file.outputName) return;
    const a = document.createElement("a");
    a.href = file.outputUrl;
    a.download = file.outputName;
    a.click();
  }, []);

  const formatDef = FORMATS[format];

  return (
    <div className="audio-app">
      <Header
        title="Audio Converter"
        subtitle="Convert between MP3, WAV, FLAC, M4A, OGG, OPUS, AIFF"
        brandMark={
          <BrandMark>
            <rect x="2" y="2" width="28" height="28" rx="4" fill="#2f9d8d" />
            <path d="M10 16a4 4 0 0 1 8 0v4" stroke="white" strokeWidth="2" fill="none" />
          </BrandMark>
        }
      />

      <main>
        <MobileWarning />

        {!ffmpegLoaded && (
          <div className="loading-state">
            <p>Loading audio converter engine...</p>
          </div>
        )}

        {ffmpegLoaded && (
          <>
            <div className="controls">
              <div className="control-group">
                <label>Output Format</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as typeof format)}
                  disabled={isProcessing}
                >
                  {(Object.keys(FORMATS) as Array<keyof typeof FORMATS>).map((f) => (
                    <option key={f} value={f}>
                      {FORMATS[f].label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="control-group">
                <label>Quality</label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value as QualityPreset)}
                  disabled={isProcessing || !formatDef.bitrateRange}
                >
                  {(Object.keys(QUALITY_PRESETS) as Array<keyof typeof QUALITY_PRESETS>).map((q) => (
                    <option key={q} value={q}>
                      {QUALITY_PRESETS[q].label}
                    </option>
                  ))}
                </select>
              </div>

              {quality === "custom" && formatDef.bitrateRange && (
                <div className="control-group">
                  <label>Bitrate: {customBitrate} kbps</label>
                  <input
                    type="range"
                    min={formatDef.bitrateRange[0]}
                    max={formatDef.bitrateRange[1]}
                    value={customBitrate}
                    onChange={(e) => setCustomBitrate(Number(e.target.value))}
                    disabled={isProcessing}
                  />
                </div>
              )}

              <div className="control-group">
                <label>Sample Rate</label>
                <select
                  value={sampleRate}
                  onChange={(e) => setSampleRate(e.target.value as typeof sampleRate)}
                  disabled={isProcessing}
                >
                  {SAMPLE_RATES.map((sr) => (
                    <option key={typeof sr === "number" ? String(sr) : sr} value={sr}>
                      {typeof sr === "number" ? `${sr / 1000} kHz` : sr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="control-group">
                <label>Channels</label>
                <select
                  value={channelMode}
                  onChange={(e) => setChannelMode(e.target.value as typeof channelMode)}
                  disabled={isProcessing}
                >
                  {CHANNEL_MODES.map((cm) => (
                    <option key={cm} value={cm}>
                      {cm === "stereo" ? "Stereo" : "Mono"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <DropZone
              accept=".mp3,.wav,.flac,.m4a,.ogg,.opus,.aiff,.aac,.wma,.mp4a,.m2a"
              onFiles={handleFiles}
              label="Drop audio files here"
              disabled={isProcessing || !ffmpegLoaded}
              multiple
            />

            {error && <div className="error-message">{error}</div>}

            {files.length > 0 && (
              <div className="file-list">
                <h2>Files ({files.length})</h2>
                <button onClick={handleClearAll} disabled={isProcessing}>Clear All</button>
                {files.map((file) => (
                  <div key={file.id} className={`file-item ${file.status}`}>
                    <div className="file-info">
                      <span className="file-name">{file.file.name}</span>
                      <span className="file-size">{(file.file.size / 1024).toFixed(1)} KB</span>
                    </div>
                    {file.status === "processing" && (
                      <div className="progress-bar">
                        <div className="progress" style={{ width: `${file.progressPct || 0}%` }} />
                      </div>
                    )}
                    {file.status === "done" && file.outputName && (
                      <button onClick={() => handleDownload(file)}>Download {file.outputName}</button>
                    )}
                    {file.status === "error" && <span className="error">{file.errorMsg}</span>}
                    <button onClick={() => handleRemove(file.id)} disabled={file.status === "processing"}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default App;