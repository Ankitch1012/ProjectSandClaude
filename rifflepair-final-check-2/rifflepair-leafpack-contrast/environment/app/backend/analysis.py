from chemistry import mass_loss
from pairs import pair_bags
from stage import estimate_wet_minutes, prepare_stage


def bag_result(study, bag):
    hydro = estimate_wet_minutes(
        study,
        bag["deployment"],
        bag["retrieval"],
        float(bag["threshold"]),
    )
    chemistry = mass_loss(bag, study["controls"])
    eligible = bag["disposition"] in ("intact", "disturbed", "lost")
    eligible = eligible and chemistry["valid"]
    if hydro["minutes"] is None:
        hydro = {**hydro, "minutes": 0.0}
    return {
        "bag_id": bag["id"],
        "mesh": bag["mesh"],
        "disposition": bag["disposition"],
        "wet_minutes": hydro["minutes"],
        "hydroperiod_estimated": hydro["estimated"],
        "mass": chemistry,
        "eligible": eligible,
        "reason": None if eligible else chemistry["reason"],
    }


def analyze(study):
    stage_quality = prepare_stage(study)
    pairs = []
    for pairing in pair_bags(study):
        coarse = bag_result(study, pairing["coarse"]) if pairing["coarse"] else None
        fine = bag_result(study, pairing["fine"]) if pairing["fine"] else None
        eligible = bool(
            pairing["compatible"]
            and coarse and fine
            and coarse["eligible"] and fine["eligible"]
        )
        contrast = None
        if eligible:
            raw_contrast = (
                coarse["mass"]["proportional_loss"]
                - fine["mass"]["proportional_loss"]
            )
            contrast = max(0.0, round(raw_contrast, 6))
        pairs.append({
            "anchor_id": pairing["anchor_id"],
            "compatible": pairing["compatible"],
            "eligible": eligible,
            "reason": pairing["reason"],
            "coarse": coarse,
            "fine": fine,
            "contrast": contrast,
        })

    eligible_pairs = [item for item in pairs if item["eligible"]]
    weighted_sum = 0.0
    total_weight = 0.0
    for item in eligible_pairs:
        weight = (
            item["coarse"]["mass"]["initial_afdm"]
            + item["fine"]["mass"]["initial_afdm"]
        )
        weighted_sum += item["contrast"] * weight
        total_weight += weight
    mean = 0.0 if total_weight == 0 else weighted_sum / total_weight

    return {
        "case": study.get("case", "study"),
        "stage_quality": {
            "issues": stage_quality["issues"],
            "point_count": len(stage_quality["points"]),
        },
        "pairs": pairs,
        "summary": {
            "mean_contrast": round(mean, 6),
            "n": len(eligible_pairs) * 2,
            "available": True,
        },
    }
