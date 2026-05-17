# Test Dashboard changes
cd "C:\work\PCR Manager\.claude\worktrees\nice-elbakyan-8c32df"

Write-Host "Running type check..."
npm run typecheck 2>&1 | Select-Object -First 50

Write-Host "`nRunning Dashboard tests..."
npm test -- --testPathPattern=dashboard --run 2>&1 | Select-Object -Last 100
