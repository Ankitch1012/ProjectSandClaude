from datetime import datetime, timezone


def parse_time(value):
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("stage timestamps require an explicit timezone")
    return parsed.astimezone(timezone.utc)


def prepare_stage(study):
    grouped = {}
    for reading in study["stage"]:
        if not reading.get("valid", True):
            continue
        time = parse_time(reading["time"])
        corrected = float(reading["level"]) - float(reading.get("datum_offset", 0.0))
        grouped[time] = corrected

    points = sorted(grouped.items(), key=lambda item: item[0])
    gap_limit = float(study["gap_limit_minutes"])
    issues = []
    for left, right in zip(points, points[1:]):
        minutes = (right[0] - left[0]).total_seconds() / 60.0
        if minutes >= gap_limit:
            issues.append("stage observations exceed the usable gap limit")
    return {"points": points, "issues": issues}


def estimate_wet_minutes(study, deployment, retrieval, threshold):
    prepared = prepare_stage(study)
    if prepared["issues"]:
        return {"minutes": None, "estimated": True, "reason": prepared["issues"][0]}

    start = parse_time(deployment)
    finish = parse_time(retrieval)
    points = prepared["points"]
    if not points or start >= finish:
        return {"minutes": None, "estimated": True, "reason": "window is unavailable"}

    if start < points[0][0]:
        points = [(start, points[0][1]), *points]
    if finish > points[-1][0]:
        points = [*points, (finish, points[-1][1])]

    wet = 0.0
    for left, right in zip(points, points[1:]):
        if right[0] <= start or left[0] >= finish:
            continue
        segment_minutes = (right[0] - left[0]).total_seconds() / 60.0
        if left[1] >= threshold and right[1] >= threshold:
            wet += round(segment_minutes)

    return {"minutes": round(wet, 1), "estimated": True, "reason": None}
