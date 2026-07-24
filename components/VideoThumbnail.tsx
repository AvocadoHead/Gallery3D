import React, { useEffect, useMemo, useState } from 'react';
import { MediaItem, isDirectVideoUrl } from '../constants';

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string | undefined;

const extractDriveId = (...urls: Array<string | undefined>) => {
  for (const url of urls) {
    if (!url) continue;
    const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m1) return m1[1];
    const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m2) return m2[1];
    const m3 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m3) return m3[1];
  }
  return null;
};

export const loopVideoFirstSecond = (video: HTMLVideoElement) => {
  if (video.currentTime > 1.35) video.currentTime = 0.1;
};

export const getYouTubeId = (item: MediaItem): string | null => {
  if (item.provider !== 'youtube') return null;
  for (const url of [item.embedUrl, item.originalUrl, item.fullUrl]) {
    if (!url) continue;
    const m = url.match(/(?:embed\/|v=|youtu\.be\/|shorts\/)([\w-]{11})/);
    if (m) return m[1];
  }
  return null;
};

// Real motion for a YouTube card. YouTube has no public equivalent of Drive's
// "give me the raw file bytes" API, and its undocumented animated-thumbnail
// endpoint (i.ytimg.com/an_webp/…) silently returns a gray "no preview"
// placeholder for a large share of videos — which is exactly the ugly frame
// this replaces. So instead of a fake GIF, we mount a muted, chromeless,
// autoplaying embed ON HOVER only (one at a time, never a wall of autoplaying
// iframes), which plays the actual start of the clip. The static thumbnail
// stays underneath as the poster. `loop=1&playlist=<id>` makes a short clip
// repeat like a preview.
export const youTubePreviewSrc = (id: string): string =>
  `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}` +
  `&modestbranding=1&playsinline=1&rel=0&disablekb=1&fs=0&iv_load_policy=3`;

// Cache each Drive file's "is it a video?" answer so re-mounts, hovers, and
// layout switches (sphere ↔ carousel ↔ masonry) never re-probe the rate-limited
// Drive API. Failures are NOT cached, so a throttled probe can still retry later.
const driveVideoMimeCache = new Map<string, boolean>();

export const useAnimatedVideoPreviewSource = (item: MediaItem, enabled = true) => {
  const directSource = useMemo(() => {
    if (item.videoUrl && isDirectVideoUrl(item.videoUrl)) return item.videoUrl;
    if (item.kind === 'video' && isDirectVideoUrl(item.fullUrl)) return item.fullUrl;
    if (isDirectVideoUrl(item.originalUrl)) return item.originalUrl;
    return '';
  }, [item.fullUrl, item.kind, item.originalUrl, item.videoUrl]);

  const driveId = useMemo(
    () => extractDriveId(item.originalUrl, item.fullUrl, item.embedUrl, item.previewUrl),
    [item.embedUrl, item.fullUrl, item.originalUrl, item.previewUrl],
  );
  const isDrive = item.provider === 'gdrive' || Boolean(driveId);
  const [driveSource, setDriveSource] = useState('');

  useEffect(() => {
    let alive = true;
    setDriveSource('');

    if (!enabled || directSource || !isDrive || !driveId || !GOOGLE_API_KEY) return;

    const streamUrl = `https://www.googleapis.com/drive/v3/files/${driveId}?alt=media&key=${GOOGLE_API_KEY}`;

    // Known already? Resolve instantly without touching the (throttled) API.
    const cached = driveVideoMimeCache.get(driveId);
    if (cached !== undefined) {
      if (cached) setDriveSource(streamUrl);
      return;
    }

    fetch(`https://www.googleapis.com/drive/v3/files/${driveId}?fields=mimeType&key=${GOOGLE_API_KEY}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Drive mime probe failed: ${r.status}`))))
      .then((d) => {
        const isVideo = typeof d.mimeType === 'string' && d.mimeType.startsWith('video/');
        driveVideoMimeCache.set(driveId, isVideo);
        if (alive && isVideo) setDriveSource(streamUrl);
      })
      .catch(() => {
        if (alive) setDriveSource('');
      });

    return () => {
      alive = false;
    };
  }, [directSource, driveId, enabled, isDrive]);

  return enabled ? directSource || driveSource : '';
};

interface AnimatedVideoThumbnailProps {
  item: MediaItem;
  className?: string;
  onLoadedMetadata?: (video: HTMLVideoElement) => void;
  onError?: () => void;
  active?: boolean;
  sourceOverride?: string;
}

const AnimatedVideoThumbnail: React.FC<AnimatedVideoThumbnailProps> = ({
  item,
  className = '',
  onLoadedMetadata,
  onError,
  active = true,
  sourceOverride,
}) => {
  const detectedSource = useAnimatedVideoPreviewSource(item, active);
  const source = sourceOverride || detectedSource;
  if (!source) return null;

  return (
    <video
      src={`${source}#t=0.1`}
      className={className}
      muted
      playsInline
      autoPlay
      preload="metadata"
      onLoadedMetadata={(e) => {
        const v = e.currentTarget;
        v.muted = true;
        onLoadedMetadata?.(v);
        void v.play().catch(() => undefined);
      }}
      onTimeUpdate={(e) => loopVideoFirstSecond(e.currentTarget)}
      onError={onError}
    />
  );
};

export default AnimatedVideoThumbnail;
