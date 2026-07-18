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

    fetch(`https://www.googleapis.com/drive/v3/files/${driveId}?fields=mimeType&key=${GOOGLE_API_KEY}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Drive mime probe failed: ${r.status}`))))
      .then((d) => {
        if (alive && typeof d.mimeType === 'string' && d.mimeType.startsWith('video/')) {
          setDriveSource(`https://www.googleapis.com/drive/v3/files/${driveId}?alt=media&key=${GOOGLE_API_KEY}`);
        }
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
