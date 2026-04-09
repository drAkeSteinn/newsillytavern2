'use client';

import { cn } from '@/lib/utils';

interface SpritePreviewProps {
  src: string;
  alt: string;
  className?: string;
  videoClassName?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  objectFit?: 'contain' | 'cover' | 'fill';
}

// Check if URL is a video file
function isVideoUrl(url: string): boolean {
  return /\.(webm|mp4|mov|avi)(\?.*)?$/i.test(url);
}

// Check if URL is an animated image (gif, apng)
function isAnimatedImage(url: string): boolean {
  return /\.(gif|apng)(\?.*)?$/i.test(url);
}

export function SpritePreview({
  src,
  alt,
  className,
  videoClassName,
  autoPlay = true,
  loop = true,
  muted = true,
  objectFit = 'contain'
}: SpritePreviewProps) {
  if (!src) {
    return null;
  }

  const objectFitClass = {
    contain: 'object-contain',
    cover: 'object-cover',
    fill: 'object-fill'
  }[objectFit];

  // Video files need <video> element
  if (isVideoUrl(src)) {
    return (
      <video
        src={src}
        className={cn(objectFitClass, 'object-bottom', className, videoClassName)}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        playsInline
        disablePictureInPicture
        controls={false}
      />
    );
  }

  // Images (including animated gif/apng) use <img>
  return (
    <img
      src={src}
      alt={alt}
      className={cn(objectFitClass, 'object-bottom', className)}
      draggable={false}
    />
  );
}

// Grid thumbnail version - smaller, for collection previews
interface SpriteThumbnailProps {
  src: string;
  alt: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function SpriteThumbnail({ src, alt, className, size = 'md' }: SpriteThumbnailProps) {
  const sizeClass = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-20 h-20'
  }[size];

  return (
    <SpritePreview
      src={src}
      alt={alt}
      className={cn(sizeClass, 'object-cover', className)}
      objectFit="cover"
    />
  );
}

// Type badge for showing if sprite is animated
interface SpriteTypeBadgeProps {
  url: string;
  className?: string;
}

export function SpriteTypeBadge({ url, className }: SpriteTypeBadgeProps) {
  if (isVideoUrl(url)) {
    return (
      <span className={cn(
        'px-1.5 py-0.5 text-[10px] bg-blue-500/80 text-white rounded font-medium',
        className
      )}>
        VIDEO
      </span>
    );
  }

  if (isAnimatedImage(url)) {
    return (
      <span className={cn(
        'px-1.5 py-0.5 text-[10px] bg-purple-500/80 text-white rounded font-medium',
        className
      )}>
        GIF
      </span>
    );
  }

  return null;
}
