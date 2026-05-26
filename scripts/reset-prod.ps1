# ============================================================
# reset-prod.ps1 — Réinitialise l'environnement de production
# PCR Manager — à exécuter depuis la racine du projet
# ============================================================
# Usage : npm run reset:prod
# OU     : powershell -ExecutionPolicy Bypass -File scripts\reset-prod.ps1
# ============================================================

$ErrorActionPreference = "Continue"
$appDataDir = "$env:LOCALAPPDATA\PCRManager"

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "   PCR Manager — Reset Production     " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Fermeture du processus ────────────────────────────────
Write-Host "[1/4] Fermeture de PCR Manager..." -ForegroundColor Yellow
$procs = Get-Process -Name "pcr-manager" -ErrorAction SilentlyContinue
if ($procs) {
    $procs | Stop-Process -Force
    Start-Sleep -Milliseconds 800
    Write-Host "      Process arrêté." -ForegroundColor Green
} else {
    Write-Host "      Application non en cours d'exécution." -ForegroundColor Gray
}

# ── 2. Suppression des fichiers de base de données ──────────
Write-Host "[2/4] Suppression de la base de données..." -ForegroundColor Yellow
$dbFiles = @(
    "$appDataDir\pcr.db",
    "$appDataDir\pcr.db-shm",
    "$appDataDir\pcr.db-wal"
)

$deleted = 0
foreach ($f in $dbFiles) {
    if (Test-Path $f) {
        Remove-Item $f -Force -ErrorAction SilentlyContinue
        Write-Host "      Supprimé : $f" -ForegroundColor Green
        $deleted++
    }
}
if ($deleted -eq 0) {
    Write-Host "      Aucun fichier de base de données trouvé." -ForegroundColor Gray
}

# ── 3. Suppression des clés dans le Credential Manager ──────
Write-Host "[3/4] Suppression des clés Keychain..." -ForegroundColor Yellow

$credentials = @(
    "db_encryption_key.PCRManager",
    "totp_secret.PCRManager"
)

foreach ($cred in $credentials) {
    $result = cmdkey /delete:$cred 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "      Supprimé : $cred" -ForegroundColor Green
    } else {
        Write-Host "      Non trouvé (déjà absent) : $cred" -ForegroundColor Gray
    }
}

# ── 4. Résumé ────────────────────────────────────────────────
Write-Host "[4/4] Vérification..." -ForegroundColor Yellow
$remaining = $dbFiles | Where-Object { Test-Path $_ }
if ($remaining.Count -eq 0) {
    Write-Host "      Base de données : propre." -ForegroundColor Green
} else {
    Write-Host "      ATTENTION — fichiers encore présents :" -ForegroundColor Red
    $remaining | ForEach-Object { Write-Host "        $_" -ForegroundColor Red }
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Reset terminé. Relancez l'app.      " -ForegroundColor Cyan
Write-Host "  Elle démarrera comme une premiere   " -ForegroundColor Cyan
Write-Host "  installation (configuration TOTP +  " -ForegroundColor Cyan
Write-Host "  établissement requis).              " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
