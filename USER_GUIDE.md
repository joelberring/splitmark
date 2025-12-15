# OrienteerPro - Användarguide

## 📱 Välkommen till OrienteerPro!

OrienteerPro är din kompletta plattform för orientering - från träning till tävling.

---

## Kom Igång

### Installera Appen (PWA)

**På Desktop (Chrome/Edge):**
1. Besök OrienteerPro i webbläsaren
2. Klicka på installations-ikonen i adressfältet
3. Klicka "Installera"

**På Android:**
1. Besök OrienteerPro i Chrome
2. Tryck på menyn (tre prickar)
3. Välj "Lägg till på hemskärmen"

**På iPhone/iPad:**
1. Öppna Safari
2. Tryck på dela-knappen
3. Välj "Lägg till på hemskärmen"

### Skapa Konto

1. Gå till startsidan
2. Klicka "Logga in"
3. Välj ett alternativ:
   - **Fortsätt med Google** - Snabbast
   - **E-post & Lösenord** - Skapa eget konto

**Viktig info:**
- Din session håller i 7 dagar
- Fungerar offline efter första inloggningen
- Inget oväntat utloggning under tävlingar!

---

## Huvudfunktioner

### 1. 📅 Bläddra Tävlingar

**Hitta tävlingar:**
1. Klicka på "Tävlingar" på startsidan
2. Filtrera mellan "Kommande" och "Tidigare"
3. Klicka på en tävling för detaljer

**Tävlingsinformation:**
- Datum, tid och plats
- Arrangör
- Klassificering (Nationell, Regional, Lokal)
- Banor och klasser
- Anmälningslänkar

**Anmäl dig:**
1. Öppna tävlingsdetaljer
2. Klicka "Anmäl dig"
3. Välj klass
4. Bekräfta anmälan

---

### 2. 📍 GPS-Tracking

**Spela in träningspass:**

1. **Starta inspelning:**
   - Gå till "Mina Spår"
   - Klicka "Spela in nytt spår"
   - Ge spåret ett namn
   - Tryck "Starta inspelning"

2. **Under inspelning:**
   - Se live-statistik:
     - ⏱️ Tid
     - 📏 Distans
     - ⚡ Hastighet
     - 📍 Antal GPS-punkter
   - Nuvarande position visas

3. **Stoppa inspelning:**
   - Tryck "Stoppa inspelning"
   - Spåret sparas automatiskt

**Hantera spår:**
- **Visa på karta** - Se hela rutten
- **Exportera GPX** - För Strava/Garmin
- **Ta bort** - Radera spår

**Tips:**
- Fungerar helt offline
- Minimalt 5m mellan punkter (filtrerar brus)
- Sparas automatiskt var 10:e punkt
- Synkas till molnet när du har nätverk

---

### 3. 📡 Live Tracking

**Följ löpare i realtid:**

1. Öppna "Live Tracking" från startsidan
2. Se karta med aktiva löpare
3. Klicka på en löpare i listan för att följa
4. Kartan följer automatiskt deras position

**Funktioner:**
- Position uppdateras var 3:e sekund
- Status-indikatorer (springer/i mål)
- Kartlager kan togglas
- Följ specifika löpare

**För arrangörer:**
Live tracking kräver att deltagare har appen installerad och tracking aktiverat.

---

### 4. 🗺️ Kartor

**Ladda upp karta (Admin/Arrangör):**

1. Gå till "Admin" → "Kartimport"
2. Dra och släpp kartfil eller klicka för att välja
3. Stödda format:
   - `.omap`, `.xmap` (OpenOrienteering Mapper)
   - `.tif`, `.tiff` (GeoTIFF)
   - `.jpg`, `.png` (Med manuell georeferering)

**Efter uppladdning:**
- Kartinformation visas automatiskt
- Skala, koordinatsystem, missvisning extraheras
- Spara till biblioteket

**Tips:**
- OMAP-filer är bäst (georeferens inkluderad)
- OCAD-filer: exportera till .omap först
- Kontrollera att koordinatsystemet stämmer

---

### 5. 💳 SportIdent Tidtagning

**För arrangörer - läs SI-brickor:**

1. Anslut SportIdent-station via USB
2. Öppna "Admin" → "Tidtagning"
3. Klicka "Anslut SportIdent-station"
4. Välj rätt USB-port
5. Klicka "Läs SI-bricka"

