# layer3.py — Owner-facing response generation (template-based, no API call)

# ── Tier templates ─────────────────────────────────────────────────────────────
# Each tier has a headline and a base message.
# Elevated dimension justifications and flags are slotted in dynamically.

TIER_TEMPLATES = {
    "comfortable": {
        "headline":       "Your cat appears comfortable",
        "base_message":   (
            "Based on the photo, your cat is showing no significant signs of "
            "discomfort. Their facial features look relaxed and at ease."
        ),
        "vet_advice":     (
            "No immediate action needed. Keep an eye on their behaviour over the "
            "next day or two and contact your vet if anything changes."
        ),
        "urgency":        "low",
    },
    "mild_discomfort": {
        "headline":       "Your cat may be experiencing mild discomfort",
        "base_message":   (
            "We noticed some subtle signs in your cat's facial expression that "
            "suggest they may not be feeling their best right now."
        ),
        "vet_advice":     (
            "Monitor your cat closely at home over the next 12–24 hours. If the "
            "signs persist or worsen, contact your vet for guidance."
        ),
        "urgency":        "medium",
    },
    "moderate_discomfort": {
        "headline":       "Your cat is showing signs of moderate discomfort",
        "base_message":   (
            "Several facial indicators suggest your cat is experiencing a "
            "meaningful level of discomfort that warrants attention."
        ),
        "vet_advice":     (
            "We recommend contacting your vet within the next 24 hours. "
            "If your cat stops eating, hides, or the signs worsen, seek care sooner."
        ),
        "urgency":        "medium-high",
    },
    "significant_discomfort": {
        "headline":       "Your cat needs veterinary attention",
        "base_message":   (
            "Your cat's facial expression is showing strong indicators of "
            "significant discomfort or distress across multiple areas."
        ),
        "vet_advice":     (
            "Please contact your vet as soon as possible or visit an emergency "
            "animal clinic if your regular vet is unavailable."
        ),
        "urgency":        "high",
    },
}

# ── Dimension display names ────────────────────────────────────────────────────

DIMENSION_LABELS = {
    "ear_position":       "Ear position",
    "orbital_tightening": "Eye tightening",
    "muzzle_tension":     "Muzzle tension",
    "whisker_position":   "Whisker position",
    "head_position":      "Head position",
}

# ── Flag messages ──────────────────────────────────────────────────────────────

FLAG_MESSAGES = {
    "possible_light_squint": (
        "Note: your cat's eye squinting may partly be a reaction to camera flash "
        "or bright light rather than pain. We have adjusted the score to account "
        "for this, but consider retaking the photo in softer lighting to confirm."
    ),
    "partially_assessed": (
        "Note: one or more facial features were not fully visible in this photo. "
        "The assessment is based on the dimensions we could clearly see."
    ),
    "verify_image_quality": (
        "Note: all features scored as relaxed, but some were not clearly visible. "
        "If your cat seems unwell, try retaking the photo with better lighting "
        "and the face fully in frame."
    ),
}

# ── Score to plain English ─────────────────────────────────────────────────────

SCORE_DESCRIPTORS = {0: "relaxed", 1: "mildly elevated", 2: "significantly elevated"}


# ── Main function ──────────────────────────────────────────────────────────────

def generate_owner_response(fgs_result: dict) -> dict:
    """
    Takes the structured Layer 2 result and returns a fully formed
    owner-facing response dict ready to be returned from the endpoint.

    Handles two cases:
      - status == "insufficient_image_quality" → friendly rejection message
      - status == "assessed"                   → full tiered response
    """

    # ── Rejection path ─────────────────────────────────────────────────────────

    REJECTION_HEADLINES = {
        "insufficient_image_quality": "We couldn't assess this photo",
        "no_cat_detected":            "No cat detected in this photo",
        "multiple_cats_detected":     "Multiple cats detected",
    }

    if fgs_result["status"] in REJECTION_HEADLINES:
        return {
            "status":        fgs_result["status"],
            "headline":      REJECTION_HEADLINES[fgs_result["status"]],
            "message":       fgs_result.get("rejection_reason", (
                "Please retake the photo and try again."
            )),
            "vet_advice":    None,
            "urgency":       None,
            "score_summary": None,
            "observations":  None,
            "flags":         fgs_result.get("flags", []),
            "flag_messages": [],
        }

    # ── Assessed path ──────────────────────────────────────────────────────────

    tier       = fgs_result["tier"]
    template   = TIER_TEMPLATES.get(tier, TIER_TEMPLATES["significant_discomfort"])
    dim_scores = fgs_result["dimension_scores"]
    flags      = fgs_result.get("flags", [])

    # Build elevated observations — only surface dimensions scoring 1 or 2
    # with their original justification text from Layer 1
    observations = []
    for dim in ["ear_position", "orbital_tightening", "muzzle_tension",
                "whisker_position", "head_position"]:
        entry      = dim_scores.get(dim, {})
        score      = entry.get("score", 0)
        uncertain  = entry.get("uncertain", False)
        adjusted   = entry.get("adjusted", False)
        label      = DIMENSION_LABELS[dim]
        descriptor = SCORE_DESCRIPTORS.get(score, "relaxed")
        justification = fgs_result["justifications"].get(dim, "")

        if score >= 1:
            obs = {
                "dimension":     label,
                "score":         score,
                "descriptor":    descriptor,
                "justification": justification,
                "uncertain":     uncertain,
                "adjusted":      adjusted,
            }
            observations.append(obs)

    # Collect human-readable flag messages for any active flags
    flag_messages = [
        FLAG_MESSAGES[f] for f in flags if f in FLAG_MESSAGES
    ]

    # Score summary line e.g. "6 out of 10"
    total      = fgs_result["total_score"]
    max_score  = fgs_result["max_possible"]
    score_summary = f"{total} out of {max_score}"

    return {
        "status":        "assessed",
        "headline":      template["headline"],
        "message":       template["base_message"],
        "vet_advice":    template["vet_advice"],
        "urgency":       template["urgency"],
        "tier":          tier,
        "score_summary": score_summary,
        "observations":  observations,   # only elevated dimensions
        "flags":         flags,
        "flag_messages": flag_messages,
    }