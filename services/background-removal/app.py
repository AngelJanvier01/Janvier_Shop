from contextlib import asynccontextmanager
from collections import deque
from io import BytesIO
import os

from fastapi import FastAPI, HTTPException, Request, Response
import numpy as np
from PIL import Image, ImageFilter, ImageOps, UnidentifiedImageError
import torch
from transformers import AutoModelForImageSegmentation


MODEL_ID = os.environ.get("MODEL_ID", "ZhengPeng7/BiRefNet_lite")
MODEL_REVISION = os.environ.get(
    "MODEL_REVISION", "7838f1c3472f827cd8ce13ab5ccc2ce48077360f"
)
INPUT_SIZE = int(os.environ.get("MODEL_INPUT_SIZE", "1024"))
MAXIMUM_BYTES = int(os.environ.get("MODEL_MAX_INPUT_BYTES", str(20 * 1024 * 1024)))
MAXIMUM_PIXELS = int(os.environ.get("MODEL_MAX_INPUT_PIXELS", "80000000"))
MODEL_THREADS = max(1, int(os.environ.get("MODEL_THREADS", "2")))
MASK_GUARD_ENABLED = os.environ.get("MASK_GUARD_ENABLED", "true").lower() == "true"
MASK_GUARD_SIZE = max(128, int(os.environ.get("MASK_GUARD_SIZE", "512")))
MASK_GUARD_SEED_ALPHA = min(
    255, max(1, int(os.environ.get("MASK_GUARD_SEED_ALPHA", "144")))
)
MASK_GUARD_MIN_LIGHT_BORDER = min(
    1.0, max(0.0, float(os.environ.get("MASK_GUARD_MIN_LIGHT_BORDER", "0.20")))
)
MASK_GUARD_COLOR_TOLERANCE = min(
    80, max(8, int(os.environ.get("MASK_GUARD_COLOR_TOLERANCE", "32")))
)
PROCESSOR_REVISION = "janvier-hybrid-v2"

Image.MAX_IMAGE_PIXELS = MAXIMUM_PIXELS
torch.set_num_threads(MODEL_THREADS)
torch.set_float32_matmul_precision("high")


@asynccontextmanager
async def lifespan(app: FastAPI):
    model = AutoModelForImageSegmentation.from_pretrained(
        MODEL_ID,
        revision=MODEL_REVISION,
        trust_remote_code=True,
    )
    model.to("cpu")
    model.eval()
    app.state.model = model
    yield


app = FastAPI(docs_url=None, redoc_url=None, lifespan=lifespan)


def prepare_image(image: Image.Image) -> tuple[torch.Tensor, tuple[int, int, int, int]]:
    """Letterbox an image without distorting the product geometry."""
    source = image.convert("RGB")
    scale = min(INPUT_SIZE / source.width, INPUT_SIZE / source.height)
    width = max(1, round(source.width * scale))
    height = max(1, round(source.height * scale))
    resized = source.resize((width, height), Image.Resampling.LANCZOS)
    left = (INPUT_SIZE - width) // 2
    top = (INPUT_SIZE - height) // 2
    canvas = Image.new("RGB", (INPUT_SIZE, INPUT_SIZE), (255, 255, 255))
    canvas.paste(resized, (left, top))
    pixels = np.asarray(canvas, dtype=np.float32) / 255.0
    pixels = (pixels - np.array([0.485, 0.456, 0.406], dtype=np.float32)) / np.array(
        [0.229, 0.224, 0.225], dtype=np.float32
    )
    tensor = torch.from_numpy(pixels.transpose(2, 0, 1)).unsqueeze(0)
    return tensor, (left, top, width, height)


def connected_to_seeds(allowed: np.ndarray, seeds: np.ndarray) -> np.ndarray:
    """Return all 8-connected allowed pixels reachable from any seed."""
    reachable = np.zeros(allowed.shape, dtype=bool)
    seed_mask = allowed & seeds
    seed_points = np.argwhere(seed_mask)
    if not seed_points.size:
        return reachable

    reachable[seed_mask] = True
    pending = deque((int(y), int(x)) for y, x in seed_points)
    height, width = allowed.shape
    while pending:
        y, x = pending.popleft()
        for next_y in range(max(0, y - 1), min(height, y + 2)):
            for next_x in range(max(0, x - 1), min(width, x + 2)):
                if allowed[next_y, next_x] and not reachable[next_y, next_x]:
                    reachable[next_y, next_x] = True
                    pending.append((next_y, next_x))
    return reachable


