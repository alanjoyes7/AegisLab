FROM python:3.13.2-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY --chown=10001:10001 apps/api/ ./
RUN pip install --no-cache-dir -r requirements.txt && useradd --uid 10001 --create-home aegis
USER aegis
EXPOSE 8090
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8090"]
