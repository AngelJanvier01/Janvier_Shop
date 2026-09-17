FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/models/huggingface \
    TRANSFORMERS_CACHE=/models/huggingface \
    MODEL_ID=ZhengPeng7/BiRefNet_lite \
    MODEL_REVISION=7838f1c3472f827cd8ce13ab5ccc2ce48077360f \
    MODEL_INPUT_SIZE=1024 \
    MODEL_THREADS=2 \
    MASK_GUARD_ENABLED=true \
    MASK_GUARD_SIZE=512 \
    MASK_GUARD_SEED_ALPHA=144 \
    MASK_GUARD_MIN_LIGHT_BORDER=0.20 \
    MASK_GUARD_COLOR_TOLERANCE=32

WORKDIR /service

RUN pip install --no-cache-dir \
      torch==2.5.1 torchvision==0.20.1 \
      --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --create-home --uid 10001 processor \
    && mkdir -p /models/huggingface \
    && chown -R processor:processor /models /service

COPY --chown=processor:processor app.py ./app.py

USER processor
EXPOSE 8080
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--no-access-log"]
