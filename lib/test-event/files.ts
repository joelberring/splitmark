import { readdir, readFile, stat } from 'fs/promises';
import path from 'path';

export interface TestCompetitionFiles {
    baseDirectory: string;
    files: {
        resultsXml?: string;
        courseDataXml?: string;
        purplePen?: string;
        mapImage?: string;
        worldFile?: string;
        meosXml?: string;
        omap?: string;
        pdf?: string;
    };
}

export interface TestEventMetadata {
    eventName: string;
    eventDate: string;
}

export interface TestMapImageMetadata {
    width: number;
    height: number;
    mimeType: string;
}

export type TestDataFileKind = 'map-image' | 'course-file' | 'map-source' | 'results' | 'worldfile' | 'pdf' | 'other';

export interface TestDataFileCandidate {
    id: string;
    filePath: string;
    relativePath: string;
    name: string;
    extension: string;
    kind: TestDataFileKind;
    sizeBytes: number;
}

function createFileId(relativePath: string): string {
    return Buffer.from(relativePath, 'utf-8').toString('base64url');
}

function decodeFileId(fileId: string): string | null {
    try {
        const decoded = Buffer.from(fileId, 'base64url').toString('utf-8');
        if (!decoded || decoded.includes('\0')) return null;
        return decoded;
    } catch {
        return null;
    }
}

async function resolveTestDirectories(): Promise<string[]> {
    const cwd = process.cwd();
    const entries = await readdir(cwd, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isDirectory() && entry.name.toLowerCase().startsWith('test'))
        .map((entry) => path.join(cwd, entry.name));
}

async function pathExists(targetPath: string): Promise<boolean> {
    try {
        await stat(targetPath);
        return true;
    } catch {
        return false;
    }
}

async function listFilesRecursive(directory: string, maxDepth: number, depth = 0): Promise<string[]> {
    if (depth > maxDepth) return [];

    const entries = await readdir(directory, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...await listFilesRecursive(fullPath, maxDepth, depth + 1));
        } else if (entry.isFile()) {
            files.push(fullPath);
        }
    }

    return files;
}

async function detectXmlKind(filePath: string): Promise<'results' | 'course' | 'unknown'> {
    try {
        const content = await readFile(filePath, 'utf-8');
        const head = content.slice(0, 5000).toLowerCase();
        if (head.includes('<resultlist')) return 'results';
        if (head.includes('<coursedata')) return 'course';
        return 'unknown';
    } catch {
        return 'unknown';
    }
}

function pickLongestName<T extends string>(items: T[]): T | undefined {
    if (items.length === 0) return undefined;
    return items.sort((a, b) => b.length - a.length)[0];
}

function normalizeText(raw: string): string {
    return raw.replace(/\s+/g, ' ').trim();
}

function readBigEndianUInt16(buffer: Buffer, offset: number): number {
    return (buffer[offset] << 8) + buffer[offset + 1];
}

function readBigEndianUInt32(buffer: Buffer, offset: number): number {
    return (
        (buffer[offset] * 0x1000000) +
        (buffer[offset + 1] << 16) +
        (buffer[offset + 2] << 8) +
        buffer[offset + 3]
    );
}

function parsePngSize(buffer: Buffer): { width: number; height: number } | null {
    // PNG signature + IHDR chunk width/height
    if (buffer.length < 24) return null;
    const isPngSignature =
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a;

    if (!isPngSignature) return null;

    const width = readBigEndianUInt32(buffer, 16);
    const height = readBigEndianUInt32(buffer, 20);
    if (width <= 0 || height <= 0) return null;

    return { width, height };
}

function parseJpegSize(buffer: Buffer): { width: number; height: number } | null {
    // Scan SOF markers according to JPEG spec.
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

    let offset = 2;
    while (offset + 1 < buffer.length) {
        if (buffer[offset] !== 0xff) {
            offset += 1;
            continue;
        }

        const marker = buffer[offset + 1];
        offset += 2;

        // Standalone markers without segment length.
        if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
            continue;
        }

        if (offset + 1 >= buffer.length) return null;
        const segmentLength = readBigEndianUInt16(buffer, offset);
        if (segmentLength < 2 || offset + segmentLength > buffer.length) return null;

        const isSofMarker = (
            marker === 0xc0 || marker === 0xc1 || marker === 0xc2 || marker === 0xc3 ||
            marker === 0xc5 || marker === 0xc6 || marker === 0xc7 ||
            marker === 0xc9 || marker === 0xca || marker === 0xcb ||
            marker === 0xcd || marker === 0xce || marker === 0xcf
        );

        if (isSofMarker) {
            if (offset + 7 >= buffer.length) return null;
            const height = readBigEndianUInt16(buffer, offset + 3);
            const width = readBigEndianUInt16(buffer, offset + 5);
            if (width <= 0 || height <= 0) return null;
            return { width, height };
        }

        offset += segmentLength;
    }

    return null;
}

