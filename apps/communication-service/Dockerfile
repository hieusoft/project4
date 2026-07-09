FROM python:3.12-slim AS app
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

COPY apps/communication-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/communication-service/ ./

# ASGI app mounts FastAPI + Socket.IO
CMD ["sh", "-c", "uvicorn app.main:asgi_app --host 0.0.0.0 --port ${PORT:-3005}"]
