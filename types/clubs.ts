/**
 * Club Types and Swedish Orienteering Clubs List
 * Pre-populated with clubs from Swedish Orienteering Federation (SOFT) districts
 */

export interface Club {
    id: string;
    name: string;
    shortName?: string;
    districtId: string;
    districtName: string;
    eventorId?: string;
    website?: string;
    location?: string;
}

export interface ClubMembership {
    odId: string;
    role: 'member' | 'admin' | 'board';
    joinedAt: string;
}

export interface District {
    id: string;
    name: string;
    shortName: string;
}

// Swedish Orienteering Districts
export const DISTRICTS: District[] = [
    { id: 'stof', name: 'Stockholms OF', shortName: 'StOF' },
    { id: 'gof', name: 'Göteborgs OF', shortName: 'GOF' },
    { id: 'skof', name: 'Skånes OF', shortName: 'SkOF' },
    { id: 'uof', name: 'Upplands OF', shortName: 'UOF' },
    { id: 'vgof', name: 'Västergötlands OF', shortName: 'VGOF' },
    { id: 'smof', name: 'Smålands OF', shortName: 'SmOF' },
    { id: 'oof', name: 'Östergötlands OF', shortName: 'ÖOF' },
    { id: 'dof', name: 'Dalarnas OF', shortName: 'DOF' },
    { id: 'vof', name: 'Värmlands OF', shortName: 'VOF' },
    { id: 'nof', name: 'Norrlands OF', shortName: 'NOF' },
    { id: 'gvof', name: 'Gävleborgs OF', shortName: 'GVOF' },
    { id: 'hlof', name: 'Hallands OF', shortName: 'HlOF' },
    { id: 'bof', name: 'Blekinges OF', shortName: 'BOF' },
    { id: 'sof', name: 'Södermanlands OF', shortName: 'SOF' },
    { id: 'vsof', name: 'Västmanlands OF', shortName: 'VsOF' },
    { id: 'nkof', name: 'Närkes OF', shortName: 'NkOF' },
    { id: 'boof', name: 'Bohusläns OF', shortName: 'BoOF' },
    { id: 'lof', name: 'Lapplands OF', shortName: 'LOF' },
    { id: 'meof', name: 'Medelpads OF', shortName: 'MeOF' },
    { id: 'anof', name: 'Ångermanlands OF', shortName: 'ÅnOF' },
    { id: 'jof', name: 'Jämtland-Härjedalens OF', shortName: 'JOF' },
    { id: 'nbof', name: 'Norrbottens OF', shortName: 'NbOF' },
    { id: 'vbof', name: 'Västerbottens OF', shortName: 'VbOF' },
    { id: 'gof2', name: 'Gotlands OF', shortName: 'GtOF' },
];

