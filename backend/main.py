from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from PIL import Image
from openai import OpenAI
from layer2 import score_fgs
from layer3 import generate_owner_response
import base64
import uuid
import json
import io
import os

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://whisker-watch-zeta.vercel.app/",
        "http://localhost:5173"
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_TYPES  = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE  = 10 * 1024 * 1024  # 10MB hard limit before we even look at it
MAX_DIMENSION  = 800               # Longest edge capped at 800px before encoding
JPEG_QUALITY   = 85                # Enough quality to read facial features clearly

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

FGS_PROMPT = """You are assessing a cat's facial expression using the Feline Grimace Scale (FGS).

STEP 1 — IMAGE CHECK
Before scoring anything, answer these three questions about the image:
- contains_cat: true if there is at least one cat visible, false otherwise
- single_cat: true if there is exactly one cat, false if there are two or more
- face_visible: true if the cat's face is clearly the primary subject and fully visible

If contains_cat is false OR single_cat is false, still return the full JSON below
but fill all FGS dimension choices as "unclear" and confidence as "low".
Do NOT attempt to score a non-cat animal or multiple cats.

---

STEP 2 — FGS SCORING (only if contains_cat and single_cat are both true)
Examine the image and evaluate each of the five dimensions below.
For each dimension provide:
- choice: A, B, or C
- justification: one sentence describing what you observed
- confidence: high, medium, or low (based on how clearly visible this feature was)

1. EAR POSITION
A - Ears forward and relaxed, naturally upright
B - Ears slightly rotated outward or beginning to flatten
C - Ears fully flattened against the head, rotated outward like airplane wings

2. ORBITAL TIGHTENING
A - Eyes open normally, relaxed
B - Eyes partially closed, visible squinting
C - Eyes squeezed nearly or fully shut

3. MUZZLE TENSION
A - Muzzle rounded and soft
B - Muzzle slightly tense or elliptical in shape
C - Muzzle visibly tense, drawn, or flattened

4. WHISKER POSITION
A - Whiskers loose and fanned naturally to the sides
B - Whiskers slightly forward or beginning to clump together
C - Whiskers pulled straight forward and bunched toward the nose

5. HEAD POSITION
A - Head up, carried above shoulder level
B - Head at shoulder level
C - Head hanging below shoulders, chin possibly tucked

---

Respond in this exact JSON format with no extra text, no markdown, no code fences:
{
  "image_check": {
    "contains_cat":  true,
    "single_cat":    true,
    "face_visible":  true
  },
  "ear_position":       { "choice": "", "justification": "", "confidence": "" },
  "orbital_tightening": { "choice": "", "justification": "", "confidence": "" },
  "muzzle_tension":     { "choice": "", "justification": "", "confidence": "" },
  "whisker_position":   { "choice": "", "justification": "", "confidence": "" },
  "head_position":      { "choice": "", "justification": "", "confidence": "" }
}
"""


def compress_image(contents: bytes) -> tuple[bytes, str]:
    """
    Resize and compress the uploaded image before sending to the vision API.

    1. The longest edge is capped at MAX_DIMENSION — a 4000px phone photo
       becomes 800px, slashing token consumption dramatically.
    2. Everything is re-encoded as JPEG at quality 85 — enough fidelity to
       read subtle facial features, small enough to stay well under rate limits.

    Returns the compressed bytes and a base64 data URL string for OpenAI.
    """
    image = Image.open(io.BytesIO(contents))

    # JPEG does not support alpha channels — convert RGBA/palette to RGB first
    if image.mode in ("RGBA", "P"):
        image = image.convert("RGB")

    # Resize proportionally if either dimension exceeds the cap
    width, height = image.size
    if max(width, height) > MAX_DIMENSION:
        scale    = MAX_DIMENSION / max(width, height)
        new_size = (int(width * scale), int(height * scale))
        image    = image.resize(new_size, Image.LANCZOS)

    # Write compressed JPEG into memory — no disk I/O needed
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=JPEG_QUALITY, optimize=True)

    return buffer.getvalue()


def call_vision_api(contents: bytes, content_type: str) -> dict:
    """
    Compress the image, base64-encode it, and send to GPT-4o with the FGS prompt.
    OpenAI expects the image as a data URL: data:image/jpeg;base64,<encoded>
    Returns a parsed dict with one key per FGS dimension.
    """
    compressed_bytes = compress_image(contents)
    image_b64        = base64.standard_b64encode(compressed_bytes).decode("utf-8")
    data_url         = f"data:image/jpeg;base64,{image_b64}"

    response = client.chat.completions.create(
        model="gpt-4o",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type":      "image_url",
                        "image_url": {"url": data_url},
                    },
                    {
                        "type": "text",
                        "text": FGS_PROMPT,
                    },
                ],
            }
        ],
    )

    raw_text  = response.choices[0].message.content

    # GPT-4o occasionally wraps JSON in markdown code fences despite being
    # told not to — strip them defensively before parsing
    cleaned   = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[-2] if "```" in cleaned else cleaned
        cleaned = cleaned.lstrip("json").strip()

    vision_result = json.loads(cleaned)
    return vision_result


@app.post("/hackathon")
async def hackathon(file: UploadFile = File(...)):

    # Validate file type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{file.content_type}'. Accepted: JPEG, PNG, WEBP."
        )

    # Read raw bytes and validate size before doing anything else
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="File too large. Maximum size is 10MB."
        )

    original_size_kb = round(len(contents) / 1024, 1)
    submission_id    = str(uuid.uuid4())

    # --- Layer 1: compress then send to vision API ---
    try:
        vision_result = call_vision_api(contents, file.content_type)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail="Vision API returned a response that could not be parsed as JSON."
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Vision API call failed: {str(e)}"
        )

    # --- Layer 2: score, gate, and detect conflicts ---
    fgs_result = score_fgs(vision_result)

    # --- Layer 3: generate owner-facing response ---
    owner_response = generate_owner_response(fgs_result)

    return {
        "submission_id":    submission_id,
        "filename":         file.filename,
        "original_size_kb": original_size_kb,
        "status":           owner_response["status"],
        "owner_response":   owner_response,
        "fgs_result":       fgs_result,      # keep raw result for debugging
    }