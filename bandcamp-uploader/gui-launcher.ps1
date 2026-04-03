Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$launcherLog = Join-Path ([System.IO.Path]::GetTempPath()) 'bandcamp_uploader_launcher_log.txt'
try { Add-Content -Path $launcherLog -Value "$(Get-Date -Format o) - GUI script started" } catch {}

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
  $nodePath = 'C:\Program Files\nodejs\node.exe'
  if (Test-Path $nodePath) {
    $nodeCmd = Get-Command $nodePath -ErrorAction SilentlyContinue
  }
}
if (-not $nodeCmd) {
  [System.Windows.Forms.MessageBox]::Show('Node.js is required. Please install it from https://nodejs.org and try again.', 'ANTS Uploader') | Out-Null
  Start-Process 'https://nodejs.org'
  try { Add-Content -Path $launcherLog -Value "$(Get-Date -Format o) - Node missing" } catch {}
  exit 1
}

$uploaderPath = Join-Path $PSScriptRoot 'uploader.js'
if (!(Test-Path $uploaderPath)) {
  [System.Windows.Forms.MessageBox]::Show('Missing uploader.js next to this file.', 'ANTS Uploader') | Out-Null
  try { Add-Content -Path $launcherLog -Value "$(Get-Date -Format o) - Missing uploader.js" } catch {}
  exit 1
}

$npmCmd = Join-Path (Split-Path $nodeCmd.Source) 'npm.cmd'
$nodeModules = Join-Path $PSScriptRoot 'node_modules\playwright'
if (!(Test-Path $nodeModules)) {
  [System.Windows.Forms.MessageBox]::Show('First-time setup: installing dependencies. This may take a minute.', 'ANTS Uploader') | Out-Null
  Start-Process -FilePath $npmCmd -ArgumentList @('install') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -Wait
  try { Add-Content -Path $launcherLog -Value "$(Get-Date -Format o) - npm install finished" } catch {}
}

$form = New-Object System.Windows.Forms.Form
$form.Text = 'ANTS Bandcamp Uploader'
$form.Size = New-Object System.Drawing.Size(640, 420)
$form.MinimumSize = New-Object System.Drawing.Size(560, 360)
$form.StartPosition = 'CenterScreen'
$form.BackColor = [System.Drawing.Color]::FromArgb(245, 246, 248)

$title = New-Object System.Windows.Forms.Label
$title.Text = 'ANTS Bandcamp Uploader'
$title.Font = New-Object System.Drawing.Font('Segoe UI', 14, [System.Drawing.FontStyle]::Bold)
$title.AutoSize = $true
$title.Location = New-Object System.Drawing.Point(16, 16)
$form.Controls.Add($title)

$panel = New-Object System.Windows.Forms.TableLayoutPanel
$panel.Location = New-Object System.Drawing.Point(16, 56)
$panel.Size = New-Object System.Drawing.Size(600, 240)
$panel.Anchor = 'Top,Left,Right'
$panel.ColumnCount = 4
$panel.RowCount = 5
$panel.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle('Percent', 20)))
$panel.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle('Percent', 50)))
$panel.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle('Percent', 15)))
$panel.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle('Percent', 15)))
$panel.RowStyles.Add((New-Object System.Windows.Forms.RowStyle('Absolute', 36)))
$panel.RowStyles.Add((New-Object System.Windows.Forms.RowStyle('Absolute', 36)))
$panel.RowStyles.Add((New-Object System.Windows.Forms.RowStyle('Absolute', 36)))
$panel.RowStyles.Add((New-Object System.Windows.Forms.RowStyle('Absolute', 36)))
$panel.RowStyles.Add((New-Object System.Windows.Forms.RowStyle('Absolute', 36)))
$form.Controls.Add($panel)

function AddLabel($text, $row) {
  $lbl = New-Object System.Windows.Forms.Label
  $lbl.Text = $text
  $lbl.Dock = 'Fill'
  $lbl.TextAlign = 'MiddleLeft'
  $lbl.Font = New-Object System.Drawing.Font('Segoe UI', 10)
  $panel.Controls.Add($lbl, 0, $row)
  return $lbl
}

function AddTextBox($row) {
  $tb = New-Object System.Windows.Forms.TextBox
  $tb.Dock = 'Fill'
  $tb.Font = New-Object System.Drawing.Font('Segoe UI', 10)
  $panel.Controls.Add($tb, 1, $row)
  return $tb
}

