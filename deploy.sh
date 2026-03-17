#!/bin/bash
set -e

# ─── Configuración ───────────────────────────────────────────────────────────
PROJECT_ID="${GCP_PROJECT_ID:?'Falta GCP_PROJECT_ID'}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="jurisprudencia-api"
IMAGE="${REGION}-docker.pkg.dev/$PROJECT_ID/jurisprudencia/$SERVICE_NAME"
BUCKET="$PROJECT_ID-jurisprudencia-data"

# ─── Servicios GCP ───────────────────────────────────────────────────────────
echo "🔧 Habilitando APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  --project "$PROJECT_ID"

echo "📦 Creando repositorio Artifact Registry (si no existe)..."
gcloud artifacts repositories describe jurisprudencia \
  --location="$REGION" --project="$PROJECT_ID" &>/dev/null \
  || gcloud artifacts repositories create jurisprudencia \
       --repository-format=docker \
       --location="$REGION" \
       --project="$PROJECT_ID"

echo "🪣 Creando bucket de datos (si no existe)..."
gsutil ls -b "gs://$BUCKET" &>/dev/null \
  || gsutil mb -l "$REGION" "gs://$BUCKET"

echo "🔑 Creando secrets (si no existen)..."
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

crear_secret() {
  local NAME=$1
  local PROMPT=$2
  if ! gcloud secrets describe "$NAME" --project "$PROJECT_ID" &>/dev/null; then
    read -rsp "$PROMPT: " VALUE && echo
    echo -n "$VALUE" | gcloud secrets create "$NAME" --data-file=- --project "$PROJECT_ID"
  else
    echo "   Secret $NAME ya existe, omitiendo."
  fi
  gcloud secrets add-iam-policy-binding "$NAME" \
    --member="serviceAccount:${SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --project "$PROJECT_ID" &>/dev/null
}

crear_secret "GROQ_API_KEY"  "Ingresá tu Groq API Key"
crear_secret "APP_USER"      "Usuario de la app (ej: admin)"
crear_secret "APP_PASSWORD"  "Contraseña de la app"
crear_secret "JWT_SECRET"    "JWT Secret (cadena larga y random)"

# ─── Build & Deploy ──────────────────────────────────────────────────────────
echo "🔨 Build y push de imagen..."
gcloud builds submit --tag "$IMAGE" --project "$PROJECT_ID" \
  --machine-type=E2_MEDIUM

echo "🚀 Desplegando en Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 1 \
  --set-env-vars "NODE_ENV=production,HF_HOME=/app/data/models,ALLOWED_ORIGINS=https://lawapp-delta.vercel.app" \
  --update-secrets "GROQ_API_KEY=GROQ_API_KEY:latest,APP_USER=APP_USER:latest,APP_PASSWORD=APP_PASSWORD:latest,JWT_SECRET=JWT_SECRET:latest" \
  --add-volume name=data,type=cloud-storage,bucket="$BUCKET" \
  --add-volume-mount volume=data,mount-path=/app/data \
  --project "$PROJECT_ID"

echo ""
echo "🧹 Limpiando imágenes antiguas de Artifact Registry..."
gcloud artifacts docker images list "${REGION}-docker.pkg.dev/$PROJECT_ID/jurisprudencia/$SERVICE_NAME" \
  --format="get(version)" --filter="NOT tags:*" --project "$PROJECT_ID" \
  | xargs -I{} gcloud artifacts docker images delete \
      "${REGION}-docker.pkg.dev/$PROJECT_ID/jurisprudencia/$SERVICE_NAME@{}" \
      --quiet --project "$PROJECT_ID" 2>/dev/null || true

echo ""
echo "✅ Deploy completado."
gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format 'value(status.url)'
