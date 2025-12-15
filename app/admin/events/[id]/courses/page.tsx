'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import HelpButton from '@/components/HelpButton';
import type { Course, Control, ControlType } from '@/types/course';

interface EventClass {
    id: string;
    name: string;
    courseId?: string;
}

export default function CoursesPage() {
    const params = useParams();
    const eventId = params.id as string;

    const [courses, setCourses] = useState<Course[]>([]);
    const [classes, setClasses] = useState<EventClass[]>([]);
    const [eventName, setEventName] = useState('');
    const [loading, setLoading] = useState(true);

    // UI State
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);

    useEffect(() => {
        loadData();
    }, [eventId]);

    const loadData = () => {
        const storedEvents = localStorage.getItem('events');
        if (storedEvents) {
            const events = JSON.parse(storedEvents);
            const event = events.find((e: any) => e.id === eventId);
            if (event) {
                setEventName(event.name);
                setClasses(event.classes || []);

                // Load regular courses
                let allCourses: Course[] = event.courses || [];

                // Also load ppenCourses (imported from Map tab) and convert to Course format
                if (event.ppenCourses && Array.isArray(event.ppenCourses)) {
                    const ppenAsRegular: Course[] = event.ppenCourses
                        .filter((pc: any) => !allCourses.some(c => c.name === pc.name))
                        .map((pc: any) => ({
                            id: `ppen-${pc.id}`,
                            eventId,
                            name: pc.name,
                            length: 0,
                            climb: 0,
                            controls: (pc.controlIds || []).map((code: string, i: number) => ({
                                id: `ctrl-${pc.id}-${i}`,
                                code,
                                type: i === 0 ? 'start' : i === pc.controlIds.length - 1 ? 'finish' : 'control',
                                order: i,
                            })),
                            classIds: [],
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                        }));
                    allCourses = [...allCourses, ...ppenAsRegular];
                }

                setCourses(allCourses);
            }
        }
        setLoading(false);
    };

    const saveCourses = (newCourses: Course[]) => {
        const storedEvents = localStorage.getItem('events');
        if (storedEvents) {
            const events = JSON.parse(storedEvents);
            const index = events.findIndex((e: any) => e.id === eventId);
            if (index >= 0) {
                events[index].courses = newCourses;
                localStorage.setItem('events', JSON.stringify(events));
            }
        }
        setCourses(newCourses);
    };

    const saveClasses = (newClasses: EventClass[]) => {
        const storedEvents = localStorage.getItem('events');
        if (storedEvents) {
            const events = JSON.parse(storedEvents);
            const index = events.findIndex((e: any) => e.id === eventId);
            if (index >= 0) {
                events[index].classes = newClasses;
                localStorage.setItem('events', JSON.stringify(events));
            }
        }
        setClasses(newClasses);
    };

    const handleAddCourse = (course: Omit<Course, 'id' | 'eventId' | 'createdAt' | 'updatedAt'>) => {
        const newCourse: Course = {
            ...course,
            id: `course-${Date.now()}`,
            eventId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        saveCourses([...courses, newCourse]);
        setShowAddModal(false);
        setSelectedCourse(newCourse);
    };

    const handleUpdateCourse = (course: Course) => {
        const updated = courses.map(c =>
            c.id === course.id
                ? { ...course, updatedAt: new Date().toISOString() }
                : c
        );
        saveCourses(updated);
        setSelectedCourse(course);
    };

    const handleDeleteCourse = (courseId: string) => {
        if (confirm('Ta bort denna bana?')) {
            saveCourses(courses.filter(c => c.id !== courseId));
            if (selectedCourse?.id === courseId) {
                setSelectedCourse(null);
            }
        }
    };

    const handleLinkClass = (classId: string, courseId: string) => {
        // Update class with courseId (or remove it if empty)
        const updatedClasses = classes.map(c =>
            c.id === classId
                ? { ...c, courseId: courseId || undefined }
                : c
        );
        saveClasses(updatedClasses);

        // Update all courses' classIds
        const updatedCourses = courses.map(c => {
            const currentClassIds = c.classIds || [];

            if (courseId && c.id === courseId) {
                // Add class to this course if not already there
                if (!currentClassIds.includes(classId)) {
                    return { ...c, classIds: [...currentClassIds, classId] };
                }
                return c;
            } else {
                // Remove class from other courses (or all if courseId is empty)
                const filtered = currentClassIds.filter(id => id !== classId);
                if (filtered.length !== currentClassIds.length) {
                    return { ...c, classIds: filtered };
                }
                return c;
            }
        });
        saveCourses(updatedCourses);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <Link href={`/admin/events/${eventId}`} className="text-sm text-gray-500 hover:text-emerald-600 mb-2 inline-block">
                        ← Tillbaka till {eventName}
                    </Link>
                    <div className="flex items-center justify-between">
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
                            🗺️ Banor & Kontroller
                            <HelpButton topic="courses" />
                        </h1>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowImportModal(true)}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600"
                            >
                                📥 Importera
                            </button>
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600"
                            >
                                + Ny Bana
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Course List */}
                    <div className="lg:col-span-1 space-y-4">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                            Banor ({courses.length})
                        </h2>

                        {courses.length === 0 ? (
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center">
                                <div className="text-4xl mb-3">🗺️</div>
                                <p className="text-gray-600 dark:text-gray-400 mb-4">
                                    Inga banor skapade
                                </p>
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-semibold"
                                >
                                    Skapa första banan
                                </button>
                            </div>
                        ) : (
                            courses.map(course => (
                                <div
                                    key={course.id}
                                    onClick={() => setSelectedCourse(course)}
                                    className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 cursor-pointer transition-all ${selectedCourse?.id === course.id
                                        ? 'ring-2 ring-emerald-500'
                                        : 'hover:shadow-xl'
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-bold text-gray-800 dark:text-gray-100">
                                                {course.name}
                                            </h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                {(course.length / 1000).toFixed(1)} km · {course.climb}m ↑
                                            </p>
                                            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                                                {course.controls.length} kontroller
                                            </p>
                                        </div>
                                        <div className="text-2xl">🗺️</div>
                                    </div>

                                    {/* Linked classes */}
                                    {course.classIds && course.classIds.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-1">
                                            {course.classIds.map(classId => {
                                                const cls = classes.find(c => c.id === classId);
                                                return cls ? (
                                                    <span
                                                        key={classId}
                                                        className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded text-xs"
                                                    >
                                                        {cls.name}
                                                    </span>
                                                ) : null;
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Course Detail / Editor */}
                    <div className="lg:col-span-2">
                        {selectedCourse ? (
                            <CourseEditor
                                course={selectedCourse}
                                classes={classes}
                                onUpdate={handleUpdateCourse}
                                onDelete={() => handleDeleteCourse(selectedCourse.id)}
                                onLinkClass={handleLinkClass}
                            />
                        ) : (
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 text-center">
                                <div className="text-6xl mb-4">👈</div>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Välj en bana för att redigera, eller skapa en ny
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Class-Course Linking */}
                <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
                        Koppla klasser till banor
                    </h2>

                    {classes.length === 0 ? (
                        <p className="text-gray-600 dark:text-gray-400">
                            Inga klasser skapade ännu. Gå till Klasser-fliken för att lägga till.
                        </p>
                    ) : (
                        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {classes.map(cls => (
                                <div key={cls.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <span className="font-semibold text-gray-800 dark:text-gray-100">
                                        {cls.name}
                                    </span>
                                    <select
                                        value={cls.courseId || ''}
                                        onChange={(e) => handleLinkClass(cls.id, e.target.value)}
                                        className="ml-2 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-600 dark:text-white"
                                    >
                                        <option value="">Ingen bana</option>
                                        {courses.map(course => (
                                            <option key={course.id} value={course.id}>{course.name}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Add Course Modal */}
            {showAddModal && (
                <AddCourseModal
                    onAdd={handleAddCourse}
                    onClose={() => setShowAddModal(false)}
                />
            )}

            {/* Import Modal */}
            {showImportModal && (
                <ImportCourseModal
                    onImport={(importedCourses) => {
                        saveCourses([...courses, ...importedCourses]);
                        setShowImportModal(false);
                    }}
                    eventId={eventId}
                    onClose={() => setShowImportModal(false)}
                />
            )}
        </div>
    );
}

function CourseEditor({
    course,
    classes,
    onUpdate,
    onDelete,
    onLinkClass,
}: {
    course: Course;
    classes: EventClass[];
    onUpdate: (course: Course) => void;
    onDelete: () => void;
    onLinkClass: (classId: string, courseId: string) => void;
}) {
    const [name, setName] = useState(course.name);
    const [length, setLength] = useState((course.length / 1000).toString());
    const [climb, setClimb] = useState(course.climb.toString());
    const [controls, setControls] = useState<Control[]>(course.controls);
    const [newControlCode, setNewControlCode] = useState('');

    useEffect(() => {
        setName(course.name);
        setLength((course.length / 1000).toString());
        setClimb(course.climb.toString());
        setControls(course.controls);
    }, [course]);

    const handleSave = () => {
        onUpdate({
            ...course,
            name,
            length: parseFloat(length) * 1000,
            climb: parseInt(climb) || 0,
            controls,
        });
    };

    const addControl = (type: ControlType = 'control') => {
        if (type === 'control' && !newControlCode.trim()) return;

        const newControl: Control = {
            id: `ctrl-${Date.now()}`,
            code: type === 'start' ? 'S' : type === 'finish' ? 'F' : newControlCode,
            type,
            order: controls.length,
        };

        setControls([...controls, newControl]);
        setNewControlCode('');
    };

    const removeControl = (controlId: string) => {
        setControls(controls.filter(c => c.id !== controlId));
    };

    const moveControl = (index: number, direction: 'up' | 'down') => {
        const newControls = [...controls];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= controls.length) return;

        [newControls[index], newControls[newIndex]] = [newControls[newIndex], newControls[index]];
        newControls.forEach((c, i) => c.order = i);
        setControls(newControls);
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            <div className="p-6 border-b dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                    Redigera: {course.name}
                </h2>
                <button
                    onClick={onDelete}
                    className="text-red-600 hover:text-red-800 text-sm"
                >
                    Ta bort bana
                </button>
            </div>

            <div className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Bannamn
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Längd (km)
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            value={length}
                            onChange={(e) => setLength(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Stigning (m)
                        </label>
                        <input
                            type="number"
                            value={climb}
                            onChange={(e) => setClimb(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                        />
                    </div>
                </div>

                {/* Controls */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Kontroller ({controls.length})
                        </label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => addControl('start')}
                                disabled={controls.some(c => c.type === 'start')}
                                className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-sm font-semibold disabled:opacity-50"
                            >
                                + Start
                            </button>
                            <button
                                onClick={() => addControl('finish')}
                                disabled={controls.some(c => c.type === 'finish')}
                                className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-sm font-semibold disabled:opacity-50"
                            >
                                + Mål
                            </button>
                        </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        {controls.length === 0 ? (
                            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                                Inga kontroller tillagda. Börja med att lägga till Start.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {controls.map((control, index) => (
                                    <div
                                        key={control.id}
                                        className="flex items-center gap-3 p-2 bg-white dark:bg-gray-600 rounded-lg"
                                    >
                                        <span className="w-8 text-center text-sm text-gray-500">
                                            {index + 1}
                                        </span>
                                        <span className={`w-12 h-8 flex items-center justify-center rounded font-bold text-sm ${control.type === 'start'
                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                            : control.type === 'finish'
                                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                                : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                            }`}>
                                            {control.code}
                                        </span>
                                        <span className="flex-1 text-sm text-gray-600 dark:text-gray-300">
                                            {control.type === 'start' ? 'Start' : control.type === 'finish' ? 'Mål' : 'Kontroll'}
                                        </span>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => moveControl(index, 'up')}
                                                disabled={index === 0}
                                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                            >
                                                ↑
                                            </button>
                                            <button
                                                onClick={() => moveControl(index, 'down')}
                                                disabled={index === controls.length - 1}
                                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                            >
                                                ↓
                                            </button>
                                            <button
                                                onClick={() => removeControl(control.id)}
                                                className="p-1 text-red-400 hover:text-red-600"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add Control */}
                        <div className="flex gap-2 mt-4">
                            <input
                                type="text"
                                value={newControlCode}
                                onChange={(e) => setNewControlCode(e.target.value)}
                                placeholder="Kontrollkod (t.ex. 31)"
                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-500 rounded-lg dark:bg-gray-600 dark:text-white"
                                onKeyPress={(e) => e.key === 'Enter' && addControl()}
                            />
                            <button
                                onClick={() => addControl()}
                                disabled={!newControlCode.trim()}
                                className="px-4 py-2 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 disabled:opacity-50"
                            >
                                + Lägg till
                            </button>
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        className="px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600"
                    >
                        ✓ Spara ändringar
                    </button>
                </div>
            </div>
        </div>
    );
}

function AddCourseModal({
    onAdd,
    onClose,
}: {
    onAdd: (course: Omit<Course, 'id' | 'eventId' | 'createdAt' | 'updatedAt'>) => void;
    onClose: () => void;
}) {
    const [name, setName] = useState('');
    const [length, setLength] = useState('');
    const [climb, setClimb] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAdd({
            name,
            length: parseFloat(length) * 1000 || 0,
            climb: parseInt(climb) || 0,
            controls: [],
            classIds: [],
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">
                    Skapa ny bana
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Bannamn *
                        </label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="T.ex. Lång, Medel, Bana 1"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Längd (km)
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                value={length}
                                onChange={(e) => setLength(e.target.value)}
                                placeholder="T.ex. 5.5"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Stigning (m)
                            </label>
                            <input
                                type="number"
                                value={climb}
                                onChange={(e) => setClimb(e.target.value)}
                                placeholder="T.ex. 150"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold"
                        >
                            Avbryt
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600"
                        >
                            Skapa bana
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ImportCourseModal({
    onImport,
    eventId,
    onClose,
}: {
    onImport: (courses: Course[]) => void;
    eventId: string;
    onClose: () => void;
}) {
    const [xmlData, setXmlData] = useState('');

    const handleImport = () => {
        // Basic IOF XML parsing (simplified)
        // In production, use a proper XML parser
        const courses: Course[] = [];

        // Demo: Create some example courses if XML contains course data
        if (xmlData.includes('Course') || xmlData.includes('course')) {
            courses.push({
                id: `course-import-${Date.now()}`,
                eventId,
                name: 'Importerad bana',
                length: 5000,
                climb: 150,
                controls: [
                    { id: 'c1', code: 'S', type: 'start', order: 0 },
                    { id: 'c2', code: '31', type: 'control', order: 1 },
                    { id: 'c3', code: '32', type: 'control', order: 2 },
                    { id: 'c4', code: '33', type: 'control', order: 3 },
                    { id: 'c5', code: 'F', type: 'finish', order: 4 },
                ],
                classIds: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        }

        if (courses.length > 0) {
            onImport(courses);
        } else {
            alert('Kunde inte tolka XML-filen. Kontrollera formatet.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-xl w-full p-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                    📥 Importera banor
                </h2>

                <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                            Importera banor från IOF XML 3.0 (OCAD, Purple Pen, etc.)
                        </p>
                    </div>

                    <textarea
                        value={xmlData}
                        onChange={(e) => setXmlData(e.target.value)}
                        placeholder="Klistra in IOF XML här..."
                        rows={10}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm dark:bg-gray-700 dark:text-white"
                    />

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold"
                        >
                            Avbryt
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={!xmlData}
                            className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 disabled:opacity-50"
                        >
                            Importera
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
