#!/usr/bin/env python3
"""Summarize a bounded paired MCP plan run; never call this full-answer latency."""
import argparse
import hashlib
import json
import math
import statistics
from datetime import datetime
from pathlib import Path


def summarize(receipts, window):
    runs = [r for r in receipts if r.get('name') == 'pulse_run_analysis_plan' and datetime.fromisoformat(r['at'].replace('Z', '+00:00')) >= datetime.fromisoformat(window['startedAt'].replace('Z', '+00:00'))][:window['requestedRuns']]
    times = [r['elapsedMs'] for r in runs]
    outcomes = []
    for receipt in runs:
        data = receipt.get('data', {})
        steps = data.get('steps', [])
        actual = {s['id']: s.get('result', {}).get('data', {}).get('rows', []) for s in steps}
        expected = {'town_comparison': {'63000040': 107888, '63000030': 111460}, 'county_comparison': {'63000': 12.053068333162585, '65000': 13.01270053475936}}
        matches = all(len(actual.get(step, [])) == len(values) and all(any(row.get('area_code') == code and isinstance(row.get('value'), (float, int)) and math.isclose(row['value'], value, rel_tol=1e-12, abs_tol=1e-10) for row in actual.get(step, [])) for code, value in values.items()) for step, values in expected.items())
        fingerprint = hashlib.sha256(json.dumps(actual, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        outcomes.append({'elapsedMs': receipt['elapsedMs'], 'status': data.get('status'), 'reason': data.get('reason'), 'steps': len(steps), 'oracleMatches': matches, 'rowFingerprint': fingerprint, 'passed': not receipt.get('isError') and data.get('status') == 'complete' and len(steps) == 6 and all(s.get('status') == 'complete' for s in steps) and matches})
    ordered = sorted(times)
    return {'scope': window['scope'], 'startedAt': window['startedAt'], 'requestedRuns': window['requestedRuns'], 'observedRuns': len(runs), 'complete': len(runs) == window['requestedRuns'], 'successes': sum(x['passed'] for x in outcomes), 'failures': sum(not x['passed'] for x in outcomes), 'latencyIncludesFailures': True, 'latencyMs': {'median': statistics.median(times), 'p95NearestRank': ordered[math.ceil(.95 * len(ordered)) - 1], 'max': max(times)} if times else None, 'equalRowFingerprints': len({x['rowFingerprint'] for x in outcomes if x['passed']}) == 1, 'runs': outcomes}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--receipts', type=Path, required=True)
    parser.add_argument('--window', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    window = json.loads(args.window.read_text())
    receipts = [json.loads(line) for line in args.receipts.read_text().splitlines() if line.strip()]
    report = summarize(receipts, window)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k != 'runs'}, ensure_ascii=False))
    raise SystemExit(0 if report['complete'] and report['failures'] == 0 and report['equalRowFingerprints'] else 1)
