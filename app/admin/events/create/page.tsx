'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/auth/hooks';
import ControlSensitivityPicker from '@/components/Admin/ControlSensitivityPicker';
import type { GPSModeSettings, SpectatorModeSettings } from '@/types/virtual-controls';
import { DEFAULT_SPECTATOR_SETTINGS } from '@/types/virtual-controls';

type Step = 'basic' | 'media' | 'classes' | 'registration' | 'publish';

export default function CreateEventPage() {
    const { user, loading } = useRequireAuth('/login');
    const router = useRouter();

    const [currentStep, setCurrentStep] = useState<Step>('basic');
    const [eventData, setEventData] = useState({
        name: '',
        date: '',
        time: '',
        location: '',
        locationCoords: null as { lat: number; lng: number } | null,
        googleMapsUrl: '',
        organizer: '',
        classification: 'Local' as 'National' | 'Regional' | 'Local',
        description: '',
    });

    // Media & Attachments
    const [images, setImages] = useState<{ id: string; url: string; caption?: string }[]>([]);
    const [attachments, setAttachments] = useState<{ id: string; name: string; type: 'pdf' | 'link'; url: string }[]>([]);
    const [newImageUrl, setNewImageUrl] = useState('');
    const [newAttachmentName, setNewAttachmentName] = useState('');
    const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
    const [newAttachmentType, setNewAttachmentType] = useState<'pdf' | 'link'>('link');

    // Classes
    const [classes, setClasses] = useState<string[]>([]);
    const [newClass, setNewClass] = useState('');

    // Registration settings
    const [registrationSettings, setRegistrationSettings] = useState({
        deadline: '', // ISO date
        lateDeadline: '', // separate late registration deadline
        allowLateRegistration: false,
        lateRegistrationFee: 0,
        allowDirectRegistration: false,
        directRegistrationClasses: [] as string[], // empty = all classes
        directRegistrationAllClasses: true,
    });

    // GPS mode settings
    const [gpsMode, setGpsMode] = useState<GPSModeSettings>({
        enabled: false,
        sensitivity: 'standard',
    });

    // Spectator mode settings
    const [spectatorMode, setSpectatorMode] = useState<SpectatorModeSettings>(DEFAULT_SPECTATOR_SETTINGS);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    const handleSubmit = async () => {
        // Create event with proper structure
        const eventId = `event-${Date.now()}`;

        // Convert class names to proper class objects
        const classObjects = classes.map((name, index) => ({
            id: `class-${eventId}-${index}`,
            name,
            courseId: undefined, // Will be linked later in courses page
        }));

        const newEvent = {
            id: eventId,
            name: eventData.name,
            date: eventData.date,
            time: eventData.time,
            location: eventData.location,
            googleMapsUrl: eventData.googleMapsUrl,
            organizer: eventData.organizer,
            classification: eventData.classification,
            description: eventData.description,
            // Media
            images,
            attachments,
            // Classes & Courses
            classes: classObjects,
            courses: [], // Empty, will be added later
            entries: [],
            // Registration
            registrationSettings,
            // Settings
            gpsMode,
            spectatorMode,
            // Metadata
            createdAt: new Date().toISOString(),
            createdBy: user?.uid || 'unknown',
            status: 'draft',
        };

        // Save to localStorage
        const storedEvents = localStorage.getItem('events');
        const events = storedEvents ? JSON.parse(storedEvents) : [];
        events.push(newEvent);
        localStorage.setItem('events', JSON.stringify(events));

        alert('Tävling skapad!');
        router.push(`/admin/events/${eventId}`);
    };

    const steps: { id: Step; title: string; icon: string }[] = [
        { id: 'basic', title: 'Grundinfo', icon: '📝' },
        { id: 'media', title: 'Bilder & Filer', icon: '📷' },
        { id: 'classes', title: 'Klasser', icon: '🏃' },
        { id: 'registration', title: 'Anmälan', icon: '📋' },
        { id: 'publish', title: 'Publicera', icon: '✅' },
    ];

    const currentStepIndex = steps.findIndex(s => s.id === currentStep);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm">
                <div className="max-w-5xl mx-auto px-4 py-6">
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                        Skapa Tävling
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                        Följ stegen för att sätta upp din tävling
                    </p>
                </div>
            </header>

            <div className="max-w-5xl mx-auto px-4 py-8">
                {/* Progress Steps */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        {steps.map((step, index) => (
                            <div key={step.id} className="flex items-center flex-1">
                                <div className="flex flex-col items-center flex-1">
                                    <div
                                        className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${index <= currentStepIndex
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                                            }`}
                                    >
                                        {step.icon}
                                    </div>
                                    <span className="text-sm mt-2 font-semibold text-gray-700 dark:text-gray-300">
                                        {step.title}
                                    </span>
                                </div>
                                {index < steps.length - 1 && (
                                    <div
                                        className={`flex-1 h-1 mx-4 ${index < currentStepIndex
                                            ? 'bg-emerald-500'
                                            : 'bg-gray-200 dark:bg-gray-700'
                                            }`}
                                    ></div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Form Content */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
                    {currentStep === 'basic' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
                                Grundinformation
                            </h2>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Tävlingsnamn *
                                </label>
                                <input
                                    type="text"
                                    value={eventData.name}
                                    onChange={(e) => setEventData({ ...eventData, name: e.target.value })}
                                    placeholder="T.ex. Tiomila 2025"
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                />
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Datum *
                                    </label>
                                    <input
                                        type="date"
                                        value={eventData.date}
                                        onChange={(e) => setEventData({ ...eventData, date: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Tid
                                    </label>
                                    <input
                                        type="time"
                                        value={eventData.time}
                                        onChange={(e) => setEventData({ ...eventData, time: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Plats *
                                </label>
                                <input
                                    type="text"
                                    value={eventData.location}
                                    onChange={(e) => setEventData({ ...eventData, location: e.target.value })}
                                    placeholder="T.ex. Tyresta naturreservat, Stockholm"
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Arrangör *
                                </label>
                                <input
                                    type="text"
                                    value={eventData.organizer}
                                    onChange={(e) => setEventData({ ...eventData, organizer: e.target.value })}
                                    placeholder="T.ex. IFK Göteborg Orientering"
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Klassificering
                                </label>
                                <select
                                    value={eventData.classification}
                                    onChange={(e) => setEventData({ ...eventData, classification: e.target.value as any })}
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                >
                                    <option value="Local">Lokal</option>
                                    <option value="Regional">Regional</option>
                                    <option value="National">Nationell</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Beskrivning
                                </label>
                                <textarea
                                    value={eventData.description}
                                    onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
                                    placeholder="Frivillig beskrivning av tävlingen..."
                                    rows={4}
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                ></textarea>
                            </div>
                        </div>
                    )}

                    {currentStep === 'classes' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
                                Lägg till Klasser
                            </h2>

                            <div className="flex gap-4">
                                <input
                                    type="text"
                                    value={newClass}
                                    onChange={(e) => setNewClass(e.target.value)}
                                    placeholder="T.ex. D21E, H21E, D20, H20..."
                                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter' && newClass.trim()) {
                                            setClasses([...classes, newClass.trim()]);
                                            setNewClass('');
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        if (newClass.trim()) {
                                            setClasses([...classes, newClass.trim()]);
                                            setNewClass('');
                                        }
                                    }}
                                    className="px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
                                >
                                    Lägg till
                                </button>
                            </div>

                            {classes.length > 0 && (
                                <div>
                                    <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">
                                        Tillagda klasser ({classes.length})
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {classes.map((cls, index) => (
                                            <div
                                                key={index}
                                                className="px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded-lg flex items-center gap-2"
                                            >
                                                <span className="font-semibold">{cls}</span>
                                                <button
                                                    onClick={() => setClasses(classes.filter((_, i) => i !== index))}
                                                    className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {classes.length === 0 && (
                                <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <p className="text-gray-500 dark:text-gray-400">
                                        Inga klasser tillagda än. Lägg till minst en klass.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Media Step */}
                    {currentStep === 'media' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
                                Bilder & Filer
                            </h2>

                            {/* Images Section */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                                <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">
                                    📷 Bilder
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                    Lägg till bilder som visas i event-flödet (Instagram-stil)
                                </p>

                                <div className="flex gap-3 mb-4">
                                    <input
                                        type="url"
                                        value={newImageUrl}
                                        onChange={(e) => setNewImageUrl(e.target.value)}
                                        placeholder="https://..."
                                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                    />
                                    <button
                                        onClick={() => {
                                            if (newImageUrl.trim()) {
                                                setImages([...images, { id: `img-${Date.now()}`, url: newImageUrl }]);
                                                setNewImageUrl('');
                                            }
                                        }}
                                        className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-semibold"
                                    >
                                        Lägg till
                                    </button>
                                </div>

                                {images.length > 0 && (
                                    <div className="grid grid-cols-3 gap-3">
                                        {images.map((img) => (
                                            <div key={img.id} className="relative aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                                                <img src={img.url} alt="" className="w-full h-full object-cover" />
                                                <button
                                                    onClick={() => setImages(images.filter(i => i.id !== img.id))}
                                                    className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full text-sm"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Google Maps Link */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                                <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">
                                    📍 Google Maps-länk
                                </h3>
                                <input
                                    type="url"
                                    value={eventData.googleMapsUrl}
                                    onChange={(e) => setEventData({ ...eventData, googleMapsUrl: e.target.value })}
                                    placeholder="https://maps.google.com/..."
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                />
                            </div>

                            {/* Attachments */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                                <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">
                                    📎 Bilagor (PM, externa länkar)
                                </h3>

                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <input
                                        type="text"
                                        value={newAttachmentName}
                                        onChange={(e) => setNewAttachmentName(e.target.value)}
                                        placeholder="Namn (t.ex. PM)"
                                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                    />
                                    <select
                                        value={newAttachmentType}
                                        onChange={(e) => setNewAttachmentType(e.target.value as 'pdf' | 'link')}
                                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                    >
                                        <option value="link">Extern länk</option>
                                        <option value="pdf">PDF-fil</option>
                                    </select>
                                </div>
                                <div className="flex gap-3">
                                    <input
                                        type="url"
                                        value={newAttachmentUrl}
                                        onChange={(e) => setNewAttachmentUrl(e.target.value)}
                                        placeholder="URL..."
                                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                    />
                                    <button
                                        onClick={() => {
                                            if (newAttachmentName.trim() && newAttachmentUrl.trim()) {
                                                setAttachments([...attachments, {
                                                    id: `att-${Date.now()}`,
                                                    name: newAttachmentName,
                                                    type: newAttachmentType,
                                                    url: newAttachmentUrl,
                                                }]);
                                                setNewAttachmentName('');
                                                setNewAttachmentUrl('');
                                            }
                                        }}
                                        className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-semibold"
                                    >
                                        Lägg till
                                    </button>
                                </div>

                                {attachments.length > 0 && (
                                    <div className="mt-4 space-y-2">
                                        {attachments.map((att) => (
                                            <div key={att.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <span>{att.type === 'pdf' ? '📄' : '🔗'}</span>
                                                    <span className="font-medium">{att.name}</span>
                                                </div>
                                                <button
                                                    onClick={() => setAttachments(attachments.filter(a => a.id !== att.id))}
                                                    className="text-red-500"
                                                >
                                                    Ta bort
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Registration Step */}
                    {currentStep === 'registration' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
                                Anmälningsinställningar
                            </h2>

                            {/* Main Deadline */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                                <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">
                                    📅 Anmälningstid
                                </h3>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Anmälan stänger
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={registrationSettings.deadline}
                                            onChange={(e) => setRegistrationSettings({
                                                ...registrationSettings,
                                                deadline: e.target.value,
                                            })}
                                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Late Registration */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                                <label className="flex items-center gap-3 mb-4">
                                    <input
                                        type="checkbox"
                                        checked={registrationSettings.allowLateRegistration}
                                        onChange={(e) => setRegistrationSettings({
                                            ...registrationSettings,
                                            allowLateRegistration: e.target.checked,
                                        })}
                                        className="w-5 h-5 rounded accent-emerald-500"
                                    />
                                    <span className="font-bold text-gray-800 dark:text-gray-100">
                                        Tillåt efteranmälan
                                    </span>
                                </label>

                                {registrationSettings.allowLateRegistration && (
                                    <div className="grid md:grid-cols-2 gap-4 mt-4 pl-8">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Efteranmälan stänger
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={registrationSettings.lateDeadline}
                                                onChange={(e) => setRegistrationSettings({
                                                    ...registrationSettings,
                                                    lateDeadline: e.target.value,
                                                })}
                                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Avgiftstillägg (kr)
                                            </label>
                                            <input
                                                type="number"
                                                value={registrationSettings.lateRegistrationFee}
                                                onChange={(e) => setRegistrationSettings({
                                                    ...registrationSettings,
                                                    lateRegistrationFee: parseInt(e.target.value) || 0,
                                                })}
                                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Direct Registration */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                                <label className="flex items-center gap-3 mb-4">
                                    <input
                                        type="checkbox"
                                        checked={registrationSettings.allowDirectRegistration}
                                        onChange={(e) => setRegistrationSettings({
                                            ...registrationSettings,
                                            allowDirectRegistration: e.target.checked,
                                        })}
                                        className="w-5 h-5 rounded accent-emerald-500"
                                    />
                                    <span className="font-bold text-gray-800 dark:text-gray-100">
                                        Tillåt direktanmälan på plats
                                    </span>
                                </label>

                                {registrationSettings.allowDirectRegistration && (
                                    <div className="mt-4 pl-8 space-y-4">
                                        <label className="flex items-center gap-3">
                                            <input
                                                type="radio"
                                                checked={registrationSettings.directRegistrationAllClasses}
                                                onChange={() => setRegistrationSettings({
                                                    ...registrationSettings,
                                                    directRegistrationAllClasses: true,
                                                })}
                                                className="w-4 h-4 accent-emerald-500"
                                            />
                                            <span className="text-gray-700 dark:text-gray-300">
                                                Alla klasser
                                            </span>
                                        </label>
                                        <label className="flex items-center gap-3">
                                            <input
                                                type="radio"
                                                checked={!registrationSettings.directRegistrationAllClasses}
                                                onChange={() => setRegistrationSettings({
                                                    ...registrationSettings,
                                                    directRegistrationAllClasses: false,
                                                })}
                                                className="w-4 h-4 accent-emerald-500"
                                            />
                                            <span className="text-gray-700 dark:text-gray-300">
                                                Endast vissa klasser
                                            </span>
                                        </label>

                                        {!registrationSettings.directRegistrationAllClasses && classes.length > 0 && (
                                            <div className="grid grid-cols-3 gap-2 mt-2">
                                                {classes.map((cls) => (
                                                    <label key={cls} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                                                        <input
                                                            type="checkbox"
                                                            checked={registrationSettings.directRegistrationClasses.includes(cls)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setRegistrationSettings({
                                                                        ...registrationSettings,
                                                                        directRegistrationClasses: [...registrationSettings.directRegistrationClasses, cls],
                                                                    });
                                                                } else {
                                                                    setRegistrationSettings({
                                                                        ...registrationSettings,
                                                                        directRegistrationClasses: registrationSettings.directRegistrationClasses.filter(c => c !== cls),
                                                                    });
                                                                }
                                                            }}
                                                            className="w-4 h-4 accent-emerald-500"
                                                        />
                                                        <span className="text-sm">{cls}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* GPS Mode Settings */}
                            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                                <ControlSensitivityPicker
                                    settings={gpsMode}
                                    onSettingsChange={setGpsMode}
                                />
                            </div>

                            {/* Spectator Mode Settings */}
                            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
                                    👁️ Åskådarinställningar
                                </h3>
                                <div className="space-y-4">
                                    <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer">
                                        <div>
                                            <div className="font-semibold text-gray-800 dark:text-gray-100">
                                                Visa orienteringskarta
                                            </div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={spectatorMode.showOLMapToSpectators}
                                            onChange={(e) => setSpectatorMode({
                                                ...spectatorMode,
                                                showOLMapToSpectators: e.target.checked,
                                            })}
                                            className="w-5 h-5 rounded accent-emerald-500"
                                        />
                                    </label>
                                    <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer">
                                        <div>
                                            <div className="font-semibold text-gray-800 dark:text-gray-100">
                                                Visa banan efter målgång
                                            </div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={spectatorMode.courseVisibleAfterFinish}
                                            onChange={(e) => setSpectatorMode({
                                                ...spectatorMode,
                                                courseVisibleAfterFinish: e.target.checked,
                                            })}
                                            className="w-5 h-5 rounded accent-emerald-500"
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 'publish' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
                                Granska & Publicera
                            </h2>

                            <div className="space-y-4">
                                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">
                                        Tävlingsinformation
                                    </h3>
                                    <dl className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <dt className="text-gray-500 dark:text-gray-400">Namn:</dt>
                                            <dd className="font-semibold text-gray-800 dark:text-gray-100">{eventData.name || '-'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-gray-500 dark:text-gray-400">Datum:</dt>
                                            <dd className="font-semibold text-gray-800 dark:text-gray-100">{eventData.date || '-'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-gray-500 dark:text-gray-400">Plats:</dt>
                                            <dd className="font-semibold text-gray-800 dark:text-gray-100">{eventData.location || '-'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-gray-500 dark:text-gray-400">Arrangör:</dt>
                                            <dd className="font-semibold text-gray-800 dark:text-gray-100">{eventData.organizer || '-'}</dd>
                                        </div>
                                    </dl>
                                </div>

                                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">
                                        Klasser ({classes.length})
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {classes.map((cls, index) => (
                                            <span key={index} className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded text-sm font-semibold">
                                                {cls}
                                            </span>
                                        ))}
                                        {classes.length === 0 && (
                                            <span className="text-gray-500">Inga klasser tillagda</span>
                                        )}
                                    </div>
                                </div>

                                {/* GPS Mode Summary */}
                                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">
                                        GPS-läge
                                    </h3>
                                    {gpsMode.enabled ? (
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded">
                                                ✓ Aktivt
                                            </span>
                                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                                Känslighet: {gpsMode.sensitivity === 'custom'
                                                    ? `${gpsMode.customRadius}m`
                                                    : gpsMode.sensitivity}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-sm text-gray-500">Inaktivt (fysisk stämpling)</span>
                                    )}
                                </div>

                                {/* Spectator Mode Summary */}
                                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">
                                        Åskådarläge
                                    </h3>
                                    <div className="flex flex-wrap gap-2 text-xs">
                                        <span className={`px-2 py-1 rounded ${spectatorMode.showOLMapToSpectators
                                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700'
                                            : 'bg-red-100 dark:bg-red-900/30 text-red-700'
                                            }`}>
                                            {spectatorMode.showOLMapToSpectators ? '✓' : '✗'} Karta
                                        </span>
                                        <span className={`px-2 py-1 rounded ${spectatorMode.showCourseToSpectators
                                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700'
                                            : 'bg-red-100 dark:bg-red-900/30 text-red-700'
                                            }`}>
                                            {spectatorMode.showCourseToSpectators ? '✓' : '✗'} Bana
                                        </span>
                                        <span className={`px-2 py-1 rounded ${spectatorMode.courseVisibleAfterFinish
                                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700'
                                            : 'bg-red-100 dark:bg-red-900/30 text-red-700'
                                            }`}>
                                            {spectatorMode.courseVisibleAfterFinish ? '✓' : '✗'} Visa efter mål
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-6">
                                <p className="text-emerald-800 dark:text-emerald-200">
                                    ✓ Allt ser bra ut! Tryck "Publicera" för att skapa tävlingen.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex justify-between mt-8 pt-6 border-t dark:border-gray-700">
                        <button
                            onClick={() => {
                                const prevIndex = Math.max(0, currentStepIndex - 1);
                                setCurrentStep(steps[prevIndex].id);
                            }}
                            disabled={currentStepIndex === 0}
                            className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            ← Föregående
                        </button>

                        {currentStepIndex < steps.length - 1 ? (
                            <button
                                onClick={() => {
                                    const nextIndex = Math.min(steps.length - 1, currentStepIndex + 1);
                                    setCurrentStep(steps[nextIndex].id);
                                }}
                                className="px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
                            >
                                Nästa →
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg font-semibold hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg"
                            >
                                ✨ Publicera Tävling
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
