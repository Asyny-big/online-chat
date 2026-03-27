Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'

function U {
  param([string]$Value)
  return [regex]::Unescape($Value)
}

function ColorFromHex {
  param([string]$Hex)
  return [System.Drawing.ColorTranslator]::FromHtml($Hex)
}

function New-RoundedRectPath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = [Math]::Min($Radius * 2, [Math]::Min($Width, $Height))

  if ($diameter -le 0) {
    $path.AddRectangle([System.Drawing.RectangleF]::new($X, $Y, $Width, $Height))
    return $path
  }

  $arc = [System.Drawing.RectangleF]::new($X, $Y, $diameter, $diameter)
  $path.AddArc($arc, 180, 90)
  $arc.X = $X + $Width - $diameter
  $path.AddArc($arc, 270, 90)
  $arc.Y = $Y + $Height - $diameter
  $path.AddArc($arc, 0, 90)
  $arc.X = $X
  $path.AddArc($arc, 90, 90)
  $path.CloseFigure()
  return $path
}

function Draw-RoundedRect {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Brush]$Brush,
    [System.Drawing.Pen]$Pen,
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $path = New-RoundedRectPath -X $X -Y $Y -Width $Width -Height $Height -Radius $Radius
  if ($null -ne $Brush) {
    $Graphics.FillPath($Brush, $path)
  }
  if ($null -ne $Pen) {
    $Graphics.DrawPath($Pen, $path)
  }
  $path.Dispose()
}

function Draw-AnchorDot {
  param(
    [System.Drawing.Graphics]$Graphics,
    [float]$X,
    [float]$Y,
    [float]$Radius
  )

  $fill = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $stroke = New-Object System.Drawing.Pen((ColorFromHex '#8AD8FF'), 3)
  $Graphics.FillEllipse($fill, $X - $Radius, $Y - $Radius, $Radius * 2, $Radius * 2)
  $Graphics.DrawEllipse($stroke, $X - $Radius, $Y - $Radius, $Radius * 2, $Radius * 2)
  $fill.Dispose()
  $stroke.Dispose()
}

function Draw-ArrowLabel {
  param(
    [System.Drawing.Graphics]$Graphics,
    [string]$Text,
    [System.Drawing.Font]$Font,
    [float]$CenterX,
    [float]$CenterY
  )

  $size = $Graphics.MeasureString($Text, $Font)
  $paddingX = 18
  $paddingY = 10
  $w = [float]($size.Width + $paddingX * 2)
  $h = [float]($size.Height + $paddingY * 2)
  $x = [float]($CenterX - $w / 2)
  $y = [float]($CenterY - $h / 2)

  $bg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $border = New-Object System.Drawing.Pen((ColorFromHex '#A7DAFF'), 2)
  $textBrush = New-Object System.Drawing.SolidBrush((ColorFromHex '#4F6075'))
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center

  Draw-RoundedRect -Graphics $Graphics -Brush $bg -Pen $border -X $x -Y $y -Width $w -Height $h -Radius 18
  $Graphics.DrawString($Text, $Font, $textBrush, [System.Drawing.RectangleF]::new($x, $y, $w, $h), $format)

  $format.Dispose()
  $textBrush.Dispose()
  $border.Dispose()
  $bg.Dispose()
}

function Draw-BezierArrow {
  param(
    [System.Drawing.Graphics]$Graphics,
    [float]$X1,
    [float]$Y1,
    [float]$Cx1,
    [float]$Cy1,
    [float]$Cx2,
    [float]$Cy2,
    [float]$X2,
    [float]$Y2,
    [string]$Label,
    [System.Drawing.Font]$LabelFont,
    [float]$LabelX,
    [float]$LabelY
  )

  $lineColor = ColorFromHex '#8AD8FF'
  $glow = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(90, $lineColor), 12)
  $pen = New-Object System.Drawing.Pen($lineColor, 5)
  $pen.CustomEndCap = New-Object System.Drawing.Drawing2D.AdjustableArrowCap(8, 10, $true)

  $Graphics.DrawBezier($glow, $X1, $Y1, $Cx1, $Cy1, $Cx2, $Cy2, $X2, $Y2)
  $Graphics.DrawBezier($pen, $X1, $Y1, $Cx1, $Cy1, $Cx2, $Cy2, $X2, $Y2)
  Draw-AnchorDot -Graphics $Graphics -X $X1 -Y $Y1 -Radius 8
  Draw-AnchorDot -Graphics $Graphics -X $X2 -Y $Y2 -Radius 8
  Draw-ArrowLabel -Graphics $Graphics -Text $Label -Font $LabelFont -CenterX $LabelX -CenterY $LabelY

  $pen.Dispose()
  $glow.Dispose()
}

