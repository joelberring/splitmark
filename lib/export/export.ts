/**
 * Export Utilities Library
 * PDF generation, WinSplits export, and customizable templates
 */

import type { Entry } from '@/types/entry';

// ============= PDF Export =============

export interface PDFOptions {
    title: string;
    subtitle?: string;
    logo?: string;
    orientation: 'portrait' | 'landscape';
    fontSize: 'small' | 'medium' | 'large';
    columns?: string[];
}

/**
 * Generate start list PDF content (returns HTML for browser printing)
 */
export function generateStartListHTML(
    entries: Entry[],
    classes: { id: string; name: string }[],
    options: Partial<PDFOptions> = {}
): string {
    const { title = 'Startlista', subtitle = '', fontSize = 'medium' } = options;
    const fontSizes = { small: '10px', medium: '12px', large: '14px' };

    // Group by class
    const byClass = new Map<string, Entry[]>();
    for (const entry of entries) {
        const list = byClass.get(entry.classId) || [];
        list.push(entry);
        byClass.set(entry.classId, list);
    }

    // Sort each class by start time
    for (const [classId, list] of byClass) {
        list.sort((a, b) => {
            if (!a.startTime && !b.startTime) return 0;
            if (!a.startTime) return 1;
            if (!b.startTime) return -1;
            return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
        });
    }

    let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; font-size: ${fontSizes[fontSize]}; margin: 20px; }
        h1 { text-align: center; margin-bottom: 5px; }
        h2 { margin-top: 20px; border-bottom: 2px solid #10b981; padding-bottom: 5px; }
        .subtitle { text-align: center; color: #666; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f3f4f6; font-weight: bold; }
        .time { font-family: monospace; }
        @media print {
            .page-break { page-break-before: always; }
        }
    </style>
</head>
<body>
    <h1>${title}</h1>
    ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
`;

    let isFirst = true;
    for (const [classId, list] of byClass) {
        const className = classes.find(c => c.id === classId)?.name || classId;

        html += `
    ${!isFirst ? '<div class="page-break"></div>' : ''}
    <h2>${className}</h2>
    <table>
        <thead>
            <tr>
                <th>Starttid</th>
                <th>Namn</th>
                <th>Klubb</th>
                <th>Bricka</th>
            </tr>
        </thead>
        <tbody>
`;
        for (const entry of list) {
            const startTime = entry.startTime
                ? new Date(entry.startTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : '-';
            html += `
            <tr>
                <td class="time">${startTime}</td>
                <td><strong>${entry.firstName} ${entry.lastName}</strong></td>
                <td>${entry.clubName || ''}</td>
                <td class="time">${entry.siCard || ''}</td>
            </tr>
`;
        }
        html += `
        </tbody>
    </table>
`;
        isFirst = false;
    }

    html += `
</body>
</html>`;

    return html;
}

/**
 * Generate results PDF content
 */
export function generateResultsHTML(
    entries: Entry[],
    classes: { id: string; name: string }[],
    options: Partial<PDFOptions> = {}
): string {
    const { title = 'Resultat', subtitle = '', fontSize = 'medium' } = options;
    const fontSizes = { small: '10px', medium: '12px', large: '14px' };

    // Group by class and sort by time
    const byClass = new Map<string, Entry[]>();
    for (const entry of entries.filter(e => e.status === 'finished')) {
        const list = byClass.get(entry.classId) || [];
        list.push(entry);
        byClass.set(entry.classId, list);
    }

    for (const [classId, list] of byClass) {
        list.sort((a, b) => {
            if (a.resultStatus === 'mp' && b.resultStatus !== 'mp') return 1;
            if (a.resultStatus !== 'mp' && b.resultStatus === 'mp') return -1;
            const timeA = a.startTime && a.finishTime ? new Date(a.finishTime).getTime() - new Date(a.startTime).getTime() : Infinity;
            const timeB = b.startTime && b.finishTime ? new Date(b.finishTime).getTime() - new Date(b.startTime).getTime() : Infinity;
            return timeA - timeB;
        });
    }

    const formatTime = (ms: number): string => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; font-size: ${fontSizes[fontSize]}; margin: 20px; }
        h1 { text-align: center; margin-bottom: 5px; }
        h2 { margin-top: 20px; border-bottom: 2px solid #10b981; padding-bottom: 5px; }
        .subtitle { text-align: center; color: #666; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f3f4f6; font-weight: bold; }
        .time { font-family: monospace; }
        .position { font-weight: bold; width: 40px; }
        .mp { color: #ef4444; }
        .winner { background: #fef3c7; }
        @media print {
            .page-break { page-break-before: always; }
        }
    </style>
</head>
<body>
    <h1>${title}</h1>
    ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
`;

    let isFirst = true;
    for (const [classId, list] of byClass) {
        const className = classes.find(c => c.id === classId)?.name || classId;
        const winnerTime = list[0]?.startTime && list[0]?.finishTime
            ? new Date(list[0].finishTime).getTime() - new Date(list[0].startTime).getTime()
            : 0;

        html += `
    ${!isFirst ? '<div class="page-break"></div>' : ''}
    <h2>${className}</h2>
    <table>
        <thead>
            <tr>
                <th class="position">#</th>
                <th>Namn</th>
                <th>Klubb</th>
                <th>Tid</th>
                <th>+/-</th>
            </tr>
        </thead>
        <tbody>
`;
        let position = 1;
        for (const entry of list) {
            const time = entry.startTime && entry.finishTime
                ? new Date(entry.finishTime).getTime() - new Date(entry.startTime).getTime()
                : 0;
            const diff = time - winnerTime;
            const isMP = entry.resultStatus === 'mp';
            const isWinner = position === 1 && !isMP;

            html += `
            <tr class="${isWinner ? 'winner' : ''} ${isMP ? 'mp' : ''}">
                <td class="position">${isMP ? '' : position}</td>
                <td><strong>${entry.firstName} ${entry.lastName}</strong></td>
                <td>${entry.clubName || ''}</td>
                <td class="time">${isMP ? 'Felst.' : formatTime(time)}</td>
                <td class="time">${isWinner ? '' : isMP ? '' : '+' + formatTime(diff)}</td>
            </tr>
`;
            if (!isMP) position++;
        }
        html += `
        </tbody>
    </table>
`;
        isFirst = false;
    }

    html += `
</body>
</html>`;

    return html;
}

/**
 * Open HTML in new window for printing
 */
export function printHTML(html: string): void {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
    }
}

