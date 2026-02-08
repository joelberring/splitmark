export interface RelativeControlPoint {
    relX?: number;
    relY?: number;
}

export interface RelativeRect {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

export interface MapUploadOptimizationOptions {
    enabled?: boolean;
    maxWidth?: number;
    quality?: number; // 0..1
    format?: 'image/webp' | 'image/jpeg' | 'image/png';
    cropToControls?: boolean;
    cropMargin?: number; // 0..0.4
    controls?: RelativeControlPoint[];
}

export interface MapUploadOptimizationReport {
    originalWidth: number;
    originalHeight: number;
    width: number;
    height: number;
    originalBytes: number;
    processedBytes: number;
    format: string;
    cropRect: RelativeRect;
    cropApplied: boolean;
    quality: number;
    compressionRatio: number;
    usedOriginalFile: boolean;
}

export interface MapUploadOptimizationResult {
    file: File;
    report: MapUploadOptimizationReport;
}

const FULL_IMAGE_RECT: RelativeRect = { left: 0, top: 0, right: 1, bottom: 1 };

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function normalizeRect(rect: RelativeRect): RelativeRect {
    const left = clamp(Math.min(rect.left, rect.right), 0, 1);
    const right = clamp(Math.max(rect.left, rect.right), 0, 1);
    const top = clamp(Math.min(rect.top, rect.bottom), 0, 1);
    const bottom = clamp(Math.max(rect.top, rect.bottom), 0, 1);

    return { left, top, right, bottom };
}

export function getControlCoverageRect(
    controls: RelativeControlPoint[],
    margin = 0.08
): RelativeRect | null {
    const validControls = controls.filter(
        (control) =>
            typeof control.relX === 'number'
            && typeof control.relY === 'number'
            && Number.isFinite(control.relX)
            && Number.isFinite(control.relY)
    ) as Array<{ relX: number; relY: number }>;

    if (validControls.length === 0) {
        return null;
    }

    const safeMargin = clamp(margin, 0, 0.4);

    let minX = validControls[0].relX;
    let maxX = validControls[0].relX;
    let minY = validControls[0].relY;
    let maxY = validControls[0].relY;

    for (const control of validControls) {
        minX = Math.min(minX, control.relX);
        maxX = Math.max(maxX, control.relX);
        minY = Math.min(minY, control.relY);
        maxY = Math.max(maxY, control.relY);
    }

    let rect = normalizeRect({
        left: minX - safeMargin,
        top: minY - safeMargin,
        right: maxX + safeMargin,
        bottom: maxY + safeMargin,
    });

    // Ensure a tiny minimum box when controls are very close.
    const minWidth = 0.04;
    const minHeight = 0.04;
    const width = rect.right - rect.left;
    const height = rect.bottom - rect.top;

    if (width < minWidth) {
        const centerX = (rect.left + rect.right) / 2;
        rect = normalizeRect({
            ...rect,
            left: centerX - minWidth / 2,
            right: centerX + minWidth / 2,
        });
    }

    if (height < minHeight) {
        const centerY = (rect.top + rect.bottom) / 2;
        rect = normalizeRect({
            ...rect,
            top: centerY - minHeight / 2,
            bottom: centerY + minHeight / 2,
        });
    }

    return rect;
}

function remapRelativeValue(value: number, start: number, end: number): number {
    if (!Number.isFinite(value) || end <= start) return clamp(value, 0, 1);
    return clamp((value - start) / (end - start), 0, 1);
}

export function remapRelativePointForCrop(
    point: { relX: number; relY: number },
    cropRect: RelativeRect
): { relX: number; relY: number } {
    return {
        relX: remapRelativeValue(point.relX, cropRect.left, cropRect.right),
        relY: remapRelativeValue(point.relY, cropRect.top, cropRect.bottom),
    };
}

export function remapControlsForCrop<T extends RelativeControlPoint>(
    controls: T[],
    cropRect: RelativeRect
): T[] {
    return controls.map((control) => {
        if (typeof control.relX !== 'number' || typeof control.relY !== 'number') {
            return control;
        }

        const remapped = remapRelativePointForCrop(
            { relX: control.relX, relY: control.relY },
            cropRect
        );

        return {
            ...control,
            relX: remapped.relX,
            relY: remapped.relY,
        };
    });
}

function getFileExtensionForMimeType(mimeType: string): string {
    if (mimeType === 'image/webp') return 'webp';
    if (mimeType === 'image/png') return 'png';
    return 'jpg';
}

function replaceFileExtension(filename: string, extension: string): string {
    const withoutExt = filename.replace(/\.[^.]+$/, '');
    return `${withoutExt}.${extension}`;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const objectUrl = URL.createObjectURL(file);

        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Could not decode image file.'));
        };