def protect_product_silhouette(
    image: Image.Image, ai_mask: Image.Image
) -> tuple[Image.Image, str]:
    """Recover product regions that saliency segmentation drops on light backgrounds.

    The guard identifies the light background connected to the outer border. It then
    keeps complete non-background components touched by a confident part of the AI
    mask. This recovers monitor frames and screens without retaining unrelated bars
    or decorations around the product.
    """
    if not MASK_GUARD_ENABLED:
        return ai_mask, "birefnet-letterbox"

    scale = min(1.0, MASK_GUARD_SIZE / max(image.size))
    guard_size = (
        max(1, round(image.width * scale)),
        max(1, round(image.height * scale)),
    )
    rgb = np.asarray(
        image.convert("RGB").resize(guard_size, Image.Resampling.LANCZOS),
        dtype=np.int16,
    )
    mask = np.asarray(
        ai_mask.resize(guard_size, Image.Resampling.BILINEAR), dtype=np.uint8
    )

    border = np.concatenate((rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]), axis=0)
    light_border = border[np.mean(border, axis=1) >= 220]
    if len(light_border) < len(border) * MASK_GUARD_MIN_LIGHT_BORDER:
        return ai_mask, "birefnet-letterbox"

    background = np.median(light_border, axis=0)
    border_spread = np.percentile(
        np.max(np.abs(light_border - background), axis=1), 90
    )
    tolerance = min(
        MASK_GUARD_COLOR_TOLERANCE,
        max(16, int(round(border_spread)) + 12),
    )
    distance = np.max(np.abs(rgb - background), axis=2)
    background_candidate = (distance <= tolerance) & (np.mean(rgb, axis=2) >= 205)

    border_seeds = np.zeros(background_candidate.shape, dtype=bool)
    border_seeds[0, :] = background_candidate[0, :]
    border_seeds[-1, :] = background_candidate[-1, :]
    border_seeds[:, 0] |= background_candidate[:, 0]
    border_seeds[:, -1] |= background_candidate[:, -1]
    exterior_background = connected_to_seeds(background_candidate, border_seeds)
    structural_foreground = ~exterior_background

    ai_seeds = mask >= MASK_GUARD_SEED_ALPHA
    protected = connected_to_seeds(structural_foreground, ai_seeds)
    protected_ratio = float(np.mean(protected))
    if protected_ratio <= 0.001 or protected_ratio >= 0.90:
        return ai_mask, "birefnet-letterbox"

    protected_mask = Image.fromarray((protected * 255).astype(np.uint8), mode="L")
    protected_mask = protected_mask.filter(ImageFilter.GaussianBlur(radius=0.65))
    protected_mask = protected_mask.resize(image.size, Image.Resampling.LANCZOS)
    combined = np.maximum(
        np.asarray(ai_mask, dtype=np.uint8),
        np.asarray(protected_mask, dtype=np.uint8),
    )
    return Image.fromarray(combined, mode="L"), "hybrid-light-background"


@app.get("/health")
async def health():
    return {
        "inputSize": INPUT_SIZE,
        "maskGuard": MASK_GUARD_ENABLED,
        "model": MODEL_ID,
        "processorRevision": PROCESSOR_REVISION,
        "ready": hasattr(app.state, "model"),
        "revision": MODEL_REVISION,
        "threads": MODEL_THREADS,
    }


@app.post("/v1/remove-background")
async def remove_background(request: Request):
    try:
        declared_length = int(request.headers.get("content-length", "0") or "0")
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid content length") from None
    if declared_length < 0:
        raise HTTPException(status_code=400, detail="invalid content length")
    if declared_length > MAXIMUM_BYTES:
        raise HTTPException(status_code=413, detail="image too large")
    contents = await request.body()
    if not contents or len(contents) > MAXIMUM_BYTES:
        raise HTTPException(status_code=413, detail="image too large")

    try:
        with Image.open(BytesIO(contents)) as opened:
            if opened.width * opened.height > MAXIMUM_PIXELS:
                raise HTTPException(status_code=413, detail="image has too many pixels")
            opened.verify()
        with Image.open(BytesIO(contents)) as opened:
            image = ImageOps.exif_transpose(opened).convert("RGB")
    except HTTPException:
        raise
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError):
        raise HTTPException(status_code=415, detail="invalid image") from None

    tensor, (left, top, width, height) = prepare_image(image)
    with torch.inference_mode():
        prediction = app.state.model(tensor)[-1].sigmoid().cpu()[0].squeeze()
    mask_array = np.clip(prediction.numpy() * 255.0, 0, 255).astype(np.uint8)
    model_mask = Image.fromarray(mask_array, mode="L")
    mask = model_mask.crop((left, top, left + width, top + height)).resize(
        image.size, Image.Resampling.LANCZOS
    )
    mask, processing_mode = protect_product_silhouette(image, mask)
    result = image.copy()
    result.putalpha(mask)
    output = BytesIO()
    result.save(output, format="PNG", optimize=True)

    return Response(
        content=output.getvalue(),
        media_type="image/png",
        headers={
            "X-Model-Name": f"{MODEL_ID}+{PROCESSOR_REVISION}",
            "X-Model-Revision": f"{MODEL_REVISION}:{PROCESSOR_REVISION}",
            "X-Processing-Mode": processing_mode,
        },
    )