// ============= WinSplits Export =============

/**
 * Generate WinSplits export format
 * Format: CSV compatible with WinSplits Pro
 */
export function generateWinSplitsExport(
    entries: Entry[],
    classes: { id: string; name: string }[],
    courses: { id: string; name: string; controls: { code: string }[] }[]
): string {
    const lines: string[] = [];

    // Header
    lines.push('Klass;Namn;Klubb;' + 'Bricka;Start;Mål;Status;' + 'Sträcktider');

    for (const entry of entries.filter(e => e.status === 'finished')) {
        const className = classes.find(c => c.id === entry.classId)?.name || '';
        const startTime = entry.startTime ? formatWinSplitsTime(new Date(entry.startTime)) : '';
        const finishTime = entry.finishTime ? formatWinSplitsTime(new Date(entry.finishTime)) : '';
        const status = entry.resultStatus === 'mp' ? 'Felst' :
            entry.resultStatus === 'dnf' ? 'Utgått' : 'OK';

        // Split times (cast to any as Entry may have variable structure)
        const entryAny = entry as any;
        const splits = entryAny.punches?.map((p: any) => p.time?.toString() || '').join(';') ||
            entryAny.splitTimes?.map((s: any) => s.time?.toString() || '').join(';') || '';

        lines.push([
            className,
            `${entry.firstName} ${entry.lastName}`,
            entry.clubName || '',
            entry.siCard || '',
            startTime,
            finishTime,
            status,
            splits
        ].join(';'));
    }

    return lines.join('\n');
}

function formatWinSplitsTime(date: Date): string {
    return date.toLocaleTimeString('sv-SE', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// ============= IOF XML 3.0 Export =============

/**
 * Generate IOF XML 3.0 ResultList
 */
export function generateIOFResultsXML(
    eventName: string,
    eventDate: string,
    entries: Entry[],
    classes: { id: string; name: string }[]
): string {
    const formatTime = (ms: number): number => Math.floor(ms / 1000);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ResultList xmlns="http://www.orienteering.org/datastandard/3.0" 
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
            iofVersion="3.0" 
            createTime="${new Date().toISOString()}"
            status="Complete">
    <Event>
        <Name>${escapeXML(eventName)}</Name>
        <StartTime>
            <Date>${eventDate}</Date>
        </StartTime>
    </Event>
`;

    // Group by class
    const byClass = new Map<string, Entry[]>();
    for (const entry of entries.filter(e => e.status === 'finished')) {
        const list = byClass.get(entry.classId) || [];
        list.push(entry);
        byClass.set(entry.classId, list);
    }

    for (const [classId, list] of byClass) {
        const className = classes.find(c => c.id === classId)?.name || classId;

        xml += `    <ClassResult>
        <Class>
            <Id>${classId}</Id>
            <Name>${escapeXML(className)}</Name>
        </Class>
`;

        for (const entry of list) {
            const time = entry.startTime && entry.finishTime
                ? new Date(entry.finishTime).getTime() - new Date(entry.startTime).getTime()
                : 0;
            const status = entry.resultStatus === 'mp' ? 'MissingPunch' :
                entry.resultStatus === 'dnf' ? 'DidNotFinish' : 'OK';

            xml += `        <PersonResult>
            <Person>
                <Name>
                    <Family>${escapeXML(entry.lastName)}</Family>
                    <Given>${escapeXML(entry.firstName)}</Given>
                </Name>
            </Person>
            <Organisation>
                <Name>${escapeXML(entry.clubName || '')}</Name>
            </Organisation>
            <Result>
                <StartTime>${entry.startTime || ''}</StartTime>
                <FinishTime>${entry.finishTime || ''}</FinishTime>
                <Time>${formatTime(time)}</Time>
                <Status>${status}</Status>
`;

            // Split times (cast to any for flexibility)
            const entryAny = entry as any;
            if ((entryAny.punches && entryAny.punches.length > 0) || (entryAny.splitTimes && entryAny.splitTimes.length > 0)) {
                const punches = entryAny.punches || entryAny.splitTimes || [];
                for (const punch of punches) {
                    xml += `                <SplitTime>
                    <ControlCode>${punch.controlCode}</ControlCode>
                    <Time>${punch.time || 0}</Time>
                </SplitTime>
`;
                }
            }

            xml += `            </Result>
        </PersonResult>
`;
        }

        xml += `    </ClassResult>
`;
    }

    xml += `</ResultList>`;

    return xml;
}

function escapeXML(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// ============= Download Helpers =============

export function downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

export function downloadCSV(content: string, filename: string): void {
    downloadFile(content, filename, 'text/csv;charset=utf-8;');
}

export function downloadXML(content: string, filename: string): void {
    downloadFile(content, filename, 'application/xml;charset=utf-8;');
}
