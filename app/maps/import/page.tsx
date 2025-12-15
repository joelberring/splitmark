'use client';

import { useAuthState, useRequireAuth } from '@/lib/auth/hooks';
import { useState, useCallback } from 'react';
import { importMapFile } from '@/lib/maps/import';
import type { ImportedMap } from '@/types/maps';
import Link from 'next/link';

export default function MapImportPage() {
    const { user, loading } = useRequireAuth('/login');
    const [importing, setImporting] = useState(false);
    const [importedMap, setImportedMap] = useState<ImportedMap | null>(null);
    const [error, setError] = useState('');

    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        setError('');

        try {
            const map = await importMapFile(file);
            setImportedMap(map);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setImporting(false);
        }
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <header className="bg-white dark:bg-gray-800 shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-6">
                    <Link
                        href="/admin"
                        className="text-sm text-gray-500 hover:text-emerald-600 mb-2 inline-block"
                    >
                        ← Tillbaka till Admin
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                        Importera Karta
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                        Ladda upp orienteringskarta i OCAD eller OpenOrienteering Mapper format
                    </p>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Upload Area */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">
                        Välj Kartfil
                    </h2>

                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-12 text-center">
                        <input
                            type="file"
                            id="map-file"
                            accept=".omap,.xmap,.ocd,.mbtiles,.tif,.tiff,.jpg,.jpeg,.png"
                            onChange={handleFileSelect}
                            className="hidden"
                            disabled={importing}
                        />
                        <label
                            htmlFor="map-file"
                            className="cursor-pointer block"
                        >
                            <div className="text-6xl mb-4">🗺️</div>
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                                {importing ? 'Importerar...' : 'Klicka för att välja fil'}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                Stödda format: .omap, .xmap, .ocd, .mbtiles, .tif, bilder
                            </p>
                            {importing && (
                                <div className="flex items-center justify-center gap-3">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                        Läser kartfil...
                                    </span>
                                </div>
                            )}
                        </label>
                    </div>

                    {error && (
                        <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    )}
                </div>

                {/* Imported Map Info */}
                {importedMap && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">
                            Kartinformation
                        </h2>

                        <div className="space-y-4">
                            <InfoRow label="Filnamn" value={importedMap.name} />
                            <InfoRow label="Format" value={importedMap.source} />
                            <InfoRow label="Skala" value={`1:${importedMap.scale}`} />
                            {importedMap.georeferencing.crs && (
                                <InfoRow label="Koordinatsystem" value={importedMap.georeferencing.crs} />
                            )}
                            {importedMap.georeferencing.declination && (
                                <InfoRow
                                    label="Missvisning"
                                    value={`${importedMap.georeferencing.declination.toFixed(1)}°`}
                                />
                            )}
                            {importedMap.georeferencing.bounds && (
                                <div>
                                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Georeferens
                                    </div>
                                    <div className="text-sm text-emerald-600 dark:text-emerald-400 font-mono">
                                        ✓ Karta har koordinater
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-8 flex gap-4">
                            <button className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg font-semibold hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg">
                                Spara Karta
                            </button>
                            <button
                                onClick={() => setImportedMap(null)}
                                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                Rensa
                            </button>
                        </div>
                    </div>
                )}

                {/* Supported Formats Info */}
                <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                    <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-4">
                        📋 Stödda Kartformat
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-700 dark:text-blue-300">
                        <div>
                            <div className="font-semibold mb-2">✅ Fullt stöd:</div>
                            <ul className="space-y-1">
                                <li>• OpenOrienteering Mapper (.omap, .xmap)</li>
                                <li>• GeoTIFF (.tif, .tiff)</li>
                            </ul>
                        </div>
                        <div>
                            <div className="font-semibold mb-2">⏳ Kommande:</div>
                            <ul className="space-y-1">
                                <li>• OCAD (.ocd) - Binär parser</li>
                                <li>• MBTiles - Tile server</li>
                                <li>• KMZ - Google Earth format</li>
                            </ul>
                        </div>
                    </div>
                    <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                        <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                            💡 Tips: Exportera OCAD-kartor till .omap format med OpenOrienteering Mapper
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between py-2 border-b dark:border-gray-700">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
            </span>
            <span className="text-sm text-gray-900 dark:text-gray-100 font-mono">
                {value}
            </span>
        </div>
    );
}
