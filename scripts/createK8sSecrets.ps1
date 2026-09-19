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

function Add-LiteralArg {
    param(
        [System.Collections.Generic.List[string]]$Args,
        [string]$Name,
        [string]$Value
    )

    if (-not [string]::IsNullOrWhiteSpace($Value)) {
        $Args.Add("--from-literal=$Name=$Value")
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

$mysqlSecretArgs = [System.Collections.Generic.List[string]]::new()
$mysqlSecretArgs.AddRange(@(
    "create", "secret", "generic", "mysql-secret",
    "--namespace", $Namespace,
    "--from-literal=MYSQL_ROOT_PASSWORD=$MysqlRootPassword",
    "--from-literal=MYSQL_DATABASE=$DbName",
    "--from-literal=MYSQL_USER=$DbUser",
    "--from-literal=MYSQL_PASSWORD=$DbPassword",
    "--dry-run=client",
    "-o", "yaml"
))

$pulseGuardSecretArgs = [System.Collections.Generic.List[string]]::new()
$pulseGuardSecretArgs.AddRange(@(
    "create", "secret", "generic", "pulse-guard-secret",
    "--namespace", $Namespace,
    "--from-literal=DB_HOST=mysql",
    "--from-literal=DB_PORT=3306",
    "--from-literal=DB_NAME=$DbName",
    "--from-literal=DB_USER=$DbUser",
    "--from-literal=DB_PASSWORD=$DbPassword",
    "--from-literal=JWT_SECRET=$jwtSecret",
    "--from-literal=AZURE_STORAGE_CONNECTION_STRING=$azureStorageConnectionString",
    "--from-literal=NOTIFICATION_ENCRYPTION_KEY=$notificationEncryptionKey",
    "--from-literal=GOOGLE_WEB_CLIENT_ID=$googleWebClientId",
    "--from-literal=MAPBOX_ACCESS_TOKEN=$mapboxAccessToken",
    "--from-literal=NOTIFICATION_QUEUE_DRIVER=bull",
    "--from-literal=REDIS_HOST=valkey",
    "--from-literal=REDIS_PORT=6379",
    "--from-literal=NOTIFICATION_QUEUE_ATTEMPTS=3",
    "--from-literal=NOTIFICATION_QUEUE_BACKOFF_MS=5000",
    "--from-literal=NOTIFICATION_QUEUE_CONCURRENCY=1",
    "--from-literal=SEED_PERSONNEL_PASSWORD=$SeedPersonnelPassword",
    "--from-literal=DEMO_USER_PASSWORD=$DemoUserPassword",
    "--dry-run=client",
    "-o", "yaml"
))

Add-LiteralArg -Args $pulseGuardSecretArgs -Name "ALLOWED_ORIGINS" -Value $AllowedOrigins

Write-Host "Creating/updating mysql-secret in namespace '$Namespace'..."
& kubectl @mysqlSecretArgs | kubectl apply -f -

Write-Host "Creating/updating pulse-guard-secret in namespace '$Namespace'..."
& kubectl @pulseGuardSecretArgs | kubectl apply -f -

Write-Host "Kubernetes secrets are ready."
