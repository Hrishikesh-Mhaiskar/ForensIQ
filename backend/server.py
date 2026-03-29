"""
Crime Scene YOLOE Analyzer — Flask Backend
==========================================
Run:  python server.py
Then open the frontend React app (served separately or via npm dev server).

Requirements:
    pip install flask flask-cors ultralytics opencv-python pillow
    # Download model weights before starting:
    # wget -O yoloe-v8l-seg.pt https://huggingface.co/jameslahm/yoloe/resolve/main/yoloe-v8l-seg.pt
"""

import os
import cv2
import base64
import traceback
from pathlib import Path

from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLOE

# ── Config ────────────────────────────────────────────────────────────────────
MODEL_PATH   = os.environ.get("YOLOE_MODEL", "yoloe-v8l-seg.pt")
UPLOAD_DIR   = Path("uploads")
ANNOTATED_DIR = Path("annotated")
PORT         = int(os.environ.get("PORT", 5000))

UPLOAD_DIR.mkdir(exist_ok=True)
ANNOTATED_DIR.mkdir(exist_ok=True)

# ── Load model once at startup ────────────────────────────────────────────────
print(f"Loading YOLOE model from: {MODEL_PATH}")
model = YOLOE(MODEL_PATH)
model.eval()
print("✓ Model loaded and ready")

