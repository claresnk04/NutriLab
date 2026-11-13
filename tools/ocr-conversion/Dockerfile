FROM python:3.12-slim

ENV PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /workspace

RUN apt-get update \
    && apt-get install --no-install-recommends -y libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /tmp/ocr-conversion-requirements.txt
RUN python -m pip install --upgrade pip \
    && python -m pip install -r /tmp/ocr-conversion-requirements.txt

ENTRYPOINT ["python"]
