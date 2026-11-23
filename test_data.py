"""
Tariqhnama / History Atlas - Local Data & Integrity Test Suite
Run: python test_data.py
"""

import json
import sys
from pathlib import Path

def test_project():
    root = Path(__file__).parent
    data_dir = root / 'data'
    
    passed = 0
    failed = 0
    
    def log_pass(msg):
        nonlocal passed
        passed += 1
        print(f"  [PASS] {msg}")

    def log_fail(msg):
        nonlocal failed
        failed += 1
        print(f"  [FAIL] {msg}")

    print("==================================================")
    print(" Tariqhnama Data Integrity & File Verification")
    print("==================================================\n")

    # 1. Check Core HTML & Asset Files
    print("1. Checking Core Web Assets...")
    core_files = [
        'index.html',
        'atlas.html',
        'living-manuscript-v2.html',
        'app.js',
        'manuscript-v2.js',
        'manuscript-v2.css',
        'styles.css'
    ]
    for filename in core_files:
        p = root / filename
        if p.exists() and p.stat().st_size > 0:
            log_pass(f"Core file exists: {filename} ({p.stat().st_size:,} bytes)")
        else:
            log_fail(f"Missing or empty core file: {filename}")

    # 2. Check JSON Datasets Syntax
    print("\n2. Checking JSON Syntax & Loading Datasets...")
    json_files = ['events.json', 'people.json', 'places.json', 'sources.json']
    datasets = {}
    for filename in json_files:
        p = data_dir / filename
        if not p.exists():
            log_fail(f"Dataset file missing: data/{filename}")
            continue
        try:
            with open(p, 'r', encoding='utf-8') as f:
                datasets[filename] = json.load(f)
            log_pass(f"Valid JSON in data/{filename} ({len(datasets[filename])} records)")
        except Exception as e:
            log_fail(f"Invalid JSON in data/{filename}: {e}")

    if len(datasets) != len(json_files):
        print("\nAborting referential integrity checks due to missing/invalid JSON files.")
        return failed == 0

    # 3. Check ID Uniqueness
    print("\n3. Checking ID Uniqueness across Datasets...")
    event_ids = set()
    for e in datasets['events.json']:
        eid = e.get('id')
        if not eid or eid in event_ids:
            log_fail(f"Duplicate or empty event ID: {eid}")
        else:
            event_ids.add(eid)
    log_pass(f"All {len(event_ids)} event IDs are unique.")

    people_ids = set()
    for p in datasets['people.json']:
        pid = p.get('id')
        if not pid or pid in people_ids:
            log_fail(f"Duplicate or empty person ID: {pid}")
        else:
            people_ids.add(pid)
    log_pass(f"All {len(people_ids)} person IDs are unique.")

    place_ids = set()
    for pl in datasets['places.json']:
        plid = pl.get('id')
        if not plid or plid in place_ids:
            log_fail(f"Duplicate or empty place ID: {plid}")
        else:
            place_ids.add(plid)
    log_pass(f"All {len(place_ids)} place IDs are unique.")

    source_ids = set()
    for s in datasets['sources.json']:
        sid = s.get('id')
        if not sid or sid in source_ids:
            log_fail(f"Duplicate or empty source ID: {sid}")
        else:
            source_ids.add(sid)
    log_pass(f"All {len(source_ids)} source IDs are unique.")

    # 4. Check Referential Integrity (Foreign Keys)
    print("\n4. Verifying Referential Integrity (Zero Orphan Keys)...")
    missing_people = []
    missing_places = []
    missing_sources = []

    for e in datasets['events.json']:
        eid = e.get('id', 'UNKNOWN')
        for pid in e.get('people', []):
            if pid not in people_ids:
                missing_people.append((eid, pid))
        for plid in e.get('places', []):
            if plid not in place_ids:
                missing_places.append((eid, plid))
        for sid in e.get('sources', []):
            if sid not in source_ids:
                missing_sources.append((eid, sid))

    for p in datasets['people.json']:
        pid = p.get('id', 'UNKNOWN')
        for sid in p.get('sources', []):
            if sid not in source_ids:
                missing_sources.append((f"person:{pid}", sid))

    if not missing_people:
        log_pass("All event -> people references resolve.")
    else:
        for eid, pid in missing_people[:5]:
            log_fail(f"Event {eid} references non-existent person ID: {pid}")

    if not missing_places:
        log_pass("All event -> places references resolve.")
    else:
        for eid, plid in missing_places[:5]:
            log_fail(f"Event {eid} references non-existent place ID: {plid}")

    if not missing_sources:
        log_pass("All event/person -> sources references resolve.")
    else:
        for item, sid in missing_sources[:5]:
            log_fail(f"{item} references non-existent source ID: {sid}")

    # 5. Check Coordinates in Places
    print("\n5. Checking Geographic Coordinates...")
    coord_errors = 0
    for pl in datasets['places.json']:
        lat = pl.get('lat')
        lon = pl.get('lon') if 'lon' in pl else pl.get('lng')
        if lat is None or lon is None:
            coord_errors += 1
            log_fail(f"Place {pl.get('id')} missing coordinates.")
        elif not (-90 <= float(lat) <= 90 and -180 <= float(lon) <= 180):
            coord_errors += 1
            log_fail(f"Place {pl.get('id')} invalid coordinates: ({lat}, {lon})")
    if coord_errors == 0:
        log_pass(f"All {len(datasets['places.json'])} places have valid GPS coordinates (lat, lon).")

    print("\n==================================================")
    print(f" Summary: {passed} PASSED, {failed} FAILED")
    print("==================================================")
    
    return failed == 0

if __name__ == '__main__':
    success = test_project()
    sys.exit(0 if success else 1)