// Swedish Orienteering Clubs (major clubs per district)
export const CLUBS: Club[] = [
    // Stockholms OF
    { id: 'ok-ravinen', name: 'OK Ravinen', districtId: 'stof', districtName: 'Stockholms OF', location: 'Bromma' },
    { id: 'ifk-lidingo', name: 'IFK Lidingö SOK', districtId: 'stof', districtName: 'Stockholms OF', location: 'Lidingö' },
    { id: 'djurgarden', name: 'Djurgårdens IF OF', districtId: 'stof', districtName: 'Stockholms OF', location: 'Stockholm' },
    { id: 'ok-sodertorn', name: 'OK Södertörn', districtId: 'stof', districtName: 'Stockholms OF', location: 'Huddinge' },
    { id: 'nacka-ok', name: 'Nacka OK', districtId: 'stof', districtName: 'Stockholms OF', location: 'Nacka' },
    { id: 'ok-kansen', name: 'OK Kansen', districtId: 'stof', districtName: 'Stockholms OF', location: 'Sollentuna' },
    { id: 'sollentuna-ok', name: 'Sollentuna OK', districtId: 'stof', districtName: 'Stockholms OF', location: 'Sollentuna' },
    { id: 'ok-motionen', name: 'OK Motionen', districtId: 'stof', districtName: 'Stockholms OF', location: 'Täby' },
    { id: 'sodermalms-ok', name: 'Södermalms OK', districtId: 'stof', districtName: 'Stockholms OF', location: 'Stockholm' },
    { id: 'jarfalla-ok', name: 'Järfälla OK', districtId: 'stof', districtName: 'Stockholms OF', location: 'Järfälla' },
    { id: 'taby-ok', name: 'Täby OK', districtId: 'stof', districtName: 'Stockholms OF', location: 'Täby' },
    { id: 'sundbybergs-ik', name: 'Sundbybergs IK', districtId: 'stof', districtName: 'Stockholms OF', location: 'Sundbyberg' },
    { id: 'spanga-ok', name: 'Spånga OK', districtId: 'stof', districtName: 'Stockholms OF', location: 'Spånga' },

    // Göteborgs OF  
    { id: 'ok-gynge', name: 'OK Gynge', districtId: 'gof', districtName: 'Göteborgs OF', location: 'Göteborg' },
    { id: 'kungalvs-ok', name: 'Kungälvs OK', districtId: 'gof', districtName: 'Göteborgs OF', location: 'Kungälv' },
    { id: 'goteborgs-ok', name: 'Göteborgs OK', districtId: 'gof', districtName: 'Göteborgs OF', location: 'Göteborg' },
    { id: 'orientering-goteborg', name: 'Orientering Göteborg', districtId: 'gof', districtName: 'Göteborgs OF', location: 'Göteborg' },
    { id: 'molndals-ok', name: 'Mölndals OK', districtId: 'gof', districtName: 'Göteborgs OF', location: 'Mölndal' },
    { id: 'partille-ok', name: 'Partille OK', districtId: 'gof', districtName: 'Göteborgs OF', location: 'Partille' },

    // Skånes OF
    { id: 'ok-masen', name: 'OK Måsen', districtId: 'skof', districtName: 'Skånes OF', location: 'Malmö' },
    { id: 'lunds-ok', name: 'Lunds OK', districtId: 'skof', districtName: 'Skånes OF', location: 'Lund' },
    { id: 'helsingborgs-sok', name: 'Helsingborgs SOK', districtId: 'skof', districtName: 'Skånes OF', location: 'Helsingborg' },
    { id: 'pan-kristianstad', name: 'Pan Kristianstad', districtId: 'skof', districtName: 'Skånes OF', location: 'Kristianstad' },
    { id: 'ok-kompassen', name: 'OK Kompassen', districtId: 'skof', districtName: 'Skånes OF', location: 'Ystad' },
    { id: 'malmo-ok', name: 'Malmö OK', districtId: 'skof', districtName: 'Skånes OF', location: 'Malmö' },

    // Upplands OF
    { id: 'ok-linne', name: 'OK Linné', districtId: 'uof', districtName: 'Upplands OF', location: 'Uppsala' },
    { id: 'ik-jarl-rattvik', name: 'IK Jarl', districtId: 'uof', districtName: 'Upplands OF', location: 'Uppsala' },
    { id: 'almunge-ok', name: 'Almunge OK', districtId: 'uof', districtName: 'Upplands OF', location: 'Almunge' },
    { id: 'ifk-mora', name: 'IFK Mora OK', districtId: 'uof', districtName: 'Upplands OF', location: 'Mora' },
    { id: 'ok-kåre', name: 'OK Kåre', districtId: 'uof', districtName: 'Upplands OF', location: 'Uppsala' },

    // Västergötlands OF
    { id: 'ok-orion', name: 'OK Orion', districtId: 'vgof', districtName: 'Västergötlands OF', location: 'Borås' },
    { id: 'boras-sok', name: 'Borås SK OK', districtId: 'vgof', districtName: 'Västergötlands OF', location: 'Borås' },
    { id: 'trollhattans-sok', name: 'Trollhättans SOK', districtId: 'vgof', districtName: 'Västergötlands OF', location: 'Trollhättan' },
    { id: 'skovde-ok', name: 'Skövde OK', districtId: 'vgof', districtName: 'Västergötlands OF', location: 'Skövde' },
    { id: 'falkopings-ok', name: 'Falköpings OK', districtId: 'vgof', districtName: 'Västergötlands OF', location: 'Falköping' },

    // Smålands OF
    { id: 'ok-viljan', name: 'OK Viljan', districtId: 'smof', districtName: 'Smålands OF', location: 'Jönköping' },
    { id: 'jonkopings-sok', name: 'Jönköpings SOK', districtId: 'smof', districtName: 'Smålands OF', location: 'Jönköping' },
    { id: 'vaxjo-ok', name: 'Växjö OK', districtId: 'smof', districtName: 'Smålands OF', location: 'Växjö' },
    { id: 'kalmarsunds-ok', name: 'Kalmarsunds OK', districtId: 'smof', districtName: 'Smålands OF', location: 'Kalmar' },
    { id: 'ok-landansen', name: 'OK Landansen', districtId: 'smof', districtName: 'Smålands OF', location: 'Eksjö' },

    // Östergötlands OF
    { id: 'ok-kolansen', name: 'OK Kolansen', districtId: 'oof', districtName: 'Östergötlands OF', location: 'Linköping' },
    { id: 'linkopings-ok', name: 'Linköpings OK', districtId: 'oof', districtName: 'Östergötlands OF', location: 'Linköping' },
    { id: 'ok-motala', name: 'OK Motala', districtId: 'oof', districtName: 'Östergötlands OF', location: 'Motala' },
    { id: 'motala-aif-ol', name: 'Motala AIF OL', districtId: 'oof', districtName: 'Östergötlands OF', location: 'Motala' },
    { id: 'norrkopings-ok', name: 'Norrköpings OK', districtId: 'oof', districtName: 'Östergötlands OF', location: 'Norrköping' },

    // Dalarnas OF
    { id: 'ok-kansen-dalarna', name: 'OK Kansen', districtId: 'dof', districtName: 'Dalarnas OF', location: 'Falun' },
    { id: 'stora-tuna-ok', name: 'Stora Tuna OK', districtId: 'dof', districtName: 'Dalarnas OF', location: 'Borlänge' },
    { id: 'ik-jarl-dalarna', name: 'IK Jarl Rättvik', districtId: 'dof', districtName: 'Dalarnas OF', location: 'Rättvik' },
    { id: 'leksands-ok', name: 'Leksands OK', districtId: 'dof', districtName: 'Dalarnas OF', location: 'Leksand' },
    { id: 'malungs-if', name: 'Malungs IF OK', districtId: 'dof', districtName: 'Dalarnas OF', location: 'Malung' },

    // Värmlands OF
    { id: 'karlstads-ok', name: 'Karlstads OK', districtId: 'vof', districtName: 'Värmlands OF', location: 'Karlstad' },
    { id: 'ok-landansen-varmland', name: 'OK Ansen', districtId: 'vof', districtName: 'Värmlands OF', location: 'Säffle' },
    { id: 'sunne-ok', name: 'Sunne OK', districtId: 'vof', districtName: 'Värmlands OF', location: 'Sunne' },
    { id: 'filipstads-ok', name: 'Filipstads OK', districtId: 'vof', districtName: 'Värmlands OF', location: 'Filipstad' },

    // Gävleborgs OF
    { id: 'ok-hammaren', name: 'OK Hammaren', districtId: 'gvof', districtName: 'Gävleborgs OF', location: 'Sandviken' },
    { id: 'gavle-ok', name: 'Gävle OK', districtId: 'gvof', districtName: 'Gävleborgs OF', location: 'Gävle' },
    { id: 'hudiksvalls-ok', name: 'Hudiksvalls OK', districtId: 'gvof', districtName: 'Gävleborgs OF', location: 'Hudiksvall' },
    { id: 'soderhamns-ok', name: 'Söderhamns OK', districtId: 'gvof', districtName: 'Gävleborgs OF', location: 'Söderhamn' },

    // Hallands OF
    { id: 'ok-alansen', name: 'OK Alansen', districtId: 'hlof', districtName: 'Hallands OF', location: 'Halmstad' },
    { id: 'halmstads-ok', name: 'Halmstads OK', districtId: 'hlof', districtName: 'Hallands OF', location: 'Halmstad' },
    { id: 'falkenbergs-ok', name: 'Falkenbergs OK', districtId: 'hlof', districtName: 'Hallands OF', location: 'Falkenberg' },
    { id: 'varbergs-ok', name: 'Varbergs OK', districtId: 'hlof', districtName: 'Hallands OF', location: 'Varberg' },

    // Blekinges OF
    { id: 'kronans-ok', name: 'Kronans OK', districtId: 'bof', districtName: 'Blekinges OF', location: 'Karlskrona' },
    { id: 'karlskrona-ok', name: 'Karlskrona OK', districtId: 'bof', districtName: 'Blekinges OF', location: 'Karlskrona' },
    { id: 'ronneby-ok', name: 'Ronneby OK', districtId: 'bof', districtName: 'Blekinges OF', location: 'Ronneby' },

    // Södermanlands OF
    { id: 'eskilstuna-ok', name: 'Eskilstuna OK', districtId: 'sof', districtName: 'Södermanlands OF', location: 'Eskilstuna' },
    { id: 'nykopings-ok', name: 'Nyköpings OK', districtId: 'sof', districtName: 'Södermanlands OF', location: 'Nyköping' },
    { id: 'katrineholms-ok', name: 'Katrineholms OK', districtId: 'sof', districtName: 'Södermanlands OF', location: 'Katrineholm' },
    { id: 'stigtomta-ok', name: 'Stigtomta OK', districtId: 'sof', districtName: 'Södermanlands OF', location: 'Stigtomta' },

    // Västmanlands OF
    { id: 'vasteras-ok', name: 'Västerås OK', districtId: 'vsof', districtName: 'Västmanlands OF', location: 'Västerås' },
    { id: 'surahammars-ok', name: 'Surahammars OK', districtId: 'vsof', districtName: 'Västmanlands OF', location: 'Surahammar' },
    { id: 'koping-ok', name: 'Köpings OK', districtId: 'vsof', districtName: 'Västmanlands OF', location: 'Köping' },

    // Närkes OF
    { id: 'ok-nansen', name: 'OK Nansen', districtId: 'nkof', districtName: 'Närkes OF', location: 'Örebro' },
    { id: 'orebro-ok', name: 'Örebro OK', districtId: 'nkof', districtName: 'Närkes OF', location: 'Örebro' },
    { id: 'kumla-ok', name: 'Kumla OK', districtId: 'nkof', districtName: 'Närkes OF', location: 'Kumla' },

    // Bohusläns OF
    { id: 'uddevalla-ok', name: 'Uddevalla OK', districtId: 'boof', districtName: 'Bohusläns OF', location: 'Uddevalla' },
    { id: 'orust-ok', name: 'Orust OK', districtId: 'boof', districtName: 'Bohusläns OF', location: 'Orust' },
    { id: 'stenungsunds-ok', name: 'Stenungsunds OK', districtId: 'boof', districtName: 'Bohusläns OF', location: 'Stenungsund' },

    // Norrländska distrikt
    { id: 'sundsvalls-ok', name: 'Sundsvalls OK', districtId: 'meof', districtName: 'Medelpads OF', location: 'Sundsvall' },
    { id: 'ostersunds-ok', name: 'Östersunds OK', districtId: 'jof', districtName: 'Jämtland-Härjedalens OF', location: 'Östersund' },
    { id: 'umea-ok', name: 'Umeå OK', districtId: 'vbof', districtName: 'Västerbottens OF', location: 'Umeå' },
    { id: 'lulea-ok', name: 'Luleå OK', districtId: 'nbof', districtName: 'Norrbottens OF', location: 'Luleå' },
    { id: 'boden-bk', name: 'Bodens BK', districtId: 'nbof', districtName: 'Norrbottens OF', location: 'Boden' },
    { id: 'gallivare-ok', name: 'Gällivare OK', districtId: 'lof', districtName: 'Lapplands OF', location: 'Gällivare' },
    { id: 'kiruna-ok', name: 'Kiruna OK', districtId: 'lof', districtName: 'Lapplands OF', location: 'Kiruna' },
    { id: 'ornskoldsvik-ok', name: 'Örnsköldsviks OK', districtId: 'anof', districtName: 'Ångermanlands OF', location: 'Örnsköldsvik' },
    { id: 'solleftea-ok', name: 'Sollefteå OK', districtId: 'anof', districtName: 'Ångermanlands OF', location: 'Sollefteå' },

    // Gotlands OF
    { id: 'visbyortorna', name: 'Visbyortorna', districtId: 'gof2', districtName: 'Gotlands OF', location: 'Visby' },
    { id: 'slite-if', name: 'Slite IF', districtId: 'gof2', districtName: 'Gotlands OF', location: 'Slite' },
];

// Search clubs by name or district
export function searchClubs(query: string): Club[] {
    const q = query.toLowerCase();
    return CLUBS.filter(club =>
        club.name.toLowerCase().includes(q) ||
        club.districtName.toLowerCase().includes(q) ||
        club.location?.toLowerCase().includes(q)
    );
}

// Get clubs by district
export function getClubsByDistrict(districtId: string): Club[] {
    return CLUBS.filter(club => club.districtId === districtId);
}

// Find club by ID
export function findClubById(clubId: string): Club | undefined {
    return CLUBS.find(club => club.id === clubId);
}
