def measurement(afdm):
    return {
        "dry_gross": round(afdm + 1.2, 3),
        "dry_tare": 0.2,
        "ash_gross": 1.2,
        "ash_tare": 0.2,
    }


def bag(bag_id, anchor_id, mesh, afdm, elevation, deployment, retrieval):
    return {
        "id": bag_id,
        "anchor_id": anchor_id,
        "site": "RIFFLE-7",
        "batch": "APR26",
        "species": "ALDER",
        "mesh": mesh,
        "cohort": "C1",
        "replicate": anchor_id,
        "elevation": elevation,
        "threshold": round(elevation + 0.1, 3),
        "deployment": deployment,
        "retrieval": retrieval,
        "loaded_mass": 10.0,
        "recovery": measurement(afdm),
        "disposition": "intact",
    }


def control(control_id, mesh):
    return {
        "id": control_id,
        "site": "RIFFLE-7",
        "batch": "APR26",
        "species": "ALDER",
        "mesh": mesh,
        "cohort": "C1",
        "loaded_mass": 10.0,
        "recovery": measurement(8.0),
    }


def baseline():
    deployment = "2026-04-01T00:00:00+00:00"
    retrieval = "2026-04-01T02:00:00+00:00"
    return {
        "id": "willow-bend-april",
        "title": "Willow Bend · April recovery",
        "datum": "WB-LOCAL",
        "elevation_precision": 0.01,
        "gap_limit_minutes": 61.0,
        "anchors": [
            {"id": "A1", "x": 14.0, "bed_elevation": 1.00},
            {"id": "A2", "x": 37.0, "bed_elevation": 0.90},
            {"id": "A3", "x": 71.0, "bed_elevation": 1.10},
        ],
        "bags": [
            bag("A1-C", "A1", "coarse", 4.0, 1.00, deployment, retrieval),
            bag("A1-F", "A1", "fine", 5.6, 1.00, deployment, retrieval),
            bag("A2-C", "A2", "coarse", 6.4, 0.90, deployment, retrieval),
            bag("A2-F", "A2", "fine", 4.8, 0.90, deployment, retrieval),
            bag("A3-C", "A3", "coarse", 3.2, 1.10, deployment, retrieval),
            bag("A3-F", "A3", "fine", 3.2, 1.10, deployment, retrieval),
        ],
        "controls": [
            control("CTRL-C1", "coarse"),
            control("CTRL-F1", "fine"),
        ],
        "stage": [
            {
                "time": "2026-04-01T00:00:00+00:00",
                "level": 1.4,
                "datum_offset": 0.0,
                "valid": True,
            },
            {
                "time": "2026-04-01T01:00:00+00:00",
                "level": 1.4,
                "datum_offset": 0.0,
                "valid": True,
            },
            {
                "time": "2026-04-01T02:00:00+00:00",
                "level": 1.4,
                "datum_offset": 0.0,
                "valid": True,
            },
        ],
    }