function classifyTestDataFile(filePath: string): TestDataFileKind {
    const extension = path.extname(filePath).toLowerCase();
    if (extension === '.png' || extension === '.jpg' || extension === '.jpeg' || extension === '.webp') return 'map-image';
    if (extension === '.xml' || extension === '.ppen') return 'course-file';
    if (extension === '.omap' || extension === '.xmap' || extension === '.ocd') return 'map-source';
    if (extension === '.meosxml') return 'results';
    if (extension === '.pgw' || extension === '.jgw' || extension === '.tfw') return 'worldfile';
    if (extension === '.pdf') return 'pdf';
    return 'other';
}

export function isLikelyTextFile(filePath: string): boolean {
    const extension = path.extname(filePath).toLowerCase();
    return extension === '.xml'
        || extension === '.ppen'
        || extension === '.omap'
        || extension === '.xmap'
        || extension === '.meosxml'
        || extension === '.pgw'
        || extension === '.jgw'
        || extension === '.tfw'
        || extension === '.txt'
        || extension === '.csv'
        || extension === '.json';
}

export function resolveFileMimeTypeFromPath(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();
    if (extension === '.png') return 'image/png';
    if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
    if (extension === '.webp') return 'image/webp';
    if (extension === '.xml' || extension === '.ppen' || extension === '.omap' || extension === '.xmap' || extension === '.meosxml') {
        return 'application/xml';
    }
    if (extension === '.pdf') return 'application/pdf';
    if (extension === '.txt' || extension === '.pgw' || extension === '.jgw' || extension === '.tfw') return 'text/plain; charset=utf-8';
    return 'application/octet-stream';
}

export function extractEventMetadataFromResultXml(xmlText: string): TestEventMetadata {
    const nameMatch = xmlText.match(/<Event[\s\S]*?<Name>([^<]+)<\/Name>/i);
    const dateMatch = xmlText.match(/<StartTime[\s\S]*?<Date>([^<]+)<\/Date>/i);

    const eventName = normalizeText(nameMatch?.[1] || 'Test competition');
    const eventDate = normalizeText(dateMatch?.[1] || new Date().toISOString().slice(0, 10));

    return { eventName, eventDate };
}

export async function readTextFileIfExists(filePath?: string): Promise<string | null> {
    if (!filePath) return null;
    if (!await pathExists(filePath)) return null;
    return readFile(filePath, 'utf-8');
}

export async function readMapImageMetadata(mapImagePath?: string): Promise<TestMapImageMetadata | null> {
    if (!mapImagePath) return null;
    if (!await pathExists(mapImagePath)) return null;

    const content = await readFile(mapImagePath);
    const png = parsePngSize(content);
    if (png) {
        return {
            ...png,
            mimeType: resolveFileMimeTypeFromPath(mapImagePath),
        };
    }

    const jpeg = parseJpegSize(content);
    if (jpeg) {
        return {
            ...jpeg,
            mimeType: resolveFileMimeTypeFromPath(mapImagePath),
        };
    }

    return null;
}

export function resolveMapImageMimeType(mapImagePath?: string): string {
    if (!mapImagePath) return 'application/octet-stream';
    return resolveFileMimeTypeFromPath(mapImagePath);
}

export async function listTestDataFileCandidates(maxDepth = 4): Promise<TestDataFileCandidate[]> {
    const cwd = process.cwd();
    const testDirectories = await resolveTestDirectories();
    if (testDirectories.length === 0) return [];

    const files: TestDataFileCandidate[] = [];
    for (const directory of testDirectories) {
        const candidates = await listFilesRecursive(directory, maxDepth);
        for (const filePath of candidates) {
            const relativePath = path.relative(cwd, filePath);
            const metadata = await stat(filePath);
            const extension = path.extname(filePath).toLowerCase();
            files.push({
                id: createFileId(relativePath),
                filePath,
                relativePath,
                name: path.basename(filePath),
                extension,
                kind: classifyTestDataFile(filePath),
                sizeBytes: metadata.size,
            });
        }
    }

    return files.sort((left, right) => {
        const byKind = left.kind.localeCompare(right.kind);
        if (byKind !== 0) return byKind;
        return left.relativePath.localeCompare(right.relativePath);
    });
}

