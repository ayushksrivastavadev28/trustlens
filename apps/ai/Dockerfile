FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

COPY . /src
RUN set -eux; \
    if [ -f /src/requirements.txt ] && [ -d /src/app ]; then \
      PROJECT_ROOT="/src"; \
    elif [ -f /src/apps/ai/requirements.txt ] && [ -d /src/apps/ai/app ]; then \
      PROJECT_ROOT="/src/apps/ai"; \
    else \
      echo "Could not locate apps/ai files in build context"; \
      find /src -maxdepth 3 -type f | sort; \
      exit 1; \
    fi; \
    cp "$PROJECT_ROOT/requirements.txt" /app/requirements.txt; \
    cp -r "$PROJECT_ROOT/app" /app/app; \
    pip install --upgrade pip && pip install -r /app/requirements.txt; \
    rm -rf /src

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8001}"]
