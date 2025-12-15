/**
 * IOF Data Standard 3.0 TypeScript Definitions
 * International Orienteering Federation XML Schema
 */

// ============= Base Types =============

export interface Person {
  id?: string;
  name: PersonName;
  birthDate?: string;
  nationality?: Country;
}

export interface PersonName {
  family: string;
  given: string;
}

export interface Organisation {
  id?: string;
  name: string;
  shortName?: string;
  country?: Country;
  type?: OrganisationType;
}

export interface Country {
  code: string; // ISO 3166-1 alpha-3
  name?: string;
}

export interface ControlCard {
  number: string;
  system?: ControlCardSystem;
}

export type ControlCardSystem = 'SI' | 'Emit' | 'Other';
export type OrganisationType = 'IOF' | 'Federation' | 'Club';

// ============= Event & Competition =============

export interface Event {
  id?: string;
  name: string;
  startTime: DateAndOptionalTime;
  endTime?: DateAndOptionalTime;
  status?: EventStatus;
  classification?: EventClassification;
  organiser?: Organisation[];
  classes?: Class[];
  courses?: Course[];
}

export type EventStatus = 'Planned' | 'Applied' | 'Approved' | 'Created' | 'Canceled';
export type EventClassification = 'International' | 'National' | 'Regional' | 'Local' | 'Club';

export interface DateAndOptionalTime {
  date: string; // ISO 8601 date
  time?: string; // ISO 8601 time
}

// ============= Classes & Courses =============

export interface Class {
  id?: string;
  name: string;
  shortName?: string;
  minAge?: number;
  maxAge?: number;
  sex?: 'M' | 'F';
  status?: ClassStatus;
  courses?: CourseAssignment[];
}

export type ClassStatus = 'Normal' | 'Divided' | 'Joined' | 'Invalidated' | 'InvalidatedNoFee';

export interface CourseAssignment {
  courseId: string;
  courseName?: string;
}

export interface Course {
  id?: string;
  name: string;
  courseFamily?: string;
  length?: number; // meters
  climb?: number; // meters
  controls: Control[];
}

export interface Control {
  id?: string;
  code?: string; // Control code (number on map)
  type?: ControlType;
  position?: GeoPosition;
}

export type ControlType = 'Start' | 'Control' | 'Finish' | 'CrossingPoint' | 'EndOfMarkedRoute';

export interface GeoPosition {
  lat: number;
  lng: number;
  alt?: number;
}

// ============= Competitors & Entries =============

export interface Competitor extends Person {
  organisation?: Organisation;
  controlCard?: ControlCard[];
  class?: ClassAssignment;
}

export interface ClassAssignment {
  id?: string;
  name: string;
}

export interface Entry {
  id?: string;
  person: Person;
  organisation?: Organisation;
  controlCard?: ControlCard[];
  class: ClassAssignment;
  entryTime?: DateAndOptionalTime;
  modifyTime?: DateAndOptionalTime;
}

// ============= Start List =============

export interface StartList {
  event: Event;
  classStart: ClassStart[];
}

export interface ClassStart {
  class: Class;
  course?: Course;
  personStart: PersonStart[];
}

export interface PersonStart {
  person: Person;
  organisation?: Organisation;
  controlCard?: ControlCard[];
  start: Start;
}

export interface Start {
  startTime?: DateAndOptionalTime;
  courseAssignment?: CourseAssignment;
  bib?: string;
}

// ============= Results =============

export interface ResultList {
  event: Event;
  classResult: ClassResult[];
  createTime?: DateAndOptionalTime;
  status?: ResultStatus;
}

export type ResultStatus = 'Complete' | 'Snapshot' | 'Delta';

export interface ClassResult {
  class: Class;
  course?: Course;
  personResult: PersonResult[];
}

export interface PersonResult {
  person: Person;
  organisation?: Organisation;
  controlCard?: ControlCard[];
  result: Result;
  bib?: string;
}

export interface Result {
  startTime?: DateAndOptionalTime;
  finishTime?: DateAndOptionalTime;
  time?: number; // seconds
  timeBehind?: number; // seconds
  position?: number;
  status: ResultStatus;
  splitTime?: SplitTime[];
  controlAnswer?: ControlAnswer[];
  course?: CourseAssignment;
}

export type CompetitorStatus =
  | 'OK' // Approved
  | 'Finished' // Finished but not yet checked
  | 'MissingPunch' // MP - Missing punch
  | 'Disqualified' // DSQ
  | 'DidNotFinish' // DNF
  | 'Active' // Currently competing
  | 'Inactive' // Not started yet
  | 'OverTime' // Over max time
  | 'SportingWithdrawal' // Withdrew
  | 'NotCompeting' // DNS
  | 'Moved' // Moved to another class
  | 'MovedUp' // Moved up to longer course
  | 'DidNotStart' // DNS
  | 'DidNotEnter' // Did not enter
  | 'Cancelled'; // Entry cancelled

export interface SplitTime {
  controlCode: string;
  time: number; // seconds from start
  status?: SplitTimeStatus;
}

export type SplitTimeStatus = 'OK' | 'Missing' | 'Additional';

export interface ControlAnswer {
  controlCode: string;
  answer: string;
}

// ============= Course Data (Banläggning) =============

export interface CourseData {
  event?: Event;
  raceCourseData: RaceCourseData[];
}

export interface RaceCourseData {
  map?: Map;
  control?: ControlDefinition[];
  course?: CourseDefinition[];
}

export interface Map {
  id?: string;
  image?: MapImage;
  scale?: number;
  mapPositionTopLeft?: MapPosition;
  mapPositionBottomRight?: MapPosition;
}

export interface MapImage {
  mediaType?: string; // MIME type
  imageData?: string; // Base64
  url?: string;
}

export interface MapPosition {
  x: number; // meters
  y: number; // meters
  lat?: number;
  lng?: number;
}

export interface ControlDefinition extends Control {
  mapPosition?: MapPosition;
  allControls?: boolean; // Rogaining
}

export interface CourseDefinition extends Course {
  mapId?: string;
  firstControlCode?: string;
}

// ============= Extensions (Eventor-specific) =============

export interface Extensions {
  [key: string]: any;
}

// Helper type for including extensions
export interface WithExtensions<T> {
  data: T;
  extensions?: Extensions;
}

// ============= XML Wrapper Types =============

export interface EventList {
  event: Event[];
}

export interface CompetitorList {
  competitor: Competitor[];
}

export interface EntryList {
  event: Event;
  entry: Entry[];
}