export async function resolveTestDataFileById(fileId: string): Promise<TestDataFileCandidate | null> {
    const decodedRelativePath = decodeFileId(fileId);
    if (!decodedRelativePath) return null;

    const candidates = await listTestDataFileCandidates(4);
    const match = candidates.find((candidate) => candidate.relativePath === decodedRelativePath);
    return match || null;
}

export async function resolveTestCompetitionFiles(): Promise<TestCompetitionFiles> {
    const cwd = process.cwd();
    const testDirectories = await resolveTestDirectories();

    const candidateFiles: string[] = [];
    for (const directory of testDirectories) {
        candidateFiles.push(...await listFilesRecursive(directory, 3));
    }

    const resultsCandidates: string[] = [];
    const courseCandidates: string[] = [];
    const meosCandidates: string[] = [];
    const purplePenCandidates: string[] = [];
    const worldFileCandidates: string[] = [];
    const mapImageCandidates: string[] = [];
    const omapCandidates: string[] = [];
    const pdfCandidates: string[] = [];

    for (const filePath of candidateFiles) {
        const lowerPath = filePath.toLowerCase();

        if (lowerPath.endsWith('.meosxml')) {
            meosCandidates.push(filePath);
            continue;
        }
        if (lowerPath.endsWith('.ppen')) {
            purplePenCandidates.push(filePath);
            continue;
        }
        if (lowerPath.endsWith('.pgw') || lowerPath.endsWith('.jgw') || lowerPath.endsWith('.tfw')) {
            worldFileCandidates.push(filePath);
            continue;
        }
        if (lowerPath.endsWith('.omap') || lowerPath.endsWith('.xmap')) {
            omapCandidates.push(filePath);
            continue;
        }
        if (lowerPath.endsWith('.pdf')) {
            pdfCandidates.push(filePath);
            continue;
        }
        if (lowerPath.endsWith('.png') || lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg') || lowerPath.endsWith('.webp')) {
            mapImageCandidates.push(filePath);
            continue;
        }
        if (lowerPath.endsWith('.xml')) {
            const xmlKind = await detectXmlKind(filePath);
            if (xmlKind === 'results') {
                resultsCandidates.push(filePath);
            } else if (xmlKind === 'course') {
                courseCandidates.push(filePath);
            }
        }
    }

    const resultsXml = pickLongestName(resultsCandidates);
    const courseDataXml = pickLongestName(courseCandidates);
    const purplePen = pickLongestName(purplePenCandidates);
    const worldFile = pickLongestName(worldFileCandidates);
    const mapImage = pickLongestName(mapImageCandidates);
    const meosXml = pickLongestName(meosCandidates);
    const omap = pickLongestName(omapCandidates);
    const pdf = pickLongestName(pdfCandidates);

    if (resultsXml || courseDataXml || purplePen || mapImage || worldFile) {
        const bestPath = resultsXml || courseDataXml || purplePen || mapImage || worldFile || meosXml || omap || pdf;
        return {
            baseDirectory: bestPath ? path.dirname(bestPath) : testDirectories[0],
            files: {
                resultsXml,
                courseDataXml,
                purplePen,
                mapImage,
                worldFile,
                meosXml,
                omap,
                pdf,
            },
        };
    }

    const legacyDirectory = path.join(cwd, 'data', 'ans');
    const hasLegacyDirectory = await pathExists(legacyDirectory);

    if (!hasLegacyDirectory) {
        return {
            baseDirectory: cwd,
            files: {},
        };
    }

    const legacyFiles = {
        resultsXml: path.join(legacyDirectory, 'results.xml'),
        courseDataXml: path.join(legacyDirectory, 'courses.xml'),
        purplePen: path.join(legacyDirectory, 'courses.ppen'),
        worldFile: path.join(legacyDirectory, 'worldfile.pgw'),
        meosXml: path.join(legacyDirectory, 'meos.xml'),
    };

    return {
        baseDirectory: legacyDirectory,
        files: {
            resultsXml: await pathExists(legacyFiles.resultsXml) ? legacyFiles.resultsXml : undefined,
            courseDataXml: await pathExists(legacyFiles.courseDataXml) ? legacyFiles.courseDataXml : undefined,
            purplePen: await pathExists(legacyFiles.purplePen) ? legacyFiles.purplePen : undefined,
            worldFile: await pathExists(legacyFiles.worldFile) ? legacyFiles.worldFile : undefined,
            meosXml: await pathExists(legacyFiles.meosXml) ? legacyFiles.meosXml : undefined,
        },
    };
}
