#!/usr/bin/env python3

import json
import os
import re
import sys

LOG = "/logs/verifier/test_output.txt"
REWARD_TXT = "/logs/verifier/reward.txt"
REWARD_JSON = "/logs/verifier/reward.json"
DEFECT_TAG_RE = re.compile(r"\[(D\d+)\]")
P2P_TAG = "[P2P]"


def tag_key(name):
    match = re.fullmatch(r"D(\d+)", name)
    return (0, int(match.group(1))) if match else (1, 0)


def write_outputs(reward, scores):
    payload = {"reward": int(reward)}
    for name in sorted(scores, key=tag_key):
        payload[name] = int(scores[name])
    os.makedirs(os.path.dirname(REWARD_JSON), exist_ok=True)
    with open(REWARD_JSON, "w", encoding="utf-8") as output:
        json.dump(payload, output)
        output.write("\n")
    with open(REWARD_TXT, "w", encoding="utf-8") as output:
        output.write(f"{int(reward)}\n")
    return payload


def iter_specs(report):
    def walk(suite):
        yield from suite.get("specs", []) or []
        for child in suite.get("suites", []) or []:
            yield from walk(child)
    for suite in report.get("suites", []) or []:
        yield from walk(suite)


def spec_passed(spec):
    tests = spec.get("tests", []) or []
    return bool(tests) and all(
        test.get("results")
        and test["results"][-1].get("status") == "passed"
        for test in tests
    )


def main():
    try:
        text = open(LOG, "r", encoding="utf-8", errors="replace").read()
    except FileNotFoundError:
        write_outputs(0, {})
        return 1
    match = re.search(r"PLAYWRIGHT_EXIT=(\d+)", text)
    report_match = re.search(r"PLAYWRIGHT_JSON=(\S+)", text)
    if not match or not report_match or not os.path.isfile(report_match.group(1)):
        write_outputs(0, {})
        return 1

    with open(report_match.group(1), "r", encoding="utf-8") as report_file:
        report = json.load(report_file)
    results = {
        spec.get("title", ""): spec_passed(spec)
        for spec in iter_specs(report)
    }
    grouped = {}
    for title, passed in results.items():
        for tag in DEFECT_TAG_RE.findall(title):
            grouped.setdefault(tag, []).append(passed)
        if P2P_TAG in title:
            grouped.setdefault("P2P", []).append(passed)
    scores = {
        tag: 1 if all(values) else 0
        for tag, values in grouped.items()
    }
    saw_defect = any(re.fullmatch(r"D\d+", tag) for tag in scores)
    reward = int(
        int(match.group(1)) == 0
        and bool(results)
        and all(results.values())
        and saw_defect
    )
    payload = write_outputs(reward, scores)
    if reward:
        print(f"PASS: all {len(results)} behavioral tests passed")
        print(f"REWARD_JSON={json.dumps(payload)}")
        return 0
    print("FAIL: not every behavioral test passed")
    print(f"REWARD_JSON={json.dumps(payload)}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