**När bricka avläses:**
- Bricknummer visas
- Bricktyp identifieras (SI5-11, SIAC)
- Alla stämplingar extraheras
- Starttid och måltid sparas

**Registrera resultat:**
1. Kontrollera stämplingarna
2. Klicka "Registrera Resultat"
3. Välj tävling och klass
4. Bekräfta

**Hårdvarukrav:**
- SportIdent BSM7/BSM8/Master
- USB-kabel (CP210x chip)
- Chrome eller Edge (ej Safari/Firefox)
- Android: kräver USB OTG-adapter

---

### 6. ⚙️ Administration

**För Arrangörer och Admins:**

**Skapa tävling:**
1. Gå till "Admin"
2. Klicka "Ny Tävling"
3. Fyll i detaljer:
   - Namn, datum, plats
   - Arrangör
   - Klassificering
4. Spara

**Lägg till banor:**
1. Öppna tävlingen
2. Gå till "Banor"
3. Ladda upp IOF XML (från OCAD/Purple Pen)
4. Eller skapa manuellt

**Konfigurera Eventor:**
1. Gå till "Admin" → "Inställningar"
2. Ange:
   - Klubbnamn
   - Eventor Organisations-ID
   - API-nyckel (från SOFT)
3. Spara

**Ladda upp resultat:**
1. Läs alla SI-brickor
2. Gå till "Resultat"
3. Kontrollera resultat
4. Klicka "Ladda upp till Eventor"

---

## Vanliga Frågor

### Hur fungerar offline-läge?

OrienteerPro sparar allt lokalt i din webbläsare:
- ✅ GPS-spår
- ✅ Kartor (när nedladdade)
- ✅ Inloggning (7 dagar)
- ✅ Tävlingsdata

När du får nätverksåtkomst igen synkas allt automatiskt.

### Varför kan jag inte läsa SI-brickor på iPhone?

iPhones webbläsare (Safari) stödjer inte Web Serial API. Använd:
- Android-telefon eller surfplatta
- Windows/Mac-dator med Chrome/Edge
- (Framtida version kommer ha Bluetooth-stöd för iOS)

### Hur exporterar jag till Strava?

1. Gå till "Mina Spår"
2. Välj spår
3. Klicka "Exportera GPX"
4. Ladda upp GPX-filen på Strava.com

### Varför loggas jag ut efter 7 dagar?

Säkerhetsskäl - sessioner måste förn yas. Logga in igen så får du nya 7 dagar.

### Hur får jag admin-behörighet?

Kontakta din klubbadministratör. De kan ge dig arrangörs- eller admin-rättigheter.

---

## Tangentbordsgenvägar

| Genväg | Funktion |
|--------|----------|
| `Ctrl/Cmd + K` | Sök tävlingar |
| `G` sedan `H` | Hem |
| `G` sedan `E` | Events |
| `G` sedan `T` | Tracks |
| `G` sedan `A` | Admin |
| `?` | Visa alla genvägar |

---

## Tips & Tricks

### Maximera Batteritid vid GPS-tracking

- Stäng av skärmen (tracking fortsätter)
- Använd flygläge (GPS fungerar ändå)
- Minska skärmens ljusstyrka
- Stäng andra appar

### Bästa GPS-noggrannhet

- Vänta tills GPS har "fix" (15+ satelliter)
- Håll telefonen horisontellt
- Undvik tjock växtlighet över huvudet
- Kalibrerar kompass vid oppna platser

### Snabbare kartuppladdning

- Använd OMAP-format (ej OCAD direkt)
- Komprimera stora bilder först
- Ladda upp via WiFi (ej mobildata)

### Efficient SI-avläsning

- Plugga in SI-station innan du öppnar appen
- Håll brickan på stationen tills signalen
- Batch-läs flera brickor innan registrering

---

## Support

**Problem?**
- 📧 E-post: support@orienteerpro.se
- 💬 Discord: [OrienteerPro Community]
- 📖 Dokumentation: [docs.orienteerpro.se]

**Buggrapport:**
Skicka e-post med:
- Vad du försökte göra
- Vad som hände
- Skärmdump (om möjligt)
- Webbläsare och enhet

---

## Nästa Steg

1. ✅ Installera appen
2. ✅ Skapa konto
3. ✅ Spela in ditt första GPS-spår
4. ✅ Anmäl dig till en tävling
5. ✅ Utforska live tracking

**Lycka till med träningen!** 🏃‍♂️🧭

---

*Version 1.0 - 2025-12-13*
