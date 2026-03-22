# layer2.py — FGS Scoring, Confidence Gating, Conflict Detection

# ── Thresholds ────────────────────────────────────────────────────────────────

LOW_CONFIDENCE_FLAG_THRESHOLD   = 2   # at or below this → score with flag
LOW_CONFIDENCE_REJECT_THRESHOLD = 3   # at or above this → reject entirely

LIGHT_SQUINT_ORBITAL_SCORE      = 2   # orbital tightening must be this to trigger check
LIGHT_SQUINT_OTHER_MAX          = 2   # sum of remaining 4 dimensions must be at or below this
LIGHT_SQUINT_ORBITAL_ADJUSTMENT = 1   # how much we reduce orbital score when flag fires

# ── Tier thresholds (grounded in FGS clinical literature) ─────────────────────

TIERS = [
    (0,  2,  "comfortable",          "Your cat appears comfortable with no significant signs of discomfort."),
    (3,  4,  "mild_discomfort",      "Your cat may be experiencing mild discomfort. Monitor closely at home."),
    (5,  6,  "moderate_discomfort",  "Your cat is showing signs of moderate discomfort. Consider contacting your vet."),
    (7,  10, "significant_discomfort", "Your cat is showing significant signs of distress. Veterinary attention is recommended."),
]

# ── Choice → numeric score ─────────────────────────────────────────────────────

CHOICE_MAP = {"A": 0, "B": 1, "C": 2}

DIMENSIONS = [
    "ear_position",
    "orbital_tightening",
    "muzzle_tension",
    "whisker_position",
    "head_position",
]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _count_low_confidence(vision_result: dict) -> int:
    return sum(
        1 for dim in DIMENSIONS
        if vision_result.get(dim, {}).get("confidence", "low") == "low"
        or vision_result.get(dim, {}).get("choice", "unclear") == "unclear"
    )


def _map_score(choice: str) -> int | None:
    """Returns None if the choice is unreadable or unclear."""
    return CHOICE_MAP.get(choice.upper()) if choice and choice.upper() in CHOICE_MAP else None


def _assign_tier(total: int) -> tuple[str, str]:
    for low, high, tier_id, description in TIERS:
        if low <= total <= high:
            return tier_id, description
    return "significant_discomfort", TIERS[-1][3]


# ── Main scoring function ──────────────────────────────────────────────────────

def score_fgs(vision_result: dict) -> dict:
    """
    Takes the raw Layer 1 vision_result dict and returns a structured
    assessment result for Layer 3 to consume.

    Steps:
      0. Image check gating  — reject if no cat, multiple cats, or wrong animal
      1. Confidence gating   — reject if too many dimensions are unclear
      2. Score mapping       — A/B/C → 0/1/2 per dimension
      3. Conflict detection  — light squint check, adjust + flag if triggered
      4. Total + tier        — sum scores, assign clinical tier
    """

    # ── Step 0: Image check gating ────────────────────────────────────────────

    image_check   = vision_result.get("image_check", {})
    contains_cat  = image_check.get("contains_cat", False)
    single_cat    = image_check.get("single_cat", False)
    face_visible  = image_check.get("face_visible", False)

    if not contains_cat:
        return {
            "status":           "no_cat_detected",
            "total_score":      None,
            "max_possible":     None,
            "tier":             None,
            "tier_description": None,
            "dimension_scores": None,
            "flags":            ["no_cat_detected"],
            "justifications":   {},
            "rejection_reason": (
                "No cat was detected in this image. Please upload a clear photo "
                "of your cat's face and try again."
            ),
        }

    if not single_cat:
        return {
            "status":           "multiple_cats_detected",
            "total_score":      None,
            "max_possible":     None,
            "tier":             None,
            "tier_description": None,
            "dimension_scores": None,
            "flags":            ["multiple_cats_detected"],
            "justifications":   {},
            "rejection_reason": (
                "Multiple cats were detected in this photo. The Feline Grimace "
                "Scale requires one cat per assessment. Please submit a separate "
                "photo for each cat."
            ),
        }

    # ── Step 1: Confidence gating ─────────────────────────────────────────────

    low_confidence_count = _count_low_confidence(vision_result)

    if low_confidence_count >= LOW_CONFIDENCE_REJECT_THRESHOLD:
        return {
            "status":           "insufficient_image_quality",
            "total_score":      None,
            "max_possible":     None,
            "tier":             None,
            "tier_description": None,
            "dimension_scores": None,
            "flags":            ["insufficient_image_quality"],
            "justifications":   {
                dim: vision_result.get(dim, {}).get("justification", "")
                for dim in DIMENSIONS
            },
            "rejection_reason": (
                f"{low_confidence_count} of 5 dimensions could not be assessed clearly. "
                "Please retake the photo in good lighting with the cat's face fully visible."
            ),
        }

    # ── Step 2: Score mapping ─────────────────────────────────────────────────

    dimension_scores = {}
    for dim in DIMENSIONS:
        raw        = vision_result.get(dim, {})
        choice     = raw.get("choice", "")
        confidence = raw.get("confidence", "low")
        score      = _map_score(choice)
        uncertain  = confidence == "low" or score is None

        dimension_scores[dim] = {
            "score":     score if score is not None else 0,  # treat unreadable as 0
            "uncertain": uncertain,
            "choice":    choice,
        }

    # ── Step 3: Conflict detection — light squint check ───────────────────────

    flags = []

    if low_confidence_count > 0:
        flags.append("partially_assessed")

    orbital_score  = dimension_scores["orbital_tightening"]["score"]
    other_dims     = [d for d in DIMENSIONS if d != "orbital_tightening"]
    other_sum      = sum(dimension_scores[d]["score"] for d in other_dims)

    if orbital_score >= LIGHT_SQUINT_ORBITAL_SCORE and other_sum <= LIGHT_SQUINT_OTHER_MAX:
        flags.append("possible_light_squint")
        # Warn AND lower: reduce orbital score by adjustment constant, floor at 0
        adjusted_orbital = max(0, orbital_score - LIGHT_SQUINT_ORBITAL_ADJUSTMENT)
        dimension_scores["orbital_tightening"]["score"]    = adjusted_orbital
        dimension_scores["orbital_tightening"]["adjusted"] = True

    # Catch a clean-sweep zero on a partially assessed image
    all_zero = all(dimension_scores[d]["score"] == 0 for d in DIMENSIONS)
    if all_zero and low_confidence_count > 0:
        flags.append("verify_image_quality")

    # ── Step 4: Total score + tier ────────────────────────────────────────────

    scored_dims   = [d for d in DIMENSIONS if not dimension_scores[d]["uncertain"]]
    max_possible  = len(DIMENSIONS) * 2  # always report out of 10 for clarity
    total_score   = sum(dimension_scores[d]["score"] for d in DIMENSIONS)

    tier_id, tier_description = _assign_tier(total_score)

    # ── Assemble result ───────────────────────────────────────────────────────

    return {
        "status":           "assessed",
        "total_score":      total_score,
        "max_possible":     max_possible,
        "tier":             tier_id,
        "tier_description": tier_description,
        "dimension_scores": dimension_scores,
        "flags":            flags,
        "justifications": {
            dim: vision_result.get(dim, {}).get("justification", "")
            for dim in DIMENSIONS
        },
        "rejection_reason": None,
    }