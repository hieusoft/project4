FROM python:3.12-slim AS app
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Only this service's tree is needed (no shared Python libs yet)
COPY apps/identity-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/identity-service/ ./

# DB schema is provisioned externally; just start the API.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-3001}"]
