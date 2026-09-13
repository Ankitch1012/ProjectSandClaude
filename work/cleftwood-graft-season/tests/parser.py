#!/usr/bin/env python3

import json
import os
import re
import sys

LOG = "/logs/verifier/test_output.txt"
REWARD_TXT = "/logs/verifier/reward.txt"
REWARD_JSON = "/logs/verifier/reward.json"

DEFECT_TAG_RE = re.compile(r"\[(D\d+)\]")
DEFECT_KEY_RE = re.compile(r"D\d+")
P2P_TAG = "[P2P]"


def _tag_sort_key(name):
    m = re.fullmatch(r"D(\d+)", name)
    return (0, int(m.group(1))) if m else (1, 0)


def _write_outputs(reward, defects):
    payload = {"reward": int(reward)}
    for name in sorted(defects, key=_tag_sort_key):
        payload[name] = int(defects[name])
    try:
        os.makedirs(os.path.dirname(REWARD_JSON), exist_ok=True)
    except OSError:
        pass
    try:
        with open(REWARD_JSON, "w", encoding="utf-8") as fh:
            json.dump(payload, fh)
            fh.write("\n")
    except OSError:
        pass
    try:
        with open(REWARD_TXT, "w", encoding="utf-8") as fh:
            fh.write(f"{int(reward)}\n")
    except OSError:
        pass
    return payload


def _find_json_report(text):
    m = re.search(r"PLAYWRIGHT_JSON=(\S+)", text)
    if m and os.path.isfile(m.group(1)):
        return m.group(1)
    fallback = "/logs/verifier/playwright_results.json"
    if os.path.isfile(fallback):
        return fallback
    return None


def _iter_specs(report):
    def walk(suite):
        for spec in suite.get("specs", []) or []:
            yield spec
        for child in suite.get("suites", []) or []:
            yield from walk(child)

    for suite in report.get("suites", []) or []:
        yield from walk(suite)


def _spec_passed(spec):
    tests = spec.get("tests", []) or []
    if not tests:
        return False
    for test in tests:
        results = test.get("results", []) or []
        if not results:
            return False
        if results[-1].get("status") != "passed":
            return False
    return True


def _results_from_json(path):
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        report = json.load(fh)
    results = {}
    for spec in _iter_specs(report):
        title = spec.get("title", "")
        results[title] = _spec_passed(spec)
    return results


def _results_from_list_output(text):
    results = {}
    pass_glyphs = ("✓", "✔")
    fail_glyphs = ("✘", "✗", "×")
    for line in text.splitlines():
        tag = re.search(r"\[(?:D\d+|P2P|F2P)\][^\n]*", line)
        if not tag:
            continue
        title = tag.group(0).strip()
        if any(g in line for g in pass_glyphs):
            results[title] = True
        elif any(g in line for g in fail_glyphs) or re.search(r"\bfailed\b", line, re.I):
            results[title] = False
    return results


def _score_defects(results):
    seen = {}
    for title, passed in results.items():
        for tag in DEFECT_TAG_RE.findall(title):
            seen.setdefault(tag, []).append(passed)
        if P2P_TAG in title:
            seen.setdefault("P2P", []).append(passed)
    scored = {tag: (1 if all(vals) else 0) for tag, vals in seen.items()}
    saw_any_defect = any(DEFECT_KEY_RE.fullmatch(t) for t in scored)
    return scored, saw_any_defect


def main() -> int:
    try:
        with open(LOG, "r", encoding="utf-8", errors="replace") as fh:
            text = fh.read()
    except FileNotFoundError:
        print("FAIL: verifier output not found")
        _write_outputs(0, {})
        return 1

    if "TEST_INTEGRITY=FAIL" in text:
        print("FAIL: existing test files were modified or deleted -- run rejected")
        _write_outputs(0, {})
        return 1

    m = re.search(r"PLAYWRIGHT_EXIT=(\d+)", text)
    if not m:
        print("FAIL: Playwright did not run to completion")
        _write_outputs(0, {})
        return 1
    exit_code = int(m.group(1))

    results = {}
    json_path = _find_json_report(text)
    if json_path:
        try:
            results = _results_from_json(json_path)
        except (json.JSONDecodeError, OSError, KeyError, TypeError):
            results = {}
    if not results:
        results = _results_from_list_output(text)

    scored, saw_any_defect = _score_defects(results)

    all_passed = bool(results) and all(results.values())
    reward = 1 if (exit_code == 0 and all_passed and saw_any_defect) else 0

    payload = _write_outputs(reward, scored)

    if reward == 1:
        print(f"PASS: all {len(results)} behavioral tests passed")
        print(f"REWARD_JSON={json.dumps(payload)}")
        return 0

    if exit_code != 0:
        print(f"FAIL: Playwright reported test failures (exit code {exit_code})")
    elif not results:
        print("FAIL: could not determine per-test results")
    elif not saw_any_defect:
        print("FAIL: no [Dn]-tagged test was found -- check the spec's test titles")
    else:
        failed = [t for t in sorted(scored, key=_tag_sort_key) if scored[t] != 1]
        print(f"FAIL: not every behavioral test passed (failing: {', '.join(failed) or 'unknown'})")
    print(f"REWARD_JSON={json.dumps(payload)}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
