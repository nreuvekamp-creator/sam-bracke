#!/usr/bin/env python3
"""Haalt de openbare Strava-embeds van Sams races op en maakt er eigen data + beelden van.

Bron: content.json -> stravaEmbeds [{label, sub, id, token}] (Sam gaf toestemming voor zijn Strava-content).
Uit:  data/strava-races.json  +  img/strava/{id}-map.jpg en {id}-photo.jpg (max 900 px, JPEG).

Alleen waarden die letterlijk in de embed staan worden opgenomen; ontbreekt iets, dan blijft het veld weg.
Gebruik (vanuit de map site/):  python3 scripts/fetch-strava-races.py
Vereist: Python 3 + Pillow.
"""
import html
import io
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, 'data', 'content.json')
OUT_JSON = os.path.join(ROOT, 'data', 'strava-races.json')
IMG_DIR = os.path.join(ROOT, 'img', 'strava')
MAX_PX = 900
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'


def get(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': UA})
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read()
    except urllib.error.URLError as ex:
        # macOS-Python mist soms CA-certificaten: val terug op curl (systeem-certificaten)
        if 'CERTIFICATE' not in str(ex):
            raise
        return subprocess.run(['curl', '-sSfL', '--max-time', '30', '-A', UA, url],
                              check=True, capture_output=True).stdout


def text(s):
    return html.unescape(re.sub(r'<[^>]+>', '', s)).strip()


def first(pattern, h):
    m = re.search(pattern, h, re.S)
    return text(m.group(1)) if m else None


def largest(srcset_or_src):
    """Kies de grootste URL uit een srcSet ('url 538w, url 1076w')."""
    best, best_w = None, -1
    for part in srcset_or_src.split(','):
        bits = part.strip().split()
        if not bits:
            continue
        w = int(bits[1][:-1]) if len(bits) > 1 and bits[1].endswith('w') else 0
        if w > best_w:
            best, best_w = bits[0], w
    return html.unescape(best) if best else None


def media_items(h):
    """[(type, url)] in volgorde van de carrousel; video's leveren hun thumbnail."""
    out = []
    for m in re.finditer(r'data-media-type="(\w+)"(.*?)(?=data-media-type="|\Z)', h, re.S):
        kind, chunk = m.group(1), m.group(2)
        img = re.search(r'<img class="full-res"[^>]*?(?:srcSet|srcset)="([^"]+)"', chunk) or \
            re.search(r'<img class="full-res"[^>]*?src="([^"]+)"', chunk)
        if img:
            out.append((kind, largest(img.group(1))))
            continue
        thumb = re.search(r'background:url\((https://[^)]+thumbnails/[^)]+)\)', chunk)
        if thumb:
            out.append((kind, html.unescape(thumb.group(1))))
    return out


def save_img(url, path):
    im = Image.open(io.BytesIO(get(url)))
    im = im.convert('RGB')
    im.thumbnail((MAX_PX, MAX_PX), Image.LANCZOS)
    im.save(path, 'JPEG', quality=82, optimize=True, progressive=True)
    return im.size


def parse_stats(h):
    stats = dict((text(k), text(v)) for k, v in re.findall(
        r'class="stat-label">(.*?)</div>\s*<div class="stat-value">(.*?)</div>', h, re.S))
    out = {}
    d = stats.get('Distance')
    if d:
        m = re.fullmatch(r'([\d,]+(?:\.\d+)?)\s*km', d)
        if m:
            out['distance'] = float(m.group(1).replace(',', ''))
    t = stats.get('Time') or stats.get('Moving Time') or stats.get('Elapsed Time')
    if t:
        m = re.fullmatch(r'(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?', t)
        if m and any(m.groups()):
            hh, mm, ss = (int(x or 0) for x in m.groups())
            out['time'] = '%d:%02d' % (hh, mm) if not ss else '%d:%02d:%02d' % (hh, mm, ss)
    p = stats.get('Pace')
    if p:
        m = re.fullmatch(r'(\d+:\d{2})\s*/km', p)
        if m:
            out['pace'] = m.group(1)
    e = stats.get('Elev Gain') or stats.get('Elevation Gain')
    if e:
        m = re.fullmatch(r'([\d,]+)\s*m', e)
        if m:
            out['elevation'] = int(m.group(1).replace(',', ''))
    return out, stats


def main():
    embeds = json.load(open(CONTENT, encoding='utf-8')).get('stravaEmbeds') or []
    os.makedirs(IMG_DIR, exist_ok=True)
    races = []
    for e in embeds:
        rid, tok = str(e.get('id', '')), str(e.get('token', ''))
        if not re.fullmatch(r'\d+', rid) or not re.fullmatch(r'[\w-]+', tok):
            continue
        url = 'https://strava-embeds.com/activity/%s?style=standard&fromEmbed=false&token=%s' % (rid, tok)
        try:
            h = get(url).decode('utf-8', 'replace')
        except Exception as ex:  # noqa: BLE001
            print('!! %s: ophalen mislukt (%s)' % (rid, ex), file=sys.stderr)
            continue
        race = {'id': rid, 'label': e.get('label'), 'sub': e.get('sub')}
        title = first(r'class="activity-name">(.*?)</h1>', h)
        if title:
            race['title'] = title
        ds = first(r'class="activity-date">(.*?)</div>', h)
        if ds:
            try:
                race['date'] = datetime.strptime(ds, '%B %d, %Y').strftime('%Y-%m-%d')
            except ValueError:
                pass
        stats, raw = parse_stats(h)
        race.update(stats)

        media = media_items(h)
        maps = [u for k, u in media if k == 'MapImage']
        photos = [u for k, u in media if k == 'Photo'] or [u for k, u in media if k == 'Video']
        if maps:
            p = os.path.join(IMG_DIR, rid + '-map.jpg')
            save_img(maps[0], p)
            race['map'] = 'img/strava/%s-map.jpg' % rid
        if photos:
            p = os.path.join(IMG_DIR, rid + '-photo.jpg')
            save_img(photos[0], p)
            race['photo'] = 'img/strava/%s-photo.jpg' % rid
        race['url'] = 'https://www.strava.com/activities/%s' % rid
        races.append({k: v for k, v in race.items() if v not in (None, '')})
        print('ok %s  %-28s raw=%s  ->  %s' % (rid, e.get('label'), raw,
              {k: race[k] for k in ('date', 'distance', 'time', 'pace', 'elevation') if k in race}))

    if not races:
        print('geen races opgehaald; %s blijft ongewijzigd' % os.path.relpath(OUT_JSON, ROOT), file=sys.stderr)
        sys.exit(1)
    with open(OUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(races, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print('geschreven: %s (%d races)' % (os.path.relpath(OUT_JSON, ROOT), len(races)))


if __name__ == '__main__':
    main()
