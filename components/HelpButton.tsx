'use client';

import { useState } from 'react';

// Help topics database (MeOS-inspired)
const HELP_TOPICS: Record<string, HelpContent> = {
    // Event creation
    'create-event': {
        title: 'Skapa ny tävling',
        icon: '📅',
        content: `
## Skapa en ny tävling

För att skapa en tävling behöver du ange:

1. **Tävlingsnamn** - Ett beskrivande namn, t.ex. "Klubbmästerskap 2024"
2. **Datum** - När tävlingen äger rum
3. **Första start** - Klockslag för första start

### Tips
- Välj ett tydligt namn som deltagare känner igen
- Ange plats/arena för att underlätta navigation
- Sätt sista anmälningsdag några dagar innan tävlingen

### Nästa steg
Efter att tävlingen skapats kan du:
- Lägga till klasser och banor
- Importera anmälningar
- Konfigurera lottning
    `,
        relatedTopics: ['event-basics', 'event-types', 'classes'],
    },

    'event-basics': {
        title: 'Grundinformation',
        icon: '📋',
        content: `
## Grundläggande information

### Tävlingsnamn
Ge tävlingen ett unikt och beskrivande namn. Undvik specialtecken.

### Datum och tid
- **Datum**: Vilken dag tävlingen äger rum
- **Första start**: När första deltagaren startar

### Plats / Arena
Ange arena-plats för navigering. Detta visas för deltagare.

### Sista anmälningsdag
Efter detta datum stängs anmälan. Du kan fortfarande lägga in efteranmälningar manuellt.
    `,
        relatedTopics: ['create-event'],
    },

    'event-types': {
        title: 'Tävlingstyper',
        icon: '🏃',
        content: `
## Tävlingstyper

### Individuell 🏃
Standard orienteringstävling där varje deltagare tävlar för sig.
- Jaktstart, intervallstart eller gemensam start
- Alla klasser stöds

### Stafett 👥
Lagtävling där flera deltagare springer varsin sträcka.
- Automatisk växlingshantering
- Gafflingar per sträcka
- Lagresultat beräknas automatiskt

### Rogaining 🗺️
Poängorientering med tidsgräns.
- Valfri kontrollordning
- Poäng per kontroll
- Tidsgräns med strafftid
    `,
        relatedTopics: ['create-event', 'courses'],
    },

    'event-classification': {
        title: 'Klassificering',
        icon: '🏆',
        content: `
## Tävlingsklassificering

### Klubbtävling
Intern tävling för klubbens medlemmar. Visar förenklade resultlistor.

### Distriktstävling
Öppen för distriktets klubbar. Eventor-anslutning tillgänglig.

### Nationell
Officiell nationell tävling med SOFT-regler. Kräver sanktionering.
    `,
        relatedTopics: ['create-event'],
    },

    // Classes
    'classes': {
        title: 'Klasser',
        icon: '👥',
        content: `
## Hantera klasser

### Skapa klasser
Du kan skapa klasser manuellt eller importera från:
- Eventor (om konfigurerat)
- IOF XML-fil
- Standardmall (D/H 10-21, öppna klasser)

### Klassegenskaper
- **Namn**: T.ex. D21, H16, Öppen 3
- **Bana**: Vilken bana klassen springer
- **Startintervall**: Tid mellan starter (vanligtvis 2-3 min)
- **Avgift**: Anmälningsavgift

### Tips
- Använd standardnamn för enkel IOF-export
- Koppla bana efter att banan skapats
- Kontrollera startintervall innan lottning
    `,
        relatedTopics: ['courses', 'lottning'],
    },

    // Courses
    'courses': {
        title: 'Banor',
        icon: '🗺️',
        content: `
## Definiera banor

### Skapa bana
En bana består av:
- **Namn**: T.ex. "Lång", "Mellanbana", "Bana 1"
- **Längd**: Ungefärlig banlängd i km
- **Stigning**: Höjdmeter

### Kontroller
Lägg till kontroller i ordning:
1. Start (valfritt, om skild från första kontroll)
2. Kontroller (31, 32, 33, ...)
3. Mål

### Importera banor
Importera från:
- **OCAD/OOM**: .ocd, .omap-filer
- **IOF XML 3.0**: Coursesetting-export
- **Purple Pen**: .ppen-filer (konvertera först)

### Gaffling
För gafflade banor, definiera varianter per sträcka.
    `,
        relatedTopics: ['classes', 'event-types'],
    },

    // Lottning
    'lottning': {
        title: 'Lottning',
        icon: '🎲',
        content: `
## Lottning av startlista

### Automatisk lottning
Systemet kan lotta automatiskt med:
- Startmellanrum per klass
- Klubbseparering (undvik samma klubb efter varandra)
- Vakanshantering

### Manuell justering
Efter lottning kan du:
- Flytta enskilda starter
- Skapa vakanser
- Byta starttider mellan deltagare

### Jaktstart
För jaktstart:
1. Importera resultat från förra etappen
2. Beräkna tidstillägg
3. Generera jaktstartlista

### Exportera startlista
- PDF för utskrift
- IOF XML för andra system
- HTML för webpublicering
    `,
        relatedTopics: ['classes', 'entries'],
    },

    // SI-brickor
    'si-cards': {
        title: 'SI-brickor',
        icon: '💳',
        content: `
## SportIdent-brickor

### Avläsning
Anslut BSM7/BSM8-station via USB och starta avläsning.

### Hyrbrickor
Du kan hantera hyrbrickor:
1. Registrera bricknummer på deltagare
2. Kryssa av vid återlämning
3. Lista utkvitterade brickor

### Oparade brickor
Om en bricka inte hittar deltagare:
- Kontrollera manuellt registrerade deltagare
- Koppla till deltagare efteråt
- Markera som test-avläsning

### Bricktyper
- SI5: 50 stämplingar
- SI6: 64/128 stämplingar
- SI8/9: 50 stämplingar, liten
- SI10/11: 128 stämplingar, touchfree
    `,
        relatedTopics: ['timing', 'results'],
    },

    // Timing
    'timing': {
        title: 'Tidtagning',
        icon: '⏱️',
        content: `
## Tidtagning

### Web Serial API
Appen använder Web Serial API för direkt USB-kommunikation.
Krav:
- Chrome, Edge eller annan Chromium-baserad webbläsare
- USB OTG-adapter för surfplattor

### Ansluta station
1. Anslut BSM7/BSM8 via USB
2. Klicka "Anslut station"
3. Välj rätt COM-port

### Live-resultat
Med aktiv anslutning visas resultat i realtid:
- Målgång registreras direkt
- Sträcktider beräknas
- Resultatlistor uppdateras

### Manuell tidtagning
För manuell backup:
1. Välj deltagare
2. Ange måltid
3. Bekräfta
    `,
        relatedTopics: ['si-cards', 'results'],
    },

    // Results
    'results': {
        title: 'Resultat',
        icon: '🏆',
        content: `
## Resultathantering

### Resultatstatus
- **OK**: Godkänd, alla kontroller stämplade rätt
- **DNF**: Ej fullföljt (missing punch, etc)
- **DSQ**: Diskvalificerad
- **DNS**: Startade ej

### Sträcktider
Visa och exportera sträcktider:
- WinSplits-export
- Livelox-upload
- PDF-utskrift

### Publicering
Publicera resultat:
- Webblänk (auto-uppdateras)
- Eventor-upload
- PDF för anslagstavla

### Redigera resultat
Du kan:
- Ändra status
- Korrigera tider
- Flytta mellan klasser
    `,
        relatedTopics: ['timing', 'si-cards'],
    },

    // Entries
    'entries': {
        title: 'Anmälningar',
        icon: '📝',
        content: `
## Hantera anmälningar

### Importera från Eventor
Om Eventor är konfigurerat:
1. Gå till Inställningar > Eventor
2. Ange tävlingens Eventor-ID
3. Klicka "Importera anmälningar"

### Manuell registrering
Lägg till deltagare manuellt:
- Namn, klubb, klass
- SI-bricknummer
- E-post för resultatmail

### Efteranmälan
Hantera efteranmälningar dag före / på tävlingsdagen:
- Markera som efteranmäld
- Tilldela starttid
- Ta betalt (valfritt)

### Återbud
Hantera avbokningar:
- Markera som återbud
- Frigör starttid för vakans
- Refundering hanteras separat
    `,
        relatedTopics: ['lottning', 'classes'],
    },

    // Speaker
    'speaker': {
        title: 'Speakerstöd',
        icon: '🎤',
        content: `
## Speakerstöd

### Speaker-vy
Öppna speaker-vyn för:
- Senaste målgångar
- Topplistor per klass
- Jämförelse med förväntad tid

### Kvar-i-skogen
Visa deltagare som inte kommit i mål:
- Beräknad sluttid
- Tid sedan start
- Senaste stämpling (om radiotider)

### Radiotider
Med radiotider från mellanstationer:
- Visa passering i realtid
- Beräkna prognos
- Varna för saknade stämplingar
    `,
        relatedTopics: ['timing', 'results'],
    },
};

