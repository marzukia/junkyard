/** Audio format definitions for the audio converter. */

export type AudioFormat =
	| "mp3"
	| "wav"
	| "flac"
	| "m4a"
	| "ogg"
	| "opus"
	| "aiff";

export interface FormatDef {
	label: string;
	ext: string;
	mime: string;
	encoder: string;
	/** Bitrate in kbps for lossy codecs. null = lossless. */
	defaultBitrate: number | null;
	/** Bitrate range for custom slider. null = lossless only. */
	bitrateRange: [number, number] | null;
}

export const FORMATS: Record<AudioFormat, FormatDef> = {
	mp3: {
		label: "MP3",
		ext: "mp3",
		mime: "audio/mpeg",
		encoder: "libmp3lame",
		defaultBitrate: 192,
		bitrateRange: [32, 320],
	},
	wav: {
		label: "WAV",
		ext: "wav",
		mime: "audio/wav",
		encoder: "pcm_s16le",
		defaultBitrate: null,
		bitrateRange: null,
	},
	flac: {
		label: "FLAC",
		ext: "flac",
		mime: "audio/flac",
		encoder: "flac",
		defaultBitrate: null,
		bitrateRange: null,
	},
	m4a: {
		label: "M4A (AAC)",
		ext: "m4a",
		mime: "audio/mp4",
		encoder: "aac",
		defaultBitrate: 192,
		bitrateRange: [64, 500],
	},
	ogg: {
		label: "OGG (Vorbis)",
		ext: "ogg",
		mime: "audio/ogg",
		encoder: "libvorbis",
		defaultBitrate: 192,
		bitrateRange: [32, 500],
	},
	opus: {
		label: "OPUS",
		ext: "opus",
		mime: "audio/opus",
		encoder: "libopus",
		defaultBitrate: 128,
		bitrateRange: [32, 510],
	},
	aiff: {
		label: "AIFF",
		ext: "aiff",
		mime: "audio/aiff",
		encoder: "pcm_s16le",
		defaultBitrate: null,
		bitrateRange: null,
	},
};

export type QualityPreset = "low" | "medium" | "high" | "custom";

export interface QualityDef {
	label: string;
	/** Bitrate multiplier relative to default. null = use custom bitrate. */
	multiplier: number | null;
}

export const QUALITY_PRESETS: Record<QualityPreset, QualityDef> = {
	low: { label: "Space saving", multiplier: 0.5 },
	medium: { label: "Balanced", multiplier: 1.0 },
	high: { label: "Best quality", multiplier: 1.5 },
	custom: { label: "Custom bitrate", multiplier: null },
};

export type SampleRate = "original" | 44100 | 48000 | 96000 | 192000;

export const SAMPLE_RATES: SampleRate[] = [
	"original",
	44100,
	48000,
	96000,
	192000,
];

export const SAMPLE_RATE_LABELS: Record<SampleRate, string> = {
	original: "Original",
	"44100": "44.1 kHz",
	"48000": "48 kHz",
	"96000": "96 kHz",
	"192000": "192 kHz",
};

export type ChannelMode = "stereo" | "mono";

export const CHANNEL_MODES: ChannelMode[] = ["stereo", "mono"];

export const CHANNEL_LABELS: Record<ChannelMode, string> = {
	stereo: "Stereo",
	mono: "Mono",
};

/** Accepted file extensions for the drop zone. */
export const ACCEPTED_AUDIO =
	".mp3,.wav,.flac,.m4a,.ogg,.opus,.aiff,.aac,.wma,.mp4a,.m2a";

export function isAudioFile(file: File): boolean {
	const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
	const accepted = ACCEPTED_AUDIO.split(",").map((e) =>
		e.replace(".", "").toLowerCase(),
	);
	return accepted.includes(ext);
}