# ── Evidence prompts (from notebook) ─────────────────────────────────────────
EVIDENCE_PROMPTS = [
    # VICTIM / HUMAN PRESENCE
    {"prompt": "person",       "priority": "HIGH", "category": "VICTIM",      "reason": "possible victim or suspect presence"},
    {"prompt": "body",         "priority": "HIGH", "category": "VICTIM",      "reason": "victim body at scene"},
    {"prompt": "hand",         "priority": "MED",  "category": "VICTIM",      "reason": "possible contact evidence"},
    {"prompt": "face",         "priority": "LOW",  "category": "VICTIM",      "reason": "identity-related evidence"},
    {"prompt": "rope",         "priority": "HIGH", "category": "VICTIM",      "reason": "possible restraint evidence"},
    {"prompt": "handcuffs",    "priority": "MED",  "category": "VICTIM",      "reason": "restraint tool present"},
    # WEAPONS
    {"prompt": "gun",          "priority": "HIGH", "category": "WEAPON",      "reason": "possible firearm weapon"},
    {"prompt": "knife",        "priority": "HIGH", "category": "WEAPON",      "reason": "possible stabbing weapon"},
    {"prompt": "stabbed knife","priority": "HIGH", "category": "WEAPON",      "reason": "possible stabbing weapon"},
    {"prompt": "rifle",        "priority": "HIGH", "category": "WEAPON",      "reason": "long firearm present"},
    {"prompt": "hammer",       "priority": "HIGH", "category": "WEAPON",      "reason": "possible blunt weapon"},
    {"prompt": "axe",          "priority": "HIGH", "category": "WEAPON",      "reason": "possible heavy weapon"},
    {"prompt": "crowbar",      "priority": "HIGH", "category": "WEAPON",      "reason": "possible forced entry tool"},
    {"prompt": "bat",          "priority": "HIGH", "category": "WEAPON",      "reason": "possible blunt-force object"},
    {"prompt": "scissors",     "priority": "MED",  "category": "WEAPON",      "reason": "possible sharp object"},
    {"prompt": "bottle",       "priority": "MED",  "category": "WEAPON",      "reason": "possible improvised weapon"},
    # BLOOD / FLUID EVIDENCE
    {"prompt": "red bed",      "priority": "HIGH", "category": "DISTURBANCE", "reason": "possible struggle location"},
    {"prompt": "blood on bed", "priority": "HIGH", "category": "DISTURBANCE", "reason": "possible struggle location"},
    {"prompt": "blood",        "priority": "HIGH", "category": "BIOLOGICAL",  "reason": "possible biological trace evidence"},
    {"prompt": "blood stain",  "priority": "HIGH", "category": "BIOLOGICAL",  "reason": "visible blood trace"},
    {"prompt": "red",          "priority": "MED",  "category": "BIOLOGICAL",  "reason": "possible fluid trace"},
    {"prompt": "spill",        "priority": "LOW",  "category": "BIOLOGICAL",  "reason": "possible liquid evidence"},
    # DOCUMENT / MESSAGE EVIDENCE
    {"prompt": "paper",               "priority": "MED",  "category": "DOCUMENT",    "reason": "possible written evidence"},
    {"prompt": "note",                "priority": "MED",  "category": "DOCUMENT",    "reason": "possible suspect message"},
    {"prompt": "writing",             "priority": "MED",  "category": "DOCUMENT",    "reason": "possible wall or surface message"},
    {"prompt": "book",                "priority": "MED",  "category": "DOCUMENT",    "reason": "possible contextual evidence"},
    {"prompt": "map",                 "priority": "MED",  "category": "DOCUMENT",    "reason": "possible planning evidence"},
    {"prompt": "writing on Mirror",   "priority": "HIGH", "category": "DOCUMENT",    "reason": "possible wall or surface message"},
    # FURNITURE DISTURBANCE
    {"prompt": "fallen chair","priority": "HIGH", "category": "DISTURBANCE", "reason": "possible struggle indicator"},
    {"prompt": "chair",       "priority": "MED",  "category": "DISTURBANCE", "reason": "possible struggle indicator"},
    {"prompt": "table",       "priority": "MED",  "category": "DISTURBANCE", "reason": "possible displaced surface evidence"},
    {"prompt": "lamp",        "priority": "LOW",  "category": "DISTURBANCE", "reason": "possible disturbance marker"},
    {"prompt": "drawer",      "priority": "HIGH", "category": "DISTURBANCE", "reason": "possible search or theft evidence"},
    {"prompt": "cabinet",     "priority": "MED",  "category": "DISTURBANCE", "reason": "possible forced storage access"},
    {"prompt": "bed",         "priority": "MED",  "category": "DISTURBANCE", "reason": "possible struggle location"},
    {"prompt": "sofa",        "priority": "LOW",  "category": "DISTURBANCE", "reason": "possible displacement area"},
    # PERSONAL EFFECTS
    {"prompt": "shoe",        "priority": "MED",  "category": "PERSONAL",    "reason": "possible footwear evidence"},
    {"prompt": "bag",         "priority": "MED",  "category": "PERSONAL",    "reason": "possible personal belonging"},
    {"prompt": "wallet",      "priority": "HIGH", "category": "PERSONAL",    "reason": "possible robbery indicator"},
    {"prompt": "phone",       "priority": "HIGH", "category": "PERSONAL",    "reason": "possible communication evidence"},
    {"prompt": "keys",        "priority": "MED",  "category": "PERSONAL",    "reason": "possible entry access evidence"},
    {"prompt": "watch",       "priority": "LOW",  "category": "PERSONAL",    "reason": "possible timeline indicator"},
    {"prompt": "glasses",     "priority": "LOW",  "category": "PERSONAL",    "reason": "possible struggle displacement"},
    # ENTRY / EXIT
    {"prompt": "door",        "priority": "HIGH", "category": "ENTRY",       "reason": "possible entry or exit route"},
    {"prompt": "window",      "priority": "HIGH", "category": "ENTRY",       "reason": "possible entry or escape route"},
    {"prompt": "glass",       "priority": "MED",  "category": "ENTRY",       "reason": "possible breakage evidence"},
    {"prompt": "lock",        "priority": "MED",  "category": "ENTRY",       "reason": "possible forced access indicator"},
    # TRACE EVIDENCE
    {"prompt": "footprint",   "priority": "HIGH", "category": "TRACE",       "reason": "possible movement pattern evidence"},
    {"prompt": "handprint",   "priority": "HIGH", "category": "TRACE",       "reason": "possible contact surface evidence"},
    {"prompt": "fingerprint", "priority": "MED",  "category": "TRACE",       "reason": "possible identity evidence"},
    {"prompt": "mark",        "priority": "LOW",  "category": "TRACE",       "reason": "possible drag or impact trace"},
    # DIGITAL
    {"prompt": "laptop",      "priority": "MED",  "category": "DIGITAL",     "reason": "possible digital evidence"},
    {"prompt": "tablet",      "priority": "LOW",  "category": "DIGITAL",     "reason": "possible communication device"},
    {"prompt": "monitor",     "priority": "LOW",  "category": "DIGITAL",     "reason": "possible workstation evidence"},
    {"prompt": "camera",      "priority": "MED",  "category": "DIGITAL",     "reason": "possible surveillance evidence"},
    # CONTAINERS
    {"prompt": "box",         "priority": "MED",  "category": "CONTAINER",   "reason": "possible hidden evidence storage"},
    {"prompt": "bottle",      "priority": "MED",  "category": "CONTAINER",   "reason": "possible chemical or poison container"},
]

