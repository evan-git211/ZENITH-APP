import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { X, ZoomIn, ZoomOut, Check } from 'lucide-react';

interface Props {
  imageSrc: string;
  onApply: (blob: Blob) => void;
  onCancel: () => void;
}

// Render the crop area onto a canvas and return a Blob
async function getCroppedBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  const size = Math.min(pixelCrop.width, pixelCrop.height);
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    size,
    size,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/jpeg', 0.92);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function AvatarCropModal({ imageSrc, onApply, onCancel }: Props) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [applying, setApplying] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleApply = async () => {
    if (!croppedAreaPixels) return;
    setApplying(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      onApply(blob);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-neutral-900 rounded-2xl border border-neutral-800 shadow-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <h3 className="text-sm font-semibold text-white">Adjust Photo</h3>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Crop area */}
        <div className="relative w-full" style={{ height: 300, background: '#09090b' }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            style={{
              containerStyle: { borderRadius: 0 },
              cropAreaStyle: {
                border: '2px solid #f59e0b',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
              },
            }}
          />
        </div>

        {/* Zoom slider */}
        <div className="px-5 py-4 border-t border-neutral-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setZoom(z => Math.max(1, z - 0.1))}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 transition"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={e => setZoom(parseFloat(e.target.value))}
              className="flex-1 h-1.5 appearance-none rounded-full cursor-pointer accent-amber-500"
              style={{ background: `linear-gradient(to right, #f59e0b ${((zoom - 1) / 2) * 100}%, #3f3f46 ${((zoom - 1) / 2) * 100}%)` }}
            />
            <button
              onClick={() => setZoom(z => Math.min(3, z + 0.1))}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 transition"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
          <p className="text-center text-xs text-neutral-500 mt-2">Drag to reposition · Scroll or slide to zoom</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg border border-neutral-700 text-sm text-neutral-400 hover:bg-neutral-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={applying}
            className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-900 font-semibold text-sm transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            {applying ? 'Saving…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}
