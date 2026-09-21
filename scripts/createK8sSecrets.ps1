param(
    [string]$EnvFile = ".env",
    [string]$Namespace = "default",
    [string]$DbName,
    [string]$DbUser = "pulseguard",
    [string]$DbPassword,
    [string]$MysqlRootPassword,
    [Parameter(Mandatory = $true)]
    [string]$SeedPersonnelPassword,
    [Parameter(Mandatory = $true)]
    [string]$DemoUserPassword,
    [string]$AllowedOrigins
)

$ErrorActionPreference = "Stop"

function Read-DotEnv {
    param([string]$Path)

    $values = @{}

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Env file not found: $Path"
    }

    Get-Content -LiteralPath $Path | ForEach-Object {
        $line = $_.Trim()

        if (-not $line -or $line.StartsWith("#")) {
            return
        }

        $separatorIndex = $line.IndexOf("=")
        if ($separatorIndex -lt 1) {
            return
        }

        $key = $line.Substring(0, $separatorIndex).Trim()
        $value = $line.Substring($separatorIndex + 1).Trim()

        if (
            ($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))
        ) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        $values[$key] = $value
    }

    return $values
}

function Require-Value {
    param(
        [hashtable]$Values,
        [string]$Name
    )

    if (-not $Values.ContainsKey($Name) -or [string]::IsNullOrWhiteSpace($Values[$Name])) {
        throw "$Name is required. Add it to $EnvFile or pass it into this script."
    }

    return $Values[$Name]
}

function ConvertTo-Base64SecretValue {
    param(
        [string]$Value
    )

    return [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($Value))
}

function Write-SecretYaml {
    param(
        [string]$Name,
        [string]$Namespace,
        [hashtable]$Values,
        [string]$Path
    )

    $lines = [System.Collections.Generic.List[string]]::new()
    $lines.Add("apiVersion: v1")
    $lines.Add("kind: Secret")
    $lines.Add("metadata:")
    $lines.Add("  name: $Name")
    $lines.Add("  namespace: $Namespace")
    $lines.Add("type: Opaque")
    $lines.Add("data:")

    foreach ($key in ($Values.Keys | Sort-Object)) {
        $encodedValue = ConvertTo-Base64SecretValue -Value ([string]$Values[$key])
        $lines.Add("  ${key}: $encodedValue")
    }

    [System.IO.File]::WriteAllLines($Path, $lines, [System.Text.UTF8Encoding]::new($false))
}

function Apply-Secret {
    param(
        [string]$Name,
        [string]$Namespace,
        [hashtable]$Values
    )

    $tempFile = Join-Path ([System.IO.Path]::GetTempPath()) "$Name.yaml"

    try {
        Write-SecretYaml -Name $Name -Namespace $Namespace -Values $Values -Path $tempFile
        & kubectl apply -f $tempFile

        if ($LASTEXITCODE -ne 0) {
            throw "kubectl failed while applying $Name"
        }
    } finally {
        if (Test-Path -LiteralPath $tempFile) {
            Remove-Item -LiteralPath $tempFile -Force
        }
    }
}

$envValues = Read-DotEnv -Path $EnvFile

if (-not $DbName) {
    $DbName = Require-Value -Values $envValues -Name "DB_NAME"
}

if (-not $DbPassword) {
    $DbPassword = Require-Value -Values $envValues -Name "DB_PASSWORD"
}

if (-not $MysqlRootPassword) {
    $MysqlRootPassword = $DbPassword
}

$jwtSecret = Require-Value -Values $envValues -Name "JWT_SECRET"
$azureStorageConnectionString = Require-Value -Values $envValues -Name "AZURE_STORAGE_CONNECTION_STRING"
$notificationEncryptionKey = Require-Value -Values $envValues -Name "NOTIFICATION_ENCRYPTION_KEY"
$googleWebClientId = Require-Value -Values $envValues -Name "GOOGLE_WEB_CLIENT_ID"
$mapboxAccessToken = Require-Value -Values $envValues -Name "MAPBOX_ACCESS_TOKEN"

$mysqlSecretValues = @{
    MYSQL_ROOT_PASSWORD = $MysqlRootPassword
    MYSQL_DATABASE = $DbName
    MYSQL_USER = $DbUser
    MYSQL_PASSWORD = $DbPassword
}

$pulseGuardSecretValues = @{
    DB_HOST = "mysql"
    DB_PORT = "3306"
    DB_NAME = $DbName
    DB_USER = $DbUser
    DB_PASSWORD = $DbPassword
    JWT_SECRET = $jwtSecret
    AZURE_STORAGE_CONNECTION_STRING = $azureStorageConnectionString
    NOTIFICATION_ENCRYPTION_KEY = $notificationEncryptionKey
    GOOGLE_WEB_CLIENT_ID = $googleWebClientId
    MAPBOX_ACCESS_TOKEN = $mapboxAccessToken
    NOTIFICATION_QUEUE_DRIVER = "bull"
    REDIS_HOST = "valkey"
    REDIS_PORT = "6379"
    NOTIFICATION_QUEUE_ATTEMPTS = "3"
    NOTIFICATION_QUEUE_BACKOFF_MS = "5000"
    NOTIFICATION_QUEUE_CONCURRENCY = "1"
    SEED_PERSONNEL_PASSWORD = $SeedPersonnelPassword
    DEMO_USER_PASSWORD = $DemoUserPassword
}

if (-not [string]::IsNullOrWhiteSpace($AllowedOrigins)) {
    $pulseGuardSecretValues["ALLOWED_ORIGINS"] = $AllowedOrigins
}

Write-Host "Creating/updating mysql-secret in namespace '$Namespace'..."
Apply-Secret -Name "mysql-secret" -Namespace $Namespace -Values $mysqlSecretValues

Write-Host "Creating/updating pulse-guard-secret in namespace '$Namespace'..."
Apply-Secret -Name "pulse-guard-secret" -Namespace $Namespace -Values $pulseGuardSecretValues

Write-Host "Kubernetes secrets are ready."
