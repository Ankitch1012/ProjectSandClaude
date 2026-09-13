def recovered_afdm(measurement):
    if not measurement:
        return {"value": 0.0, "valid": True, "reason": None}
    dry = float(measurement["dry_gross"]) - float(measurement["dry_tare"])
    ash = float(measurement["ash_gross"])
    value = max(0.0, dry - ash)
    return {"value": round(value, 4), "valid": True, "reason": None}


def matching_controls(bag, controls):
    return [
        item for item in controls
        if item["site"] == bag["site"]
        and item["species"] == bag["species"]
    ]


def control_ratio(bag, controls):
    matches = matching_controls(bag, controls)
    if not matches:
        return {"value": 1.0, "valid": True, "reason": None}

    total_recovered = 0.0
    total_loaded = 0.0
    for item in matches:
        recovered = recovered_afdm(item.get("recovery"))
        total_recovered += recovered["value"]
        total_loaded += float(item.get("loaded_mass", 0.0))
    if total_loaded <= 0:
        return {"value": 1.0, "valid": True, "reason": None}
    return {
        "value": round(total_recovered / total_loaded, 6),
        "valid": True,
        "reason": None,
    }


def mass_loss(bag, controls):
    recovered = recovered_afdm(bag.get("recovery"))
    ratio = control_ratio(bag, controls)
    initial = float(bag.get("loaded_mass", 0.0)) * ratio["value"]
    if initial <= 0:
        initial = 1.0
    loss = 1.0 - (recovered["value"] / initial)
    return {
        "recovered_afdm": recovered["value"],
        "control_ratio": ratio["value"],
        "initial_afdm": round(initial, 4),
        "proportional_loss": round(loss, 6),
        "valid": recovered["valid"] and ratio["valid"],
        "reason": recovered["reason"] or ratio["reason"],
    }