COLORS = {
    "HIGH": (45,  55, 215),
    "MED":  (25, 150, 230),
    "LOW":  (75, 165,  45),
}

ALL_PROMPT_TEXTS = [ep["prompt"] for ep in EVIDENCE_PROMPTS]
PROMPT_META      = {ep["prompt"]: ep for ep in EVIDENCE_PROMPTS}


# ── Detection function ────────────────────────────────────────────────────────
def detect_and_annotate(image_path: str, output_path: str) -> list:
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Could not read image: {image_path}")
    h, w = img.shape[:2]

    model.set_classes(ALL_PROMPT_TEXTS, model.get_text_pe(ALL_PROMPT_TEXTS))
    results = model.predict(source=image_path, conf=0.20, verbose=False)

    all_detections = []
    for r in results:
        for box in r.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            conf     = float(box.conf[0])
            cls_idx  = int(box.cls[0])
            cls_name = ALL_PROMPT_TEXTS[cls_idx] if cls_idx < len(ALL_PROMPT_TEXTS) else "unknown"
            meta     = PROMPT_META.get(cls_name, {"priority": "LOW", "category": "SUBTLE", "reason": "detected object"})
            all_detections.append({
                "prompt":   cls_name,
                "reason":   meta["reason"],
                "priority": meta["priority"],
                "category": meta.get("category", "—"),
                "conf":     round(conf * 100),
                "bbox":     [x1, y1, x2, y2],
            })

    all_detections.sort(key=lambda d: d["conf"])

    annotated = img.copy()
    font = cv2.FONT_HERSHEY_SIMPLEX

    for det in all_detections:
        x1, y1, x2, y2 = det["bbox"]
        color     = COLORS.get(det["priority"], COLORS["LOW"])
        thickness = 2 if det["priority"] == "HIGH" else 1
        label     = f"{det['prompt']}  [{det['priority']}]  {det['conf']}%"
        (tw, th), _ = cv2.getTextSize(label, font, 0.45, 1)
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, thickness)
        label_y = y1 - 6 if y1 > th + 14 else y2 + th + 10
        cv2.rectangle(annotated, (x1, label_y - th - 4), (x1 + tw + 8, label_y + 2), color, -1)
        cv2.putText(annotated, label, (x1 + 4, label_y - 2), font, 0.45, (255, 255, 255), 1, cv2.LINE_AA)

    counts = {p: sum(1 for d in all_detections if d["priority"] == p) for p in ("HIGH", "MED", "LOW")}
    total  = len(all_detections)
    banner = f"Detections: {total}   HIGH: {counts['HIGH']}   MED: {counts['MED']}   LOW: {counts['LOW']}"
    cv2.rectangle(annotated, (0, h - 38), (w, h), (18, 18, 18), -1)
    cv2.putText(annotated, banner, (8, h - 12), font, 0.44, (210, 210, 210), 1, cv2.LINE_AA)

    cv2.imwrite(output_path, annotated)
    return all_detections


# ── Flask app ─────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)  # Allow requests from the React dev server (localhost:3000 / 5173)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": MODEL_PATH})


@app.route("/analyze", methods=["POST"])
def analyze():
    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    # Save uploaded file
    img_path  = UPLOAD_DIR / file.filename
    out_name  = Path(file.filename).stem + "_annotated.jpg"
    out_path  = ANNOTATED_DIR / out_name

    file.save(str(img_path))

    try:
        detections = detect_and_annotate(str(img_path), str(out_path))
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

    # Encode annotated image as base64 so the frontend can display it directly
    with open(str(out_path), "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode("utf-8")

    counts = {p: sum(1 for d in detections if d["priority"] == p) for p in ("HIGH", "MED", "LOW")}

    return jsonify({
        "totalDetections": len(detections),
        "high": counts["HIGH"],
        "med":  counts["MED"],
        "low":  counts["LOW"],
        "detections": sorted(
            detections,
            key=lambda x: ({"HIGH": 0, "MED": 1, "LOW": 2}.get(x["priority"], 3), -x["conf"])
        ),
        "annotatedImage": f"data:image/jpeg;base64,{img_b64}",
    })


if __name__ == "__main__":
    print(f"\n🔬 Crime Scene YOLOE Backend running on http://localhost:{PORT}")
    print("   POST /analyze  — upload an image and get detections")
    print("   GET  /health   — check server status\n")
    app.run(host="0.0.0.0", port=PORT, debug=False)