        image.src = objectUrl;
    });
}

function canvasToBlob(
    canvas: HTMLCanvasElement,
    mimeType: string,
    quality?: number
): Promise<Blob | null> {
    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), mimeType, quality);
    });
}

async function encodeCanvas(
    canvas: HTMLCanvasElement,
    preferredFormat: MapUploadOptimizationOptions['format'],
    quality: number
): Promise<{ blob: Blob; format: string }> {
    const triedFormats = [preferredFormat, 'image/jpeg', 'image/png'].filter(Boolean) as string[];
    const uniqueFormats = Array.from(new Set(triedFormats));

    for (const format of uniqueFormats) {
        const blob = await canvasToBlob(canvas, format, quality);
        if (blob) {
            return { blob, format };
        }
    }

    throw new Error('Could not encode processed map image.');
}

export async function processMapImageForUpload(
    file: File,
    options: MapUploadOptimizationOptions
): Promise<MapUploadOptimizationResult> {
    if (!file.type.startsWith('image/')) {
        throw new Error('Endast bildfiler kan optimeras.');
    }

    const enabled = options.enabled !== false;
    const maxWidth = clamp(Math.round(options.maxWidth ?? 4096), 512, 12000);
    const quality = clamp(options.quality ?? 0.82, 0.45, 0.95);
    const preferredFormat = options.format || 'image/webp';

    if (!enabled) {
        return {
            file,
            report: {
                originalWidth: 0,
                originalHeight: 0,
                width: 0,
                height: 0,
                originalBytes: file.size,
                processedBytes: file.size,
                format: file.type || 'application/octet-stream',
                cropRect: FULL_IMAGE_RECT,
                cropApplied: false,
                quality,
                compressionRatio: 1,
                usedOriginalFile: true,
            },
        };
    }

    const image = await loadImageFromFile(file);
    const originalWidth = image.naturalWidth;
    const originalHeight = image.naturalHeight;

    const controlRect = options.cropToControls
        ? getControlCoverageRect(options.controls || [], options.cropMargin ?? 0.08)
        : null;

    const cropRect = controlRect || FULL_IMAGE_RECT;
    const cropApplied = cropRect.left > 0 || cropRect.top > 0 || cropRect.right < 1 || cropRect.bottom < 1;

    const sourceX = Math.round(cropRect.left * originalWidth);
    const sourceY = Math.round(cropRect.top * originalHeight);
    const sourceWidth = Math.max(1, Math.round((cropRect.right - cropRect.left) * originalWidth));
    const sourceHeight = Math.max(1, Math.round((cropRect.bottom - cropRect.top) * originalHeight));

    const downscaleRatio = sourceWidth > maxWidth ? maxWidth / sourceWidth : 1;
    const width = Math.max(1, Math.round(sourceWidth * downscaleRatio));
    const height = Math.max(1, Math.round(sourceHeight * downscaleRatio));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Canvas context could not be created.');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);

    const encoded = await encodeCanvas(canvas, preferredFormat, quality);
    const extension = getFileExtensionForMimeType(encoded.format);
    const processedFilename = replaceFileExtension(file.name, extension);
    const processedFile = new File([encoded.blob], processedFilename, { type: encoded.blob.type || encoded.format });

    const shouldUseOriginalFile = !cropApplied
        && width === originalWidth
        && height === originalHeight
        && processedFile.size >= file.size;

    const finalFile = shouldUseOriginalFile ? file : processedFile;
    const finalBytes = finalFile.size;

    return {
        file: finalFile,
        report: {
            originalWidth,
            originalHeight,
            width: shouldUseOriginalFile ? originalWidth : width,
            height: shouldUseOriginalFile ? originalHeight : height,
            originalBytes: file.size,
            processedBytes: finalBytes,
            format: shouldUseOriginalFile ? (file.type || encoded.format) : encoded.format,
            cropRect,
            cropApplied,
            quality,
            compressionRatio: file.size > 0 ? finalBytes / file.size : 1,
            usedOriginalFile: shouldUseOriginalFile,
        },
    };
}