$downloadsDir = 'C:\Users\larak\Downloads'
$feedPath = (Get-ChildItem -Path $downloadsDir -File | Where-Object { $_.Name -like '*004003.png' } | Select-Object -First 1 -ExpandProperty FullName)
$messagesPath = (Get-ChildItem -Path $downloadsDir -File | Where-Object { $_.Name -like '*004744.png' } | Select-Object -First 1 -ExpandProperty FullName)
$profilePath = (Get-ChildItem -Path $downloadsDir -File | Where-Object { $_.Name -like '*20_09_48.png' } | Select-Object -First 1 -ExpandProperty FullName)

foreach ($path in @($feedPath, $messagesPath, $profilePath)) {
  if (-not (Test-Path $path)) {
    throw "File not found: $path"
  }
}

$feedImg = [System.Drawing.Image]::FromFile($feedPath)
$messagesImg = [System.Drawing.Image]::FromFile($messagesPath)
$profileImg = [System.Drawing.Image]::FromFile($profilePath)

$canvasWidth = 4080
$canvasHeight = 1280
$bitmap = New-Object System.Drawing.Bitmap($canvasWidth, $canvasHeight)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$graphics.Clear((ColorFromHex '#F5F7FB'))

$titleFont = New-Object System.Drawing.Font('Segoe UI', 28, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$labelFont = New-Object System.Drawing.Font('Segoe UI', 22, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$captionFont = New-Object System.Drawing.Font('Times New Roman', 28, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$titleBrush = New-Object System.Drawing.SolidBrush((ColorFromHex '#33455D'))
$captionBrush = New-Object System.Drawing.SolidBrush((ColorFromHex '#2D3442'))
$frameBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$framePen = New-Object System.Drawing.Pen((ColorFromHex '#D8E0EC'), 2)

$screenTop = 150
$screenHeight = 760.0
$marginLeft = 48.0
$gap = 34.0

$feedWidth = [float]($screenHeight * ($feedImg.Width / [double]$feedImg.Height))
$messagesWidth = [float]($screenHeight * ($messagesImg.Width / [double]$messagesImg.Height))
$profileWidth = [float]($screenHeight * ($profileImg.Width / [double]$profileImg.Height))

$feedRect = [System.Drawing.RectangleF]::new($marginLeft, $screenTop, $feedWidth, $screenHeight)
$messagesRect = [System.Drawing.RectangleF]::new($feedRect.Right + $gap, $screenTop, $messagesWidth, $screenHeight)
$profileRect = [System.Drawing.RectangleF]::new($messagesRect.Right + $gap, $screenTop, $profileWidth, $screenHeight)

foreach ($rect in @($feedRect, $messagesRect, $profileRect)) {
  Draw-RoundedRect -Graphics $graphics -Brush $frameBrush -Pen $framePen -X ($rect.X - 6) -Y ($rect.Y - 6) -Width ($rect.Width + 12) -Height ($rect.Height + 12) -Radius 12
}

$graphics.DrawImage($feedImg, $feedRect)
$graphics.DrawImage($messagesImg, $messagesRect)
$graphics.DrawImage($profileImg, $profileRect)

$titleFeed = U '\u041b\u0435\u043d\u0442\u0430 \u043f\u0443\u0431\u043b\u0438\u043a\u0430\u0446\u0438\u0439'
$titleMessages = U '\u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439'
$titleProfile = U '\u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430 \u043f\u0440\u043e\u0444\u0438\u043b\u044f'
$labelDialog = U '\u043f\u0435\u0440\u0435\u0445\u043e\u0434 \u043a \u0434\u0438\u0430\u043b\u043e\u0433\u0443'
$labelOpenProfile = U '\u043e\u0442\u043a\u0440\u044b\u0442\u0438\u0435 \u043f\u0440\u043e\u0444\u0438\u043b\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f'
$labelBackToFeed = U '\u0432\u043e\u0437\u0432\u0440\u0430\u0442 \u043a \u043b\u0435\u043d\u0442\u0435'
$figureCaption = U '\u0420\u0438\u0441. 3.X \u2013 \u0414\u0438\u043d\u0430\u043c\u0438\u0447\u0435\u0441\u043a\u0438\u0439 \u043f\u0440\u043e\u0442\u043e\u0442\u0438\u043f \u0438\u043d\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430'

$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$graphics.DrawString($titleFeed, $titleFont, $titleBrush, [System.Drawing.PointF]::new($feedRect.X + $feedRect.Width / 2, 84), $sf)
$graphics.DrawString($titleMessages, $titleFont, $titleBrush, [System.Drawing.PointF]::new($messagesRect.X + $messagesRect.Width / 2, 84), $sf)
$graphics.DrawString($titleProfile, $titleFont, $titleBrush, [System.Drawing.PointF]::new($profileRect.X + $profileRect.Width / 2, 84), $sf)

# Feed -> Messages: message icon to selected chat item.
$feedStartX = [float]($feedRect.X + $feedRect.Width * 0.028)
$feedStartY = [float]($feedRect.Y + $feedRect.Height * 0.301)
$msgTargetX = [float]($messagesRect.X + $messagesRect.Width * 0.144)
$msgTargetY = [float]($messagesRect.Y + $messagesRect.Height * 0.120)
Draw-BezierArrow `
  -Graphics $graphics `
  -X1 $feedStartX -Y1 $feedStartY `
  -Cx1 ($feedRect.Right + 80) -Cy1 ($feedRect.Y + 95) `
  -Cx2 ($messagesRect.X - 80) -Cy2 ($messagesRect.Y + 130) `
  -X2 $msgTargetX -Y2 $msgTargetY `
  -Label $labelDialog `
  -LabelFont $labelFont `
  -LabelX (($feedRect.Right + $messagesRect.X) / 2) `
  -LabelY ($screenTop + 116)

# Messages -> Profile: chat avatar/name to profile card.
$messagesStartX = [float]($messagesRect.X + $messagesRect.Width * 0.257)
$messagesStartY = [float]($messagesRect.Y + $messagesRect.Height * 0.032)
$profileTargetX = [float]($profileRect.X + $profileRect.Width * 0.305)
$profileTargetY = [float]($profileRect.Y + $profileRect.Height * 0.170)
Draw-BezierArrow `
  -Graphics $graphics `
  -X1 $messagesStartX -Y1 $messagesStartY `
  -Cx1 ($messagesRect.X + $messagesRect.Width * 0.55) -Cy1 40 `
  -Cx2 ($profileRect.X - 70) -Cy2 48 `
  -X2 $profileTargetX -Y2 $profileTargetY `
  -Label $labelOpenProfile `
  -LabelFont $labelFont `
  -LabelX (($messagesRect.Right + $profileRect.X) / 2) `
  -LabelY 26

# Profile -> Feed: home icon to feed post card.
$profileStartX = [float]($profileRect.X + $profileRect.Width * 0.026)
$profileStartY = [float]($profileRect.Y + $profileRect.Height * 0.137)
$feedTargetX = [float]($feedRect.X + $feedRect.Width * 0.540)
$feedTargetY = [float]($feedRect.Y + $feedRect.Height * 0.305)
Draw-BezierArrow `
  -Graphics $graphics `
  -X1 $profileStartX -Y1 $profileStartY `
  -Cx1 ($profileRect.X + $profileRect.Width * 0.05) -Cy1 ($profileRect.Bottom + 210) `
  -Cx2 ($feedRect.X + $feedRect.Width * 0.80) -Cy2 ($feedRect.Bottom + 170) `
  -X2 $feedTargetX -Y2 $feedTargetY `
  -Label $labelBackToFeed `
  -LabelFont $labelFont `
  -LabelX (($feedRect.Right + $profileRect.X) / 2) `
  -LabelY ($screenTop + $screenHeight + 150)

$graphics.DrawString($figureCaption, $captionFont, $captionBrush, [System.Drawing.PointF]::new($canvasWidth / 2, 1225), $sf)

$root = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $root 'artifacts'
if (-not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}
$outputPath = Join-Path $outputDir 'dynamic-prototype-interface.png'
$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$sf.Dispose()
$framePen.Dispose()
$frameBrush.Dispose()
$titleBrush.Dispose()
$captionBrush.Dispose()
$titleFont.Dispose()
$labelFont.Dispose()
$captionFont.Dispose()
$feedImg.Dispose()
$messagesImg.Dispose()
$profileImg.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

Write-Output $outputPath
