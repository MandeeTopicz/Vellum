#!/bin/bash
# Run: TOKEN=<your-id-token> ./test-handwriting-api.sh
# Or: export TOKEN=... && ./test-handwriting-api.sh
#
# IMPORTANT: Firebase ID tokens expire after 1 hour. Get a fresh token from Firebase Auth
# (e.g. via browser DevTools / Application storage after signing in) before running.
#
API="https://us-central1-vellum-6f172.cloudfunctions.net/api/api/handwriting-recognize"
TOKEN="${TOKEN:-YOUR_TOKEN}"

echo "=== 1. Wrong content type (expect 400 UNSUPPORTED_CONTENT_TYPE) ==="
curl -s -w "\nHTTP %{http_code}\n" -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{}' \
  "$API"
echo ""

echo "=== 2. Missing file field (expect 400 MISSING_FILE) ==="
# Multipart with boundary but no file field
curl -s -w "\nHTTP %{http_code}\n" -X POST \
  -H "Content-Type: multipart/form-data; boundary=----WebKitFormBoundaryTest" \
  -H "Authorization: Bearer $TOKEN" \
  -d "------WebKitFormBoundaryTest--" \
  "$API"
echo ""

echo "=== 3. Big file (expect 413 FILE_TOO_LARGE) ==="
curl -s -w "\nHTTP %{http_code}\n" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/bigfile.bin" \
  "$API"
echo ""

echo "=== 4. Happy path (expect 200) ==="
curl -s -w "\nHTTP %{http_code}\n" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@ocr.png" \
  "$API"
