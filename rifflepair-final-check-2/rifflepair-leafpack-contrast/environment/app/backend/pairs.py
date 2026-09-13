def pair_bags(study):
    bags = study["bags"]
    pairs = []
    for index in range(0, len(bags), 2):
        members = bags[index:index + 2]
        if len(members) < 2:
            pairs.append({
                "anchor_id": members[0]["anchor_id"],
                "coarse": members[0] if members[0]["mesh"] == "coarse" else None,
                "fine": members[0] if members[0]["mesh"] == "fine" else None,
                "compatible": False,
                "reason": "mate is missing",
            })
            continue
        coarse = next((item for item in members if item["mesh"] == "coarse"), None)
        fine = next((item for item in members if item["mesh"] == "fine"), None)
        compatible = bool(
            coarse and fine
            and coarse["elevation"] == fine["elevation"]
            and coarse["deployment"] == fine["deployment"]
            and coarse["retrieval"] == fine["retrieval"]
        )
        pairs.append({
            "anchor_id": members[0]["anchor_id"],
            "coarse": coarse,
            "fine": fine,
            "compatible": compatible,
            "reason": None if compatible else "pair fields do not match",
        })
    return pairs