function AddButton($text, $row, $col, $click) {
  $btn = New-Object System.Windows.Forms.Button
  $btn.Text = $text
  $btn.Dock = 'Fill'
  $btn.Font = New-Object System.Drawing.Font('Segoe UI', 9)
  $btn.BackColor = [System.Drawing.Color]::FromArgb(230, 233, 240)
  $btn.Add_Click($click)
  $panel.Controls.Add($btn, $col, $row)
  return $btn
}

AddLabel 'Export folder' 0
$exportBox = AddTextBox 0
AddButton 'Folder' 0 2 { 
  $fb = New-Object System.Windows.Forms.FolderBrowserDialog
  if ($fb.ShowDialog() -eq 'OK') { $exportBox.Text = $fb.SelectedPath }
} | Out-Null
AddButton 'Zip' 0 3 {
  $fd = New-Object System.Windows.Forms.OpenFileDialog
  $fd.Filter = 'Zip files|*.zip|All files|*.*'
  if ($fd.ShowDialog() -eq 'OK') { $exportBox.Text = $fd.FileName }
} | Out-Null

AddLabel 'Album title' 1
$titleBox = AddTextBox 1
$panel.Controls.Add((New-Object System.Windows.Forms.Label), 2, 1) | Out-Null
$panel.Controls.Add((New-Object System.Windows.Forms.Label), 3, 1) | Out-Null

AddLabel 'Album art (optional)' 2
$artBox = AddTextBox 2
AddButton 'Browse' 2 2 { 
  $fd = New-Object System.Windows.Forms.OpenFileDialog
  $fd.Filter = 'Image files|*.jpg;*.jpeg;*.png;*.gif;*.webp|All files|*.*'
  if ($fd.ShowDialog() -eq 'OK') { $artBox.Text = $fd.FileName }
} | Out-Null
$panel.Controls.Add((New-Object System.Windows.Forms.Label), 3, 2) | Out-Null

AddLabel 'Album edit URL (optional)' 3
$urlBox = AddTextBox 3
$urlBox.Text = 'https://americasnexttopsong.bandcamp.com/edit_album'
$panel.Controls.Add((New-Object System.Windows.Forms.Label), 2, 3) | Out-Null
$panel.Controls.Add((New-Object System.Windows.Forms.Label), 3, 3) | Out-Null

$note = New-Object System.Windows.Forms.Label
$note.Text = 'Choose the Export folder or the Export .zip. CSV is detected too.'
$note.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$note.AutoSize = $true
$note.Location = New-Object System.Drawing.Point(16, 305)
$form.Controls.Add($note)

$start = New-Object System.Windows.Forms.Button
$start.Text = 'Start Upload'
$start.Font = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
$start.BackColor = [System.Drawing.Color]::FromArgb(88, 141, 255)
$start.ForeColor = [System.Drawing.Color]::White
$start.Size = New-Object System.Drawing.Size(140, 36)
$start.Location = New-Object System.Drawing.Point(16, 330)
$start.Add_Click({
  if ([string]::IsNullOrWhiteSpace($exportBox.Text) -or [string]::IsNullOrWhiteSpace($titleBox.Text)) {
    [System.Windows.Forms.MessageBox]::Show('Export folder and album title are required.', 'ANTS Uploader') | Out-Null
    return
  }

  $args = @('--gui', '--export-folder', $exportBox.Text, '--album-title', $titleBox.Text)
  if (-not [string]::IsNullOrWhiteSpace($artBox.Text)) { $args += @('--album-art', $artBox.Text) }
  if (-not [string]::IsNullOrWhiteSpace($urlBox.Text)) { $args += @('--album-url', $urlBox.Text) }

  $start.Enabled = $false
  $start.Text = 'Running...'
  try { Add-Content -Path $launcherLog -Value "$(Get-Date -Format o) - Starting uploader" } catch {}
  $proc = Start-Process -FilePath $nodeCmd.Source -ArgumentList @($uploaderPath) + $args -WindowStyle Hidden -PassThru
  Start-Sleep -Seconds 2
  if ($proc.HasExited) {
    $msg = 'Uploader exited early. Please check the log at: ' + `
      [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), 'bandcamp_uploader_last_log.txt')
    [System.Windows.Forms.MessageBox]::Show($msg, 'ANTS Uploader') | Out-Null
    $start.Enabled = $true
    $start.Text = 'Start Upload'
    return
  }
  $form.Close()
})
$form.Controls.Add($start)

[void]$form.ShowDialog()
