param([ValidateSet('runtime', 'browser', 'all')][string]$Suite = 'all')
$ErrorActionPreference = 'Stop'
$nodeTool = Get-Command node -ErrorAction SilentlyContinue
$embeddedNode = $false
    if ($nodeTool) {
        $runner = $nodeTool.Source
    } else {
        $runner = 'C:/Program Files/Microsoft VS Code/Code.exe'
        if (-not (Test-Path -LiteralPath $runner)) { throw 'Use an existing Node 22+ runtime to run automated tests; the UI itself needs only a browser.' }
        $embeddedNode = $true
    }
    $testFiles = @()
    if ($Suite -in @('runtime', 'all')) { $testFiles += Join-Path $PSScriptRoot 'runtime.test.cjs' }
    if ($Suite -in @('browser', 'all')) { $testFiles += Join-Path $PSScriptRoot 'browser.test.cjs' }
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $runner
    $startInfo.Arguments = '--test --test-reporter=spec ' + (($testFiles | ForEach-Object { '"' + $_ + '"' }) -join ' ')
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    if ($embeddedNode) { $startInfo.EnvironmentVariables['ELECTRON_RUN_AS_NODE'] = '1' }
    $process = [System.Diagnostics.Process]::Start($startInfo)
    $stdout = $process.StandardOutput.ReadToEndAsync()
    $stderr = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    [Console]::Out.Write($stdout.GetAwaiter().GetResult())
    [Console]::Error.Write($stderr.GetAwaiter().GetResult())
exit $process.ExitCode
