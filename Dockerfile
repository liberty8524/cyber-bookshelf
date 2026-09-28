FROM node:22-alpine AS frontend
WORKDIR /build
COPY package.json package-lock.json ./
COPY scripts/copy-pdf-assets.mjs ./scripts/copy-pdf-assets.mjs
RUN npm ci
COPY index.html vite.config.js ./
COPY frontend ./frontend
COPY public/favicon.svg ./public/favicon.svg
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 BOOKSHELF_DATA_DIR=/app/data
WORKDIR /app
COPY backend/requirements-lock.txt /app/backend/requirements-lock.txt
RUN pip install --no-cache-dir -r backend/requirements-lock.txt
COPY backend /app/backend
COPY --from=frontend /build/dist /app/dist
RUN useradd --uid 10001 --create-home bookshelf && mkdir -p /app/data /app/.cache/tmp && chown -R bookshelf:bookshelf /app
USER bookshelf
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')"
CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-proxy-headers"]
