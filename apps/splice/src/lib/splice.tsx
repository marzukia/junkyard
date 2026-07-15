/**
 * SplicePanel component for multi-video upload and reordering
 */

import { useCallback, useEffect, useRef } from "react";

export interface Clip {
	file: File;
	url: string;
	duration: number;
	size: number;
	id: string;
}

// Max clips to prevent browser memory exhaustion
const MAX_CLIPS = 20;

export function SplicePanel({
	clips,
	setClips,
	onSplice,
	processing,
	setError,
}: {
	clips: Clip[];
	setClips: React.Dispatch<React.SetStateAction<Clip[]>>;
	onSplice: () => void;
	processing: boolean;
	setError: (msg: string) => void;
}) {
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFileSelect = useCallback(
		(files: FileList) => {
			// Check if we've hit the clip limit
			if (clips.length >= MAX_CLIPS) {
				setError?.(`Maximum ${MAX_CLIPS} clips reached`);
				return;
			}

			const newClips: Clip[] = [];
			for (let i = 0; i < files.length; i++) {
				const file = files[i];
				if (!file.type.startsWith("video/")) continue;

				// Skip if adding this clip would exceed the limit
				if (clips.length + newClips.length >= MAX_CLIPS) {
					break;
				}

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
					const video = document.createElement("video");
					video.preload = "metadata";
					video.onloadedmetadata = () => {
						clip.duration = video.duration;
						video.src = ""; // Release media resource
						resolve();
					};
					video.onerror = () => {
						clip.duration = 0;
						video.src = ""; // Release media resource
						resolve();
					};
					video.src = clip.url;
					// Timeout after 5s if metadata never loads
					setTimeout(() => {
						if (video.readyState === 0) {
							clip.duration = 0;
							video.src = ""; // Release media resource
							resolve();
						}
					}, 5000);
				});
			});

			Promise.all(promises).then(() => {
				setClips((prev) => [...prev, ...newClips]);
			});
		},
		[clips.length, setClips, setError],
	);

	const removeClip = useCallback(
		(id: string) => {
			setClips((prev) => {
				const clip = prev.find((c) => c.id === id);
				if (clip) {
					URL.revokeObjectURL(clip.url);
				}
				return prev.filter((c) => c.id !== id);
			});
		},
		[setClips],
	);

	const moveClip = useCallback(
		(fromIndex: number, toIndex: number) => {
			setClips((prev) => {
				const newClips = [...prev];
				const [moved] = newClips.splice(fromIndex, 1);
				newClips.splice(toIndex, 0, moved);
				return newClips;
			});
		},
		[setClips],
	);

	const totalDuration = clips.reduce((sum, c) => sum + c.duration, 0);

	useEffect(() => {
		return () => {
			// Only revoke URLs that haven't been revoked already
			for (const clip of clips) {
				try {
					URL.revokeObjectURL(clip.url);
				} catch {
					// URL already revoked - ignore
				}
			}
		};
	}, [clips]);

	return (
		<div className="splice-panel">
			<div className="splice-upload-section">
				<label
					htmlFor="splice-file-input"
					className="splice-drop-zone"
					onDrop={(e) => {
						e.preventDefault();
						const files = e.dataTransfer.files;
						if (files.length > 0) {
							handleFileSelect(files);
						}
					}}
					onDragOver={(e) => e.preventDefault()}
					onClick={() => fileInputRef.current?.click()}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							fileInputRef.current?.click();
						}
					}}
				>
					<span>Drop multiple videos here or click to select</span>
				</label>
				<input
					id="splice-file-input"
					ref={fileInputRef}
					type="file"
					accept="video/*"
					multiple
					onChange={(e) => {
						// iOS Safari fix: read files from DOM node after a microtask
						// to ensure the native picker has populated the file list
						const input = e.currentTarget;
						requestAnimationFrame(() => {
							if (input.files && input.files.length > 0) {
								handleFileSelect(input.files);
							}
							// Reset input value to allow re-selecting the same files
							input.value = "";
						});
					}}
					style={{
						position: "absolute",
						opacity: 0,
						width: "1px",
						height: "1px",
						padding: 0,
						margin: "-1px",
						overflow: "hidden",
						clip: "rect(0, 0, 0, 0)",
						border: 0,
					}}
				/>
			</div>

			{clips.length > 0 && (
				<div className="splice-clip-list">
					<div className="splice-clip-header">
						<span>
							{clips.length} clip{clips.length !== 1 ? "s" : ""}
						</span>
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
									aria-label={`Preview of ${clip.file.name}`}
								>
									<track kind="captions" />
								</video>
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
										onClick={() =>
											moveClip(index, Math.min(clips.length - 1, index + 1))
										}
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
					{processing
						? "Splicing..."
						: `Splice ${clips.length} Clip${clips.length !== 1 ? "s" : ""}`}
				</button>
				{clips.length < 2 && (
					<span className="splice-hint">Add at least 2 clips to splice</span>
				)}
			</div>
		</div>
	);
}

function formatDuration(seconds: number): string {
	if (!seconds || Number.isNaN(seconds)) return "0:00";
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
