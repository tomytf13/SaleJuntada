$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$publicDirectory = Join-Path (Split-Path -Parent $PSScriptRoot) "public"

function New-RoundedRectanglePath(
  [float]$x,
  [float]$y,
  [float]$width,
  [float]$height,
  [float]$radius
) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = $radius * 2
  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Add-RoundedRectangle(
  [System.Drawing.Graphics]$graphics,
  [System.Drawing.Brush]$brush,
  [float]$x,
  [float]$y,
  [float]$width,
  [float]$height,
  [float]$radius
) {
  $path = New-RoundedRectanglePath $x $y $width $height $radius
  try {
    $graphics.FillPath($brush, $path)
  } finally {
    $path.Dispose()
  }
}

function New-PwaIcon([int]$size, [bool]$maskable, [string]$outputName) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $scale = $size / 512.0

  $cream = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#F7F5EF"))
  $blue = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#0C79D8"))
  $brightBlue = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#2E9EFF"))
  $lightBlue = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#68C4FF"))

  try {
    if ($maskable) {
      $graphics.FillRectangle($blue, 0, 0, $size, $size)
      Add-RoundedRectangle $graphics $cream (86 * $scale) (86 * $scale) (340 * $scale) (340 * $scale) (92 * $scale)
      Add-RoundedRectangle $graphics $lightBlue (239 * $scale) (241 * $scale) (147 * $scale) (147 * $scale) (40 * $scale)
      Add-RoundedRectangle $graphics $blue (283.227 * $scale) (94 * $scale) (102.773 * $scale) (102.773 * $scale) (29.364 * $scale)
      Add-RoundedRectangle $graphics $blue (92 * $scale) (283.227 * $scale) (102.773 * $scale) (102.773 * $scale) (29.364 * $scale)
      Add-RoundedRectangle $graphics $brightBlue (92 * $scale) (94 * $scale) (147 * $scale) (147 * $scale) (40 * $scale)
    } else {
      Add-RoundedRectangle $graphics $cream 0 0 $size $size (112 * $scale)
      Add-RoundedRectangle $graphics $lightBlue (233.636 * $scale) (234.545 * $scale) (222.364 * $scale) (222.455 * $scale) (60.636 * $scale)
      Add-RoundedRectangle $graphics $blue (300.455 * $scale) (12 * $scale) (155.545 * $scale) (155.545 * $scale) (44.455 * $scale)
      Add-RoundedRectangle $graphics $blue (11 * $scale) (300.455 * $scale) (155.545 * $scale) (155.545 * $scale) (44.455 * $scale)
      Add-RoundedRectangle $graphics $brightBlue (11.182 * $scale) (12.182 * $scale) (222.364 * $scale) (222.364 * $scale) (60.636 * $scale)
    }

    $outputPath = Join-Path $publicDirectory $outputName
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output "Generated $outputPath"
  } finally {
    $cream.Dispose()
    $blue.Dispose()
    $brightBlue.Dispose()
    $lightBlue.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

New-PwaIcon 192 $false "pwa-icon-192.png"
New-PwaIcon 512 $false "pwa-icon-512.png"
New-PwaIcon 512 $true "pwa-icon-maskable-512.png"
