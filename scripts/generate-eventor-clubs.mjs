#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { XMLParser } from 'fast-xml-parser';

const EVENTOR_API_BASE = 'https://eventor.orientering.se/api';

function normalizeText(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value && typeof value === 'object' && typeof value._text === 'string') return value._text.trim();
  return '';
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function extractOrganisationType(org) {
  const raw = org?.OrganisationType;
  if (!raw) return 'Club';
  if (typeof raw === 'string') return raw;
  if (typeof raw?.['@_type'] === 'string') return raw['@_type'];
  if (typeof raw?._text === 'string') return raw._text;
  return 'Club';
}

function extractOrganisationTypeId(org) {
  const raw = org?.OrganisationTypeId;
  const id = normalizeText(raw);
  const parsed = Number(id);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapOrganisationType(typeId) {
  if (typeId === 1) return 'Federation';
  if (typeId === 2) return 'District';
  if (typeId === 3) return 'Club';
  if (typeId === 5) return 'InternationalFederation';
  return 'Unknown';
}

function extractCity(addressValue) {
  const addresses = toArray(addressValue);
  for (const address of addresses) {
    const city = normalizeText(address?.['@_city'] ?? address?.City);
    if (city) return city;
  }
  return undefined;
}

function buildDistrictLookup(orgById) {
  const memo = new Map();

  function findDistrict(orgId, guard = new Set()) {
    if (!orgId) return null;
    if (memo.has(orgId)) return memo.get(orgId);
    if (guard.has(orgId)) return null;

    const org = orgById.get(orgId);
    if (!org) return null;

    if (org.type === 'District') {
      memo.set(orgId, org);
      return org;
    }

    guard.add(orgId);
    const parentId = normalizeText(org?.ParentOrganisation?.OrganisationId);
    const district = findDistrict(parentId, guard);
    memo.set(orgId, district || null);
    return district || null;
  }

  return findDistrict;
}

async function main() {
  const apiKey = process.env.EVENTOR_API_KEY;

  if (!apiKey) {
    console.error('EVENTOR_API_KEY saknas.');
    process.exit(1);
  }

  const response = await fetch(`${EVENTOR_API_BASE}/organisations`, {
    headers: { ApiKey: apiKey },
  });

  if (!response.ok) {
    throw new Error(`Eventor API error: ${response.status}`);
  }

  const xml = await response.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '_text',
  });

  const parsed = parser.parse(xml);
  const organisationsRaw = toArray(parsed?.OrganisationList?.Organisation);

  const organisations = organisationsRaw.map((org) => {
    const id = normalizeText(org.OrganisationId);
    const name = normalizeText(org.Name);
    const shortName = normalizeText(org.ShortName);
    const typeId = extractOrganisationTypeId(org);
    const type = mapOrganisationType(typeId);
    const parentOrganisationId = normalizeText(org?.ParentOrganisation?.OrganisationId);
    const location = extractCity(org?.Address);

    return {
      id,
      name,
      shortName: shortName || undefined,
      typeId,
      type,
      parentOrganisationId: parentOrganisationId || undefined,
      location,
    };
  }).filter((org) => org.id && org.name);

  const orgById = new Map(organisations.map((org) => [org.id, org]));
  const findDistrict = buildDistrictLookup(orgById);

  const districts = organisations
    .filter((org) => org.type === 'District')
    .map((district) => ({
      id: `eventor-${district.id}`,
      name: district.name,
      shortName: district.shortName || district.name,
      eventorId: district.id,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'sv-SE'));

  const districtByEventorId = new Map(districts.map((district) => [district.eventorId, district]));

  const clubs = organisations
    .filter((org) => org.type === 'Club')
    .map((club) => {
      const districtOrg = findDistrict(club.id);
      const district = districtOrg ? districtByEventorId.get(districtOrg.id) : undefined;

      return {
        id: `eventor-${club.id}`,
        name: club.name,
        shortName: club.shortName || undefined,
        districtId: district?.id || 'eventor-unknown',
        districtName: district?.name || 'Okänt distrikt',
        eventorId: club.id,
        location: club.location,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'sv-SE'));

  const output = {
    source: 'Eventor API /organisations',
    generatedAt: new Date().toISOString(),
    districtCount: districts.length,
    clubCount: clubs.length,
    districts,
    clubs,
  };

  const outputPath = resolve(process.cwd(), 'data/eventor-clubs.generated.json');
  await writeFile(outputPath, JSON.stringify(output, null, 2), 'utf8');

  console.log(`Skrev ${clubs.length} klubbar och ${districts.length} distrikt till ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
