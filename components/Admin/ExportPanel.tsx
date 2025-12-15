/**
 * Export Panel Component
 * UI for exporting results to PDF, WinSplits, IOF XML, and CSV
 */

'use client';

import { useState } from 'react';
import type { Entry } from '@/types/entry';
import {
    generateStartListHTML,
    generateResultsHTML,
    generateWinSplitsExport,
    generateIOFResultsXML,
    printHTML,
    downloadCSV,
    downloadXML
} from '@/lib/export/export';

interface ExportPanelProps {
    entries: Entry[];
    classes: { id: string; name: string }[];
    courses?: { id: string; name: string; controls: { code: string }[] }[];
    eventName: string;
    eventDate: string;
    onClose?: () => void;
}

export default function ExportPanel({
    entries,
    classes,
    courses = [],
    eventName,
    eventDate,
    onClose
}: ExportPanelProps) {
    const [exportType, setExportType] = useState<'startlist' | 'results'>('results');
    const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
    const [exporting, setExporting] = useState(false);

    const handlePDFExport = () => {
        setExporting(true);
        try {
            const html = exportType === 'startlist'
                ? generateStartListHTML(entries, classes, {
                    title: `Startlista - ${eventName}`,
                    subtitle: eventDate,
                    fontSize
                })
                : generateResultsHTML(entries, classes, {
                    title: `Resultat - ${eventName}`,
                    subtitle: eventDate,
                    fontSize
                });
            printHTML(html);
        } finally {
            setExporting(false);
        }
    };

    const handleWinSplitsExport = () => {
        setExporting(true);
        try {
            const csv = generateWinSplitsExport(entries, classes, courses);
            downloadCSV(csv, `${eventName.replace(/\s+/g, '-')}-winsplits.csv`);
        } finally {
            setExporting(false);
        }
    };

    const handleIOFExport = () => {
        setExporting(true);
        try {
            const xml = generateIOFResultsXML(eventName, eventDate, entries, classes);
            downloadXML(xml, `${eventName.replace(/\s+/g, '-')}-results.xml`);
        } finally {
            setExporting(false);
        }
    };

    const handleCSVExport = () => {
        setExporting(true);
        try {
            const headers = ['Klass', 'Namn', 'Klubb', 'Tid', 'Status'];
            const rows = entries
                .filter(e => e.status === 'finished')
                .map(e => {
                    const time = e.startTime && e.finishTime
                        ? Math.floor((new Date(e.finishTime).getTime() - new Date(e.startTime).getTime()) / 1000)
                        : 0;
                    const mins = Math.floor(time / 60);
                    const secs = time % 60;
                    return [
                        classes.find(c => c.id === e.classId)?.name || '',
                        `${e.firstName} ${e.lastName}`,
                        e.clubName || '',
                        `${mins}:${secs.toString().padStart(2, '0')}`,
                        e.resultStatus === 'mp' ? 'Felstämpling' : 'OK'
                    ];
                });
            const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
            downloadCSV(csv, `${eventName.replace(/\s+/g, '-')}-resultat.csv`);
        } finally {
            setExporting(false);
        }
    };

    const finishedCount = entries.filter(e => e.status === 'finished').length;
    const mpCount = entries.filter(e => e.resultStatus === 'mp').length;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="p-6 border-b dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                            📤 Exportera
                        </h2>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {finishedCount} deltagare i mål, {mpCount} felstämplingar
                    </p>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* PDF Options */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">
                            🖨️ PDF / Utskrift
                        </h3>

                        <div className="space-y-3">
                            {/* Type selection */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setExportType('startlist')}
                                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${exportType === 'startlist'
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 border dark:border-gray-500'
                                        }`}
                                >
                                    Startlista
                                </button>
                                <button
                                    onClick={() => setExportType('results')}
                                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${exportType === 'results'
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 border dark:border-gray-500'
                                        }`}
                                >
                                    Resultat
                                </button>
                            </div>

                            {/* Font size */}
                            <div>
                                <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">
                                    Textstorlek
                                </label>
                                <div className="flex gap-2">
                                    {(['small', 'medium', 'large'] as const).map(size => (
                                        <button
                                            key={size}
                                            onClick={() => setFontSize(size)}
                                            className={`flex-1 py-1 px-3 rounded text-sm font-medium transition-colors ${fontSize === size
                                                    ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800'
                                                    : 'bg-white dark:bg-gray-600 text-gray-600 dark:text-gray-300 border dark:border-gray-500'
                                                }`}
                                        >
                                            {size === 'small' ? 'Liten' : size === 'medium' ? 'Medium' : 'Stor'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handlePDFExport}
                                disabled={exporting}
                                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                            >
                                {exporting ? 'Exporterar...' : '🖨️ Skriv ut / Spara som PDF'}
                            </button>
                        </div>
                    </div>

                    {/* Other formats */}
                    <div>
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">
                            📁 Andra format
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={handleWinSplitsExport}
                                disabled={exporting}
                                className="p-4 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-left"
                            >
                                <div className="font-semibold mb-1">📊 WinSplits</div>
                                <div className="text-xs opacity-75">CSV för WinSplits Pro</div>
                            </button>

                            <button
                                onClick={handleIOFExport}
                                disabled={exporting}
                                className="p-4 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors text-left"
                            >
                                <div className="font-semibold mb-1">📄 IOF XML 3.0</div>
                                <div className="text-xs opacity-75">Standard för Eventor</div>
                            </button>

                            <button
                                onClick={handleCSVExport}
                                disabled={exporting}
                                className="p-4 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-left"
                            >
                                <div className="font-semibold mb-1">📋 CSV</div>
                                <div className="text-xs opacity-75">Enkel tabell</div>
                            </button>

                            <button
                                onClick={() => {
                                    const json = JSON.stringify({
                                        event: eventName,
                                        date: eventDate,
                                        entries: entries.filter(e => e.status === 'finished'),
                                        classes
                                    }, null, 2);
                                    const blob = new Blob([json], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `${eventName.replace(/\s+/g, '-')}-data.json`;
                                    a.click();
                                }}
                                disabled={exporting}
                                className="p-4 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-xl hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors text-left"
                            >
                                <div className="font-semibold mb-1">🔧 JSON</div>
                                <div className="text-xs opacity-75">Rådata för utvecklare</div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                        PDF-export öppnar webbläsarens utskriftsdialog. Välj "Spara som PDF" för att ladda ner.
                    </p>
                </div>
            </div>
        </div>
    );
}
