import { ClubActivity, ActivityRegistration } from '@/types/club-activities';

/**
 * Utility to export activity data for LOK-stöd reporting.
 * Supports XML (IdrottOnline compatible structure) and CSV.
 */
export const exportToLokStod = (
    activity: ClubActivity,
    registrations: ActivityRegistration[],
    format: 'xml' | 'csv' = 'xml'
): string | Blob => {
    // Filter participants who attended
    const attendees = registrations.filter(r => r.status === 'attended');

    if (format === 'csv') {
        return generateCSV(activity, attendees);
    }

    return generateXML(activity, attendees);
};

const generateCSV = (activity: ClubActivity, attendees: ActivityRegistration[]): string => {
    const headers = ['Aktivitet', 'Datum', 'Start', 'Namn', 'Användar-ID', 'Status'];
    const dateStr = activity.date instanceof Date ? activity.date.toLocaleDateString() : activity.date.toString();

    const rows = attendees.map(r => [
        activity.name,
        dateStr,
        activity.startTime,
        r.userName,
        r.userId,
        'Närvarande'
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
};

const generateXML = (activity: ClubActivity, attendees: ActivityRegistration[]): string => {
    const dateStr = activity.date instanceof Date
        ? activity.date.toISOString().split('T')[0]
        : activity.date.toString();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<LokStodExport version="1.0" generator="Splitmark">\n`;
    xml += `  <Activity name="${escapeXml(activity.name)}" date="${dateStr}" startTime="${activity.startTime}" location="${escapeXml(activity.location)}">\n`;
    xml += `    <Participants>\n`;

    attendees.forEach(r => {
        xml += `      <Participant name="${escapeXml(r.userName)}" userId="${r.userId}" role="participant" />\n`;
    });

    xml += `    </Participants>\n`;
    xml += `  </Activity>\n`;
    xml += `</LokStodExport>`;

    return xml;
};

const escapeXml = (unsafe: string): string => {
    return unsafe.replace(/[<>&"']/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '"': return '&quot;';
            case "'": return '&apos;';
            default: return c;
        }
    });
};
