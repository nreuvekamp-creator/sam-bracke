#!/usr/bin/env node
// Genereert VOORBEELDDATA voor data/strava.json (deterministisch, vaste seed).
// Wordt later vervangen door een nachtelijke GitHub Action met echte Strava-data.
// Echte races (bron: research/data.md, DUV / running.be / VRT):
//  - Legends Trail 350, Ardennen: 19-23 feb 2026, 350 km in 70:26
//  - Another One Bites the Dust, Bierbeek: 3 juli 2026, 258,78 km (34 u)
//  - BK 24 uur Mechelen (R24u Ultraloop): 12-13 sep 2026, 258,437 km
//  - Upfront Last Man Standing Terschelling: start vr 2 okt 17:00, 61 rondes x 6,7 km = 408,7 km;
//    ronde 61 start ma 5 okt 05:00 lokale tijd (data.md: "finish maandag ca. 05:00")
// Gebruik: node scripts/make-sample-strava.js  (schrijft data/strava.json)
const fs = require('fs');
const path = require('path');

let seed = 20261005;
function rnd() { // mulberry32
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const r1 = (x) => Math.round(x * 10) / 10;

const races = {
  '2026-02-19': 60.0, '2026-02-20': 120.0, '2026-02-21': 110.0, '2026-02-22': 60.0, // Legends Trail (350 km)
  '2026-07-03': 180.0, '2026-07-04': 78.8,                            // Bierbeek (258,8 km)
  '2026-09-12': 125.0, '2026-09-13': 133.4,                           // BK 24u Mechelen (258,4 km)
  '2026-10-02': 46.9, '2026-10-03': 160.8, '2026-10-04': 160.8, '2026-10-05': 40.2, // Terschelling (61 x 6,7 = 408,7 km)
};
// Herstel (laag/geen volume) en taper rond races
const recovery = new Set();
const taper = new Set();
function addRange(set, start, n) { const d = new Date(start + 'T12:00:00Z'); for (let i = 0; i < n; i++) { set.add(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); } }
addRange(recovery, '2026-02-23', 10); addRange(taper, '2026-02-12', 7);
addRange(recovery, '2026-07-05', 7);  addRange(taper, '2026-06-28', 5);
addRange(recovery, '2026-09-14', 7);  addRange(taper, '2026-09-07', 5);
addRange(taper, '2026-09-27', 5);

const days = [];
let runs = 0, hours = 0, elevation = 0, km = 0;
const d = new Date('2026-01-01T12:00:00Z');
const end = new Date('2026-10-05T12:00:00Z');
while (d <= end) {
  const iso = d.toISOString().slice(0, 10);
  const dow = d.getUTCDay(); // 0 = zo
  const week = Math.floor((d - new Date('2026-01-01T12:00:00Z')) / 864e5 / 7);
  let k = 0;
  if (races[iso] !== undefined) {
    k = races[iso]; runs += 1; hours += k / 6.5;
  } else {
    const loadFactor = (week % 4 === 3) ? 0.75 : 1.0; // elke 4e week lichter
    const pattern = [34, 0, 16, 21, 14, 18, 28][dow]; // zo lang, ma rust
    k = pattern * loadFactor * (0.85 + rnd() * 0.3);
    if (dow === 3 && rnd() < 0.5) k += 8; // soms dubbele dag
    if (rnd() < 0.06) k = 0; // onverwachte rustdag
    if (taper.has(iso)) k *= 0.55;
    if (recovery.has(iso)) k = rnd() < 0.5 ? 0 : 5 + rnd() * 5;
    k = r1(k);
    if (k > 0) { runs += 1; hours += k / 10.5; }
  }
  if (k > 0) elevation += Math.round(k * (8 + rnd() * 10));
  km += k;
  days.push({ date: iso, km: r1(k) });
  d.setUTCDate(d.getUTCDate() + 1);
}

const out = {
  sample: true,
  generated: '2026-10-05T18:00:00Z',
  lastRun: {
    name: 'Last Man Standing Terschelling, ronde 61 (winst)',
    km: 6.7,
    start: '2026-10-05T03:00:00Z', // 05:00 lokale tijd (CEST)
    end: '2026-10-05T03:46:00Z',
  },
  days,
  year: { km: Math.round(km), runs, hours: Math.round(hours), elevation },
};
const file = path.join(__dirname, '..', 'data', 'strava.json');
fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
// controle: weekvolumes
const weeks = [];
for (let i = 0; i < days.length; i += 7) weeks.push(r1(days.slice(i, i + 7).reduce((s, x) => s + x.km, 0)));
console.log('jaar km', Math.round(km), 'runs', runs, '\nweken', weeks.join(' '));
