/**
 * Sanitizes a filename by replacing Swedish/special characters with ASCII equivalents
 * or underscores, and removing non-URL-safe characters.
 */
export function sanitizeFilename(filename: string): string {
    // Map of Swedish/special characters to ASCII equivalents
    const charMap: Record<string, string> = {
        'å': 'a', 'ä': 'a', 'ö': 'o',
        'Å': 'A', 'Ä': 'A', 'Ö': 'O',
        ' ': '_',
    };

    // Replace characters from map
    let sanitized = filename.split('').map(char => charMap[char] || char).join('');

    // Remove any remaining non-alphanumeric characters (except dots and dashes)
    sanitized = sanitized.replace(/[^a-zA-Z0-9.-]/g, '_');

    // Remove multiple underscores/dashes in a row
    sanitized = sanitized.replace(/[_-]{2,}/g, '_');

    return sanitized;
}

/**
 * Generates a storage-safe path for a file
 */
export function getStoragePath(type: 'maps' | 'results' | 'entries', raceId: string, filename: string): string {
    const safeName = sanitizeFilename(filename);
    const timestamp = Date.now();
    return `${type}/${raceId}/${timestamp}-${safeName}`;
}
