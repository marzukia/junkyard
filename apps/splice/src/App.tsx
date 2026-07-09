import { BrandMark, Footer, Header, MobileWarning } from "@junkyardsh/kit";
import { useCallback, useState } from "react";
import { type Clip, SplicePanel } from "./lib/splice";

export function App() {
	const [clips, setClips] = useState<Clip[]>([]);
	const [processing, setProcessing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<{
		blob: Blob;
		name: string;
		url: string;
		size: number;
	} | null>(null);

	const handleSplice = useCallback(async () => {
		if (clips.length < 2) {
			setError("Add at least 2 clips to splice");
			return;
		}

		setError(null);
		setProcessing(true);

		try {
			// Import the splice function dynamically
			const { spliceVideos } = await import("./lib/ffmpeg");

			const clipFiles = clips.map((c) => c.file);
			const blob = await spliceVideos(
				clipFiles,
				`combined_${Date.now()}.mp4`,
				() => {
					// Progress handling
				},
			);

			const url = URL.createObjectURL(blob);
			const resultName = `spliced_${Date.now()}.mp4`;

			setResult({ blob, name: resultName, url, size: blob.size });

			// Clean up clip URLs
			clips.forEach((c) => {
				try {
					URL.revokeObjectURL(c.url);
				} catch {}
			});
			setClips([]);
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Splicing failed";
			setError(msg);
		} finally {
			setProcessing(false);
		}
	}, [clips]);

	const download = useCallback(() => {
		if (!result) return;
		const a = document.createElement("a");
		a.href = result.url;
		a.download = result.name;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}, [result]);

	const reset = useCallback(() => {
		if (result) {
			URL.revokeObjectURL(result.url);
		}
		setResult(null);
		setError(null);
	}, [result]);

	return (
		<div className="app-root">
			<Header
				title="Video Splicer"
				subtitle="Combine multiple videos in your browser"
				brandMark={
					<BrandMark>
						<rect x="2" y="2" width="28" height="28" rx="4" fill="#2f9d8d" />
					</BrandMark>
				}
			/>

			<main className="site-main">
				<MobileWarning />

				{result ? (
					<div className="card">
						<h2>Splice Complete!</h2>
						<p>
							Your combined video is{" "}
							{result.size > 0
								? `${(result.size / (1024 * 1024)).toFixed(2)} MB`
								: ""}
						</p>
						<video
							src={result.url}
							controls
							className="video-preview"
							style={{ maxWidth: "100%", marginTop: "1rem" }}
						/>
						<div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
							<button type="button" className="btn-accent" onClick={download}>
								Download
							</button>
							<button type="button" className="btn-ghost-sm" onClick={reset}>
								Splice More Videos
							</button>
						</div>
					</div>
				) : (
					<div className="card">
						<SplicePanel
							clips={clips}
							setClips={setClips}
							onSplice={handleSplice}
							processing={processing}
							setError={setError}
						/>
					</div>
				)}

				{error && (
					<div
						className="error-banner"
						role="alert"
						style={{ marginTop: "1rem" }}
					>
						<span>Error: {error}</span>
						<button
							type="button"
							onClick={() => setError(null)}
							style={{ marginLeft: "0.5rem" }}
						>
							×
						</button>
					</div>
				)}
			</main>

			<Footer />
		</div>
	);
}