interface HelpContent {
    title: string;
    icon: string;
    content: string;
    relatedTopics?: string[];
}

interface HelpButtonProps {
    topic: string;
    size?: 'sm' | 'md';
    label?: string;
}

export default function HelpButton({ topic, size = 'md', label }: HelpButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const helpContent = HELP_TOPICS[topic];

    if (!helpContent) {
        console.warn(`Help topic not found: ${topic}`);
        return null;
    }

    return (
        <>
            {/* Help Button */}
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className={`inline-flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors ${size === 'sm' ? 'w-5 h-5 text-xs' : 'w-7 h-7 text-sm'
                    }`}
                title={`Hjälp: ${helpContent.title}`}
            >
                ?
            </button>

            {/* Help Modal */}
            {isOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">{helpContent.icon}</span>
                                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                                    {helpContent.title}
                                </h2>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div
                                className="prose dark:prose-invert max-w-none prose-headings:text-gray-800 dark:prose-headings:text-gray-100 prose-p:text-gray-600 dark:prose-p:text-gray-300 prose-li:text-gray-600 dark:prose-li:text-gray-300 prose-strong:text-gray-800 dark:prose-strong:text-gray-100"
                                dangerouslySetInnerHTML={{
                                    __html: formatMarkdown(helpContent.content)
                                }}
                            />

                            {/* Related Topics */}
                            {helpContent.relatedTopics && helpContent.relatedTopics.length > 0 && (
                                <div className="mt-8 pt-6 border-t dark:border-gray-700">
                                    <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
                                        Relaterade ämnen
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {helpContent.relatedTopics.map((relatedTopic) => {
                                            const related = HELP_TOPICS[relatedTopic];
                                            if (!related) return null;
                                            return (
                                                <button
                                                    key={relatedTopic}
                                                    onClick={() => {
                                                        // Navigate to related topic
                                                        // For simplicity, just show in same modal
                                                    }}
                                                    className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                                >
                                                    {related.icon} {related.title}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="w-full px-4 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
                            >
                                Stäng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// Simple markdown to HTML converter
function formatMarkdown(md: string): string {
    return md
        .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold mt-6 mb-2">$1</h3>')
        .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
        .replace(/^\*\*(.+?)\*\*/gm, '<strong>$1</strong>')
        .replace(/^\- (.+)$/gm, '<li>$1</li>')
        .replace(/^(\d+)\. (.+)$/gm, '<li><strong>$1.</strong> $2</li>')
        .replace(/\n\n/g, '</p><p class="mb-3">')
        .replace(/^<li>/gm, '</p><ul class="list-disc pl-6 mb-3"><li>')
        .replace(/<\/li>\n(?!<li>)/g, '</li></ul><p class="mb-3">')
        .replace(/^/, '<p class="mb-3">')
        .replace(/$/, '</p>');
}

// Export the help topics for use in other components
export { HELP_TOPICS };
export type { HelpContent };
