# trener — offsite-backup PULL (rmz4val-local).
# Стягивает gpg-шифрованные дампы прод-БД с бокса в папку Яндекс.Диска;
# десктоп-клиент Диска сам уносит их в облако (offsite, РФ-юрисдикция).
# Дамп шифруется ПУБЛИЧНЫМ ключом на боксе — приватный ключ живёт вне бокса (у владельца).
# Регистрируется как Scheduled Task "trener-backup-pull". См. docs/backups.md.
$ErrorActionPreference = 'Stop'
$Dest   = 'D:\YandexDisk\Backups\trener'
$Remote = 'GONBA:/home/valstan/trener/backups/trener-*.dump.gpg'
$Scp    = 'C:\Windows\System32\OpenSSH\scp.exe'   # системный OpenSSH: читает ~/.ssh/config (alias GONBA)
$Log    = Join-Path $Dest '_pull.log'

New-Item -ItemType Directory -Force -Path $Dest | Out-Null
$ts = Get-Date -Format 'yyyy-MM-ddTHH:mm:ssK'
try {
    & $Scp -q -p -o BatchMode=yes -o ConnectTimeout=20 $Remote $Dest
    if ($LASTEXITCODE -ne 0) { throw "scp exit $LASTEXITCODE" }
    # Локальное зеркало ретенции: бокс держит 30 дней, тут чуть шире — 35.
    Get-ChildItem $Dest -Filter 'trener-*.dump.gpg' |
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-35) } |
        Remove-Item -Force -ErrorAction SilentlyContinue
    $n = (Get-ChildItem $Dest -Filter 'trener-*.dump.gpg' -ErrorAction SilentlyContinue).Count
    Add-Content -Path $Log -Value "$ts  pull ok, $n dump(s) staged" -Encoding utf8
} catch {
    Add-Content -Path $Log -Value "$ts  PULL FAILED: $($_.Exception.Message)" -Encoding utf8
    throw
}
