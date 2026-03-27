Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'

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

function Get-Color {
  param([string]$Hex)
  return [System.Drawing.ColorTranslator]::FromHtml($Hex)
}

function Draw-Anchor {
  param(
    [System.Drawing.Graphics]$Graphics,
    [float]$X,
    [float]$Y,
    [float]$Radius,
    [System.Drawing.Color]$FillColor,
    [System.Drawing.Color]$StrokeColor
  )

  $fill = New-Object System.Drawing.SolidBrush($FillColor)
  $pen = New-Object System.Drawing.Pen($StrokeColor, [Math]::Max(2, $Radius / 3))
  $Graphics.FillEllipse($fill, $X - $Radius, $Y - $Radius, $Radius * 2, $Radius * 2)
  $Graphics.DrawEllipse($pen, $X - $Radius, $Y - $Radius, $Radius * 2, $Radius * 2)
  $fill.Dispose()
  $pen.Dispose()
}

function Draw-ArrowLabel {
  param(
    [System.Drawing.Graphics]$Graphics,
    [string]$Text,
    [float]$CenterX,
    [float]$CenterY,
    [System.Drawing.Font]$Font
  )

  $size = $Graphics.MeasureString($Text, $Font)
  $paddingX = 18
  $paddingY = 10
  $w = $size.Width + $paddingX * 2
  $h = $size.Height + $paddingY * 2
  $x = $CenterX - ($w / 2)
  $y = $CenterY - ($h / 2)

  $bg = New-Object System.Drawing.SolidBrush((Get-Color '#FFFFFF'))
  $border = New-Object System.Drawing.Pen((Get-Color '#9EDBFF'), 2)
  Draw-RoundedRect -Graphics $Graphics -Brush $bg -Pen $border -X $x -Y $y -Width $w -Height $h -Radius 18

  $textBrush = New-Object System.Drawing.SolidBrush((Get-Color '#2C4C63'))
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $Graphics.DrawString($Text, $Font, $textBrush, [System.Drawing.RectangleF]::new($x, $y, $w, $h), $format)

  $format.Dispose()
  $textBrush.Dispose()
  $bg.Dispose()
  $border.Dispose()
}

function Draw-PrototypeArrow {
  param(
    [System.Drawing.Graphics]$Graphics,
    [object[]]$Points,
    [string]$Label,
    [float]$LabelX,
    [float]$LabelY,
    [System.Drawing.Font]$LabelFont
  )

  $coords = @()
  foreach ($point in $Points) {
    if ($point -is [System.Array]) {
      foreach ($item in $point) {
        $coords += [float]$item
      }
    } else {
      $coords += [float]$point
    }
  }

  if ($coords.Count -lt 8) {
    throw 'Prototype arrow requires 8 coordinates.'
  }

  $color = Get-Color '#8AD8FF'
  $glowPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, $color), 12)
  $linePen = New-Object System.Drawing.Pen($color, 5)
  $linePen.CustomEndCap = New-Object System.Drawing.Drawing2D.AdjustableArrowCap(8, 10, $true)
  $Graphics.DrawBezier($glowPen, $coords[0], $coords[1], $coords[2], $coords[3], $coords[4], $coords[5], $coords[6], $coords[7])
  $Graphics.DrawBezier($linePen, $coords[0], $coords[1], $coords[2], $coords[3], $coords[4], $coords[5], $coords[6], $coords[7])

  Draw-Anchor -Graphics $Graphics -X $coords[0] -Y $coords[1] -Radius 9 -FillColor (Get-Color '#FFFFFF') -StrokeColor $color
  Draw-Anchor -Graphics $Graphics -X $coords[6] -Y $coords[7] -Radius 9 -FillColor (Get-Color '#FFFFFF') -StrokeColor $color
  Draw-ArrowLabel -Graphics $Graphics -Text $Label -CenterX $LabelX -CenterY $LabelY -Font $LabelFont

  $linePen.Dispose()
  $glowPen.Dispose()
}

function Draw-Text {
  param(
    [System.Drawing.Graphics]$Graphics,
    [string]$Text,
    [System.Drawing.Font]$Font,
    [System.Drawing.Brush]$Brush,
    [float]$X,
    [float]$Y
  )
  $Graphics.DrawString($Text, $Font, $Brush, $X, $Y)
}

function New-SolidBrush {
  param([string]$Hex)
  return New-Object System.Drawing.SolidBrush((Get-Color $Hex))
}

function New-Pen {
  param(
    [string]$Hex,
    [float]$Width = 1
  )
  return New-Object System.Drawing.Pen((Get-Color $Hex), $Width)
}

function Decode-Base64Utf8 {
  param([string]$Value)
  return [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($Value))
}

function From-UnicodeEscape {
  param([string]$Value)
  return [regex]::Unescape($Value)
}

function Scalar-Float {
  param([object]$Value)
  return [float](@($Value)[0])
}

function Draw-IconCircle {
  param(
    [System.Drawing.Graphics]$Graphics,
    [float]$Cx,
    [float]$Cy,
    [float]$Size,
    [string]$FillHex,
    [bool]$Active = $false
  )

  if ($Active) {
    $glow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(65, (Get-Color '#4F83FF')))
    $Graphics.FillEllipse($glow, $Cx - ($Size * 0.9), $Cy - ($Size * 0.9), $Size * 1.8, $Size * 1.8)
    $glow.Dispose()
  }

  $fill = New-SolidBrush $FillHex
  $Graphics.FillEllipse($fill, $Cx - ($Size / 2), $Cy - ($Size / 2), $Size, $Size)
  $fill.Dispose()
}

function Draw-MessagesScreen {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.RectangleF]$Rect
  )

  $baseW = 2048.0
  $baseH = 1131.0

  function SX([double]$Value) { return [float]($Rect.X + ($Value / $baseW) * $Rect.Width) }
  function SY([double]$Value) { return [float]($Rect.Y + ($Value / $baseH) * $Rect.Height) }
  function SW([double]$Value) { return [float](($Value / $baseW) * $Rect.Width) }
  function SH([double]$Value) { return [float](($Value / $baseH) * $Rect.Height) }

  $bg = New-SolidBrush '#0A1019'
  $sidebar = New-SolidBrush '#192434'
  $nav = New-SolidBrush '#0A1220'
  $panel = New-SolidBrush '#141C2B'
  $panel2 = New-SolidBrush '#182336'
  $active = New-SolidBrush '#4E78FF'
  $muted = New-SolidBrush '#8B95AB'
  $text = New-SolidBrush '#F0F4FF'
  $textSoft = New-SolidBrush '#C9D1E7'
  $chip = New-SolidBrush '#223754'
  $bubbleLeft = New-SolidBrush '#17243A'
  $bubbleRight = New-SolidBrush '#3775FF'
  $border = New-Pen '#273246' 1.4
  $divider = New-Pen '#273246' 1.0

  $fontTitle = New-Object System.Drawing.Font('Segoe UI', [float](SH 23), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $fontBody = New-Object System.Drawing.Font('Segoe UI', [float](SH 17), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $fontSmall = New-Object System.Drawing.Font('Segoe UI', [float](SH 13), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $fontBold = New-Object System.Drawing.Font('Segoe UI', [float](SH 17), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $fontChat = New-Object System.Drawing.Font('Segoe UI', [float](SH 20), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $msgNewChat = From-UnicodeEscape '\u041d\u043e\u0432\u044b\u0439 \u0447\u0430\u0442'
  $msgChats = From-UnicodeEscape '\u0427\u0410\u0422\u042b'
  $msgSupport = From-UnicodeEscape '\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0430'
  $msgPreviewSupport = From-UnicodeEscape '\u041f\u0440\u0438\u0432\u0435\u0442! \u0423 \u043c\u0435\u043d\u044f \u0432\u0441\u0451 \u043e\u0442\u043b\u0438\u0447\u043d\u043e, \u0441\u043f\u0430\u0441\u0438\u0431\u043e...'
  $msgYouHere = From-UnicodeEscape '\u0442\u044b \u0442\u0443\u0442?'
  $msgBye = From-UnicodeEscape '\u043f\u043e\u043a\u0430'
  $msgLora = From-UnicodeEscape '\u041b\u043e\u0440\u0430'
  $msgOlga = From-UnicodeEscape '\u041e\u043b\u044c\u0433\u0430'
  $msgOpka = From-UnicodeEscape '\u043e\u043f\u043a\u0430'
  $msgVideo = From-UnicodeEscape '\u0412\u0438\u0434\u0435\u043e'
  $msgAll = From-UnicodeEscape '\u0432\u0441\u0435?'
  $msgNoMessages = From-UnicodeEscape '\u041d\u0435\u0442 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439'
  $msgVoice = From-UnicodeEscape '\u0413\u043e\u043b\u043e\u0441\u043e\u0432\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435'
  $msgTip = From-UnicodeEscape '\u041f\u043e\u0434\u0441\u043a\u0430\u0437\u0430\u0442\u044c, \u0447\u0442\u043e \u0434\u0435\u043b\u0430\u0442\u044c \u043f\u0440\u0438 \u043f\u0440\u043e\u0431\u043b\u0435\u043c\u0430\u0445 \u0441 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435\u043c'
  $msgDescribe = From-UnicodeEscape '\u041f\u0440\u043e\u0441\u0442\u043e \u043e\u043f\u0438\u0448\u0438\u0442\u0435, \u0447\u0442\u043e \u0438\u043c\u0435\u043d\u043d\u043e \u0432\u0430\u0441 \u0438\u043d\u0442\u0435\u0440\u0435\u0441\u0443\u0435\u0442!'
  $msgToday = From-UnicodeEscape '\u0441\u0435\u0433\u043e\u0434\u043d\u044f'
  $msgSupportGov = From-UnicodeEscape '\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0430 GovChat'
  $msgUnavailable = From-UnicodeEscape '\u0421\u0435\u0439\u0447\u0430\u0441 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0430 \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u043d\u0430\u043f\u0438\u0441\u0430\u0442\u044c \u0447\u0443\u0442\u044c \u043f\u043e\u0437\u0436\u0435.'
  $msgHowHelp = From-UnicodeEscape '\u041f\u0440\u0438\u0432\u0435\u0442! \u0427\u0435\u043c \u043c\u043e\u0433\u0443 \u043f\u043e\u043c\u043e\u0447\u044c?'
  $msgHi = From-UnicodeEscape '\u0445\u0430\u0439'
  $msgHowAreYou = From-UnicodeEscape '\u043f\u0440\u0438\u0432\u0435\u0442 \u043a\u0430\u043a \u0434\u0435\u043b\u0430'
  $msgHelloFine = From-UnicodeEscape '\u041f\u0440\u0438\u0432\u0435\u0442! \u0423 \u043c\u0435\u043d\u044f \u0432\u0441\u0451 \u043e\u0442\u043b\u0438\u0447\u043d\u043e, \u0441\u043f\u0430\u0441\u0438\u0431\u043e.'
  $msgHereToHelp = From-UnicodeEscape '\u042f \u0437\u0434\u0435\u0441\u044c, \u0447\u0442\u043e\u0431\u044b \u043f\u043e\u043c\u043e\u0433\u0430\u0442\u044c \u0441 GovChat \u2014 \u043c\u043e\u0433\u0443 \u043f\u043e\u0434\u0441\u043a\u0430\u0437\u0430\u0442\u044c \u043f\u0440\u043e:'
  $msgLine1 = From-UnicodeEscape '\u041e\u0442\u043f\u0440\u0430\u0432\u043a\u0443 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u0438 \u0441\u043e\u0437\u0434\u0430\u043d\u0438\u0435 \u0433\u0440\u0443\u043f\u043f'
  $msgLine2 = From-UnicodeEscape '\u0417\u0432\u043e\u043d\u043a\u0438 (\u0433\u043e\u043b\u043e\u0441/\u0432\u0438\u0434\u0435\u043e) \u0438 \u0438\u0445 \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0443'
  $msgLine3 = From-UnicodeEscape '\u0420\u0430\u0431\u043e\u0442\u0443 \u0441 \u0444\u0430\u0439\u043b\u0430\u043c\u0438 \u0438 \u0432\u043b\u043e\u0436\u0435\u043d\u0438\u044f\u043c\u0438'
  $msgLine4 = From-UnicodeEscape '\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0443 \u043f\u0440\u043e\u0444\u0438\u043b\u044f \u0438 \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0439'
  $msgLine5 = From-UnicodeEscape '\u0420\u0435\u0448\u0435\u043d\u0438\u0435 \u043f\u0440\u043e\u0431\u043b\u0435\u043c \u0441 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435\u043c \u0438\u043b\u0438 \u043f\u0440\u043e\u0438\u0437\u0432\u043e\u0434\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c\u044e'
  $msgTellMe = From-UnicodeEscape '\u0420\u0430\u0441\u0441\u043a\u0430\u0436\u0438\u0442\u0435, \u0447\u0442\u043e \u0438\u043c\u0435\u043d\u043d\u043e \u0432\u0430\u0441 \u0438\u043d\u0442\u0435\u0440\u0435\u0441\u0443\u0435\u0442?'
  $msgInput = From-UnicodeEscape '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435...'

  $Graphics.FillRectangle($bg, $Rect)
  $Graphics.FillRectangle($nav, [System.Drawing.RectangleF]::new((SX 0), (SY 0), (SW 98), (SH 1131)))
  $Graphics.FillRectangle($sidebar, [System.Drawing.RectangleF]::new((SX 98), (SY 0), (SW 387), (SH 1131)))
  $Graphics.DrawLine($divider, [float](SX 98), [float](SY 0), [float](SX 98), [float](SY 1131))
  $Graphics.DrawLine($divider, [float](SX 485), [float](SY 0), [float](SX 485), [float](SY 1131))

  Draw-IconCircle -Graphics $Graphics -Cx (SX 48) -Cy (SY 48) -Size (SW 58) -FillHex '#4B6DFF' -Active $true
  Draw-IconCircle -Graphics $Graphics -Cx (SX 48) -Cy (SY 140) -Size (SW 42) -FillHex '#0A1220'
  Draw-IconCircle -Graphics $Graphics -Cx (SX 48) -Cy (SY 210) -Size (SW 42) -FillHex '#0A1220'
  Draw-IconCircle -Graphics $Graphics -Cx (SX 48) -Cy (SY 280) -Size (SW 42) -FillHex '#0A1220'
  Draw-IconCircle -Graphics $Graphics -Cx (SX 48) -Cy (SY 348) -Size (SW 58) -FillHex '#4B6DFF' -Active $true
  Draw-IconCircle -Graphics $Graphics -Cx (SX 48) -Cy (SY 420) -Size (SW 42) -FillHex '#0A1220'

  $badgeBrush = New-SolidBrush '#FF4D5A'
  Draw-RoundedRect -Graphics $Graphics -Brush $badgeBrush -Pen $null -X (SX 56) -Y (SY 258) -Width (SW 38) -Height (SH 24) -Radius (SH 12)
  Draw-Text -Graphics $Graphics -Text '29' -Font $fontSmall -Brush $text -X (SX 67) -Y (SY 262)

  Draw-RoundedRect -Graphics $Graphics -Brush $panel -Pen $border -X (SX 112) -Y (SY 18) -Width (SW 355) -Height (SH 55) -Radius (SH 14)
  Draw-IconCircle -Graphics $Graphics -Cx (SX 136) -Cy (SY 45) -Size (SW 32) -FillHex '#4B6DFF'
  Draw-Text -Graphics $Graphics -Text 'GovChat' -Font $fontTitle -Brush $text -X (SX 160) -Y (SY 28)
  Draw-RoundedRect -Graphics $Graphics -Brush $panel -Pen $border -X (SX 306) -Y (SY 18) -Width (SW 162) -Height (SH 42) -Radius (SH 14)
  Draw-Text -Graphics $Graphics -Text "+  $msgNewChat" -Font $fontBold -Brush $textSoft -X (SX 320) -Y (SY 27)

  Draw-Text -Graphics $Graphics -Text $msgChats -Font $fontSmall -Brush $textSoft -X (SX 118) -Y (SY 92)

  $chatY = 136
  $chatStep = 82
  $chatItems = @(
    @{ Name = $msgSupport; Preview = $msgPreviewSupport; Initial = 'П'; Active = $true; Group = $false },
    @{ Name = 'Denischik'; Preview = $msgYouHere; Initial = 'D'; Active = $false; Group = $false },
    @{ Name = $msgLora; Preview = $msgBye; Initial = 'Л'; Active = $false; Group = $false },
    @{ Name = 'Sasha1'; Preview = 're]'; Initial = 'S'; Active = $false; Group = $false },
    @{ Name = $msgOlga; Preview = $msgVideo; Initial = 'O'; Active = $false; Group = $false },
    @{ Name = $msgOpka; Preview = $msgAll; Initial = 'G'; Active = $false; Group = $true },
    @{ Name = 'b rnj'; Preview = $msgNoMessages; Initial = 'G'; Active = $false; Group = $true },
    @{ Name = 'NOUT'; Preview = 'ay'; Initial = 'N'; Active = $false; Group = $false },
    @{ Name = 'xcvbnm'; Preview = $msgVoice; Initial = 'G'; Active = $false; Group = $true }
  )

  foreach ($item in $chatItems) {
    if ($chatY -gt 820) { break }
    if ($item.Active) {
      Draw-RoundedRect -Graphics $Graphics -Brush $active -Pen $null -X (SX 112) -Y (SY $chatY) -Width (SW 356) -Height (SH 67) -Radius (SH 16)
    }

    $circleFill = if ($item.Group) { '#993DE9' } else { '#755CFF' }
    Draw-IconCircle -Graphics $Graphics -Cx (SX 150) -Cy (SY ($chatY + 34)) -Size (SW 46) -FillHex $circleFill
    Draw-Text -Graphics $Graphics -Text $item.Initial -Font $fontBold -Brush $text -X (SX 143) -Y (SY ($chatY + 24))
    Draw-Text -Graphics $Graphics -Text $item.Name -Font $fontBold -Brush $text -X (SX 195) -Y (SY ($chatY + 12))
    $previewBrush = if ($item.Active) { $textSoft } else { $muted }
    Draw-Text -Graphics $Graphics -Text $item.Preview -Font $fontBody -Brush $previewBrush -X (SX 195) -Y (SY ($chatY + 40))
    $chatY += $chatStep
  }

  Draw-RoundedRect -Graphics $Graphics -Brush $panel -Pen $null -X (SX 485) -Y (SY 0) -Width (SW 1563) -Height (SH 84) -Radius 0
  Draw-IconCircle -Graphics $Graphics -Cx (SX 528) -Cy (SY 46) -Size (SW 48) -FillHex '#7B65FF'
  Draw-Text -Graphics $Graphics -Text 'П' -Font $fontBold -Brush $text -X (SX 519) -Y (SY 32)
  Draw-Text -Graphics $Graphics -Text $msgSupport -Font $fontChat -Brush $text -X (SX 568) -Y (SY 27)
  Draw-Text -Graphics $Graphics -Text '...' -Font $fontChat -Brush $muted -X (SX 1975) -Y (SY 22)

  Draw-RoundedRect -Graphics $Graphics -Brush $bubbleLeft -Pen $null -X (SX 500) -Y (SY 12) -Width (SW 1010) -Height (SH 108) -Radius (SH 22)
  Draw-Text -Graphics $Graphics -Text "- $msgTip" -Font $fontBody -Brush $text -X (SX 530) -Y (SY 28)
  Draw-Text -Graphics $Graphics -Text $msgDescribe -Font $fontBody -Brush $text -X (SX 530) -Y (SY 74)
  Draw-Text -Graphics $Graphics -Text '21:36' -Font $fontSmall -Brush $muted -X (SX 520) -Y (SY 104)

  Draw-RoundedRect -Graphics $Graphics -Brush $chip -Pen $null -X (SX 1220) -Y (SY 210) -Width (SW 90) -Height (SH 36) -Radius (SH 18)
  Draw-Text -Graphics $Graphics -Text $msgToday -Font $fontSmall -Brush $textSoft -X (SX 1240) -Y (SY 219)

  Draw-RoundedRect -Graphics $Graphics -Brush $bubbleLeft -Pen $null -X (SX 502) -Y (SY 355) -Width (SW 610) -Height (SH 107) -Radius (SH 22)
  Draw-Text -Graphics $Graphics -Text $msgSupportGov -Font $fontBold -Brush $active -X (SX 520) -Y (SY 375)
  Draw-Text -Graphics $Graphics -Text $msgUnavailable -Font $fontBody -Brush $text -X (SX 520) -Y (SY 406)
  Draw-Text -Graphics $Graphics -Text '19:30' -Font $fontSmall -Brush $muted -X (SX 520) -Y (SY 442)

  Draw-RoundedRect -Graphics $Graphics -Brush $bubbleLeft -Pen $null -X (SX 502) -Y (SY 474) -Width (SW 265) -Height (SH 92) -Radius (SH 22)
  Draw-Text -Graphics $Graphics -Text $msgSupportGov -Font $fontBold -Brush $active -X (SX 520) -Y (SY 490)
  Draw-Text -Graphics $Graphics -Text $msgHowHelp -Font $fontBody -Brush $text -X (SX 520) -Y (SY 520)
  Draw-Text -Graphics $Graphics -Text '19:30' -Font $fontSmall -Brush $muted -X (SX 520) -Y (SY 546)

  Draw-RoundedRect -Graphics $Graphics -Brush $bubbleRight -Pen $null -X (SX 1920) -Y (SY 264) -Width (SW 74) -Height (SH 76) -Radius (SH 20)
  Draw-Text -Graphics $Graphics -Text $msgHi -Font $fontBody -Brush $text -X (SX 1940) -Y (SY 286)
  Draw-Text -Graphics $Graphics -Text '19:29' -Font $fontSmall -Brush $textSoft -X (SX 1938) -Y (SY 314)

  Draw-RoundedRect -Graphics $Graphics -Brush $bubbleRight -Pen $null -X (SX 1823) -Y (SY 598) -Width (SW 176) -Height (SH 76) -Radius (SH 20)
  Draw-Text -Graphics $Graphics -Text $msgHowAreYou -Font $fontBody -Brush $text -X (SX 1844) -Y (SY 620)
  Draw-Text -Graphics $Graphics -Text '22:48' -Font $fontSmall -Brush $textSoft -X (SX 1843) -Y (SY 649)

  Draw-RoundedRect -Graphics $Graphics -Brush $bubbleLeft -Pen $null -X (SX 502) -Y (SY 685) -Width (SW 468) -Height (SH 247) -Radius (SH 22)
  Draw-Text -Graphics $Graphics -Text $msgSupportGov -Font $fontBold -Brush $active -X (SX 520) -Y (SY 704)
  $multi = @(
    $msgHelloFine,
    $msgHereToHelp,
    '',
    "- $msgLine1",
    "- $msgLine2",
    "- $msgLine3",
    "- $msgLine4",
    "- $msgLine5",
    '',
    $msgTellMe
  )
  $lineY = 735
  foreach ($line in $multi) {
    Draw-Text -Graphics $Graphics -Text $line -Font $fontBody -Brush $text -X (SX 520) -Y (SY $lineY)
    $lineY += 30
  }
  Draw-Text -Graphics $Graphics -Text '22:49' -Font $fontSmall -Brush $muted -X (SX 520) -Y (SY 914)

  Draw-RoundedRect -Graphics $Graphics -Brush $panel -Pen $border -X (SX 485) -Y (SY 1045) -Width (SW 1563) -Height (SH 86) -Radius 0
  Draw-Text -Graphics $Graphics -Text '+' -Font $fontBold -Brush $muted -X (SX 518) -Y (SY 1082)
  Draw-RoundedRect -Graphics $Graphics -Brush $bg -Pen $border -X (SX 560) -Y (SY 1061) -Width (SW 1415) -Height (SH 58) -Radius (SH 16)
  Draw-Text -Graphics $Graphics -Text $msgInput -Font $fontBody -Brush $muted -X (SX 584) -Y (SY 1078)
  Draw-RoundedRect -Graphics $Graphics -Brush $panel2 -Pen $border -X (SX 1980) -Y (SY 1065) -Width (SW 48) -Height (SH 48) -Radius (SH 12)
  Draw-Text -Graphics $Graphics -Text 'mic' -Font $fontBody -Brush $textSoft -X (SX 1988) -Y (SY 1079)

  foreach ($obj in @($bg, $sidebar, $nav, $panel, $panel2, $active, $muted, $text, $textSoft, $chip, $bubbleLeft, $bubbleRight, $badgeBrush, $border, $divider, $fontTitle, $fontBody, $fontSmall, $fontBold, $fontChat)) {
    if ($null -ne $obj) { $obj.Dispose() }
  }
}

function Draw-FeedScreen {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.RectangleF]$Rect,
    [string]$PostImagePath
  )

  $baseW = 1536.0
  $baseH = 1024.0

  function FeedX([double]$Value) { return [float]($Rect.X + ($Value / $baseW) * $Rect.Width) }
  function FeedY([double]$Value) { return [float]($Rect.Y + ($Value / $baseH) * $Rect.Height) }
  function FeedW([double]$Value) { return [float](($Value / $baseW) * $Rect.Width) }
  function FeedH([double]$Value) { return [float](($Value / $baseH) * $Rect.Height) }

  $bg = New-SolidBrush '#1B1F2C'
  $nav = New-SolidBrush '#0A1220'
  $panel = New-SolidBrush '#17253A'
  $panel2 = New-SolidBrush '#121C2D'
  $accent = New-SolidBrush '#5A7BFF'
  $text = New-SolidBrush '#F2F5FF'
  $textSoft = New-SolidBrush '#AFB8D0'
  $muted = New-SolidBrush '#8693AB'
  $line = New-Pen '#2A3347' 1.3
  $tabLine = New-Pen '#5A7BFF' 3

  $fontTitle = New-Object System.Drawing.Font('Segoe UI', [float](FeedH 24), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $fontBody = New-Object System.Drawing.Font('Segoe UI', [float](FeedH 17), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $fontSmall = New-Object System.Drawing.Font('Segoe UI', [float](FeedH 14), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $fontBold = New-Object System.Drawing.Font('Segoe UI', [float](FeedH 18), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $feedPopular = From-UnicodeEscape '\u041f\u043e\u043f\u0443\u043b\u044f\u0440\u043d\u043e\u0435'
  $feedSubscriptions = From-UnicodeEscape '\u041f\u043e\u0434\u043f\u0438\u0441\u043a\u0438'
  $feedWhatsNew = From-UnicodeEscape '\u0427\u0442\u043e \u043d\u043e\u0432\u043e\u0433\u043e?'
  $feedVisibility = From-UnicodeEscape '\u0412\u0438\u0434\u0438\u043c\u043e\u0441\u0442\u044c'
  $feedAll = From-UnicodeEscape '\u0412\u0441\u0435'
  $feedPublish = From-UnicodeEscape '\u041e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u0442\u044c'
  $feedSasha = From-UnicodeEscape '\u0421\u0430\u0448\u0430'
  $feedDate = From-UnicodeEscape '26 \u043c\u0430\u0440., 19:33'
  $feedPostText = From-UnicodeEscape '\u0413\u0443\u0434 \u043c\u043e\u043d\u0438\u043d\u0433 \u0435\u043f\u0442\u0438\u0442\u044c'

  $Graphics.FillRectangle($bg, $Rect)
  $Graphics.FillRectangle($nav, [System.Drawing.RectangleF]::new((FeedX 0), (FeedY 0), (FeedW 92), (FeedH 1024)))
  $Graphics.DrawLine($line, [float](FeedX 92), [float](FeedY 0), [float](FeedX 92), [float](FeedY 1024))

  Draw-IconCircle -Graphics $Graphics -Cx (FeedX 46) -Cy (FeedY 48) -Size (FeedW 56) -FillHex '#4C6DFF' -Active $true
  Draw-IconCircle -Graphics $Graphics -Cx (FeedX 46) -Cy (FeedY 146) -Size (FeedW 56) -FillHex '#4C6DFF' -Active $true
  Draw-IconCircle -Graphics $Graphics -Cx (FeedX 46) -Cy (FeedY 250) -Size (FeedW 40) -FillHex '#0A1220'
  Draw-IconCircle -Graphics $Graphics -Cx (FeedX 46) -Cy (FeedY 315) -Size (FeedW 40) -FillHex '#0A1220'
  Draw-IconCircle -Graphics $Graphics -Cx (FeedX 46) -Cy (FeedY 383) -Size (FeedW 40) -FillHex '#0A1220'
  Draw-IconCircle -Graphics $Graphics -Cx (FeedX 46) -Cy (FeedY 458) -Size (FeedW 40) -FillHex '#0A1220'

  $badgeBrush = New-SolidBrush '#FF4D5A'
  Draw-RoundedRect -Graphics $Graphics -Brush $badgeBrush -Pen $null -X (FeedX 58) -Y (FeedY 298) -Width (FeedW 38) -Height (FeedH 24) -Radius (FeedH 12)
  Draw-Text -Graphics $Graphics -Text '29' -Font $fontSmall -Brush $text -X (FeedX 69) -Y (FeedY 302)

  Draw-Text -Graphics $Graphics -Text $feedPopular -Font $fontTitle -Brush $text -X (FeedX 690) -Y (FeedY 58)
  Draw-Text -Graphics $Graphics -Text $feedSubscriptions -Font $fontTitle -Brush $text -X (FeedX 1045) -Y (FeedY 58)
  $Graphics.DrawLine($line, [float](FeedX 530), [float](FeedY 106), [float](FeedX 1360), [float](FeedY 106))
  Draw-RoundedRect -Graphics $Graphics -Brush $panel2 -Pen $null -X (FeedX 1010) -Y (FeedY 32) -Width (FeedW 430) -Height (FeedH 52) -Radius (FeedH 18)
  $Graphics.DrawLine($tabLine, [float](FeedX 1012), [float](FeedY 104), [float](FeedX 1438), [float](FeedY 104))

  Draw-RoundedRect -Graphics $Graphics -Brush $panel -Pen $line -X (FeedX 530) -Y (FeedY 132) -Width (FeedW 950) -Height (FeedH 184) -Radius (FeedH 28)
  Draw-IconCircle -Graphics $Graphics -Cx (FeedX 578) -Cy (FeedY 182) -Size (FeedW 56) -FillHex '#4C6DFF'
  Draw-Text -Graphics $Graphics -Text 'ME' -Font $fontBold -Brush $text -X (FeedX 560) -Y (FeedY 170)
  Draw-RoundedRect -Graphics $Graphics -Brush $panel2 -Pen $line -X (FeedX 622) -Y (FeedY 150) -Width (FeedW 840) -Height (FeedH 104) -Radius (FeedH 22)
  Draw-Text -Graphics $Graphics -Text $feedWhatsNew -Font $fontTitle -Brush $muted -X (FeedX 640) -Y (FeedY 168)
  Draw-RoundedRect -Graphics $Graphics -Brush $panel2 -Pen $line -X (FeedX 628) -Y (FeedY 262) -Width (FeedW 42) -Height (FeedH 42) -Radius (FeedH 14)
  Draw-RoundedRect -Graphics $Graphics -Brush $panel2 -Pen $line -X (FeedX 682) -Y (FeedY 262) -Width (FeedW 42) -Height (FeedH 42) -Radius (FeedH 14)
  Draw-RoundedRect -Graphics $Graphics -Brush $panel2 -Pen $line -X (FeedX 736) -Y (FeedY 262) -Width (FeedW 42) -Height (FeedH 42) -Radius (FeedH 14)
  Draw-Text -Graphics $Graphics -Text $feedVisibility -Font $fontBold -Brush $textSoft -X (FeedX 1090) -Y (FeedY 272)
  Draw-RoundedRect -Graphics $Graphics -Brush $panel2 -Pen $line -X (FeedX 1218) -Y (FeedY 258) -Width (FeedW 118) -Height (FeedH 50) -Radius (FeedH 16)
  Draw-Text -Graphics $Graphics -Text $feedAll -Font $fontBold -Brush $text -X (FeedX 1255) -Y (FeedY 271)
  Draw-RoundedRect -Graphics $Graphics -Brush $accent -Pen $null -X (FeedX 1350) -Y (FeedY 258) -Width (FeedW 194) -Height (FeedH 50) -Radius (FeedH 16)
  Draw-Text -Graphics $Graphics -Text $feedPublish -Font $fontBold -Brush $text -X (FeedX 1405) -Y (FeedY 271)

  Draw-RoundedRect -Graphics $Graphics -Brush $panel -Pen $line -X (FeedX 520) -Y (FeedY 336) -Width (FeedW 974) -Height (FeedH 625) -Radius (FeedH 28)
  Draw-IconCircle -Graphics $Graphics -Cx (FeedX 566) -Cy (FeedY 388) -Size (FeedW 42) -FillHex '#4C6DFF'
  Draw-Text -Graphics $Graphics -Text 'S' -Font $fontBold -Brush $text -X (FeedX 554) -Y (FeedY 374)
  Draw-Text -Graphics $Graphics -Text $feedSasha -Font $fontTitle -Brush $text -X (FeedX 628) -Y (FeedY 366)
  Draw-Text -Graphics $Graphics -Text $feedDate -Font $fontBody -Brush $textSoft -X (FeedX 628) -Y (FeedY 405)
  Draw-Text -Graphics $Graphics -Text $feedPostText -Font $fontTitle -Brush $text -X (FeedX 540) -Y (FeedY 462)

  $postImageRect = [System.Drawing.RectangleF]::new((FeedX 540), (FeedY 520), (FeedW 892), (FeedH 400))
  if ($PostImagePath -and (Test-Path $PostImagePath)) {
    $postImage = [System.Drawing.Image]::FromFile($PostImagePath)
    $Graphics.DrawImage($postImage, $postImageRect)
    $postImage.Dispose()
  } else {
    $fallback = New-SolidBrush '#33415A'
    Draw-RoundedRect -Graphics $Graphics -Brush $fallback -Pen $null -X $postImageRect.X -Y $postImageRect.Y -Width $postImageRect.Width -Height $postImageRect.Height -Radius (FeedH 24)
    $fallback.Dispose()
  }

  $Graphics.DrawLine($line, [float](FeedX 540), [float](FeedY 948), [float](FeedX 1432), [float](FeedY 948))
  Draw-Text -Graphics $Graphics -Text 'like 1' -Font $fontBody -Brush $textSoft -X (FeedX 560) -Y (FeedY 966)
  Draw-Text -Graphics $Graphics -Text 'comment 1' -Font $fontBody -Brush $textSoft -X (FeedX 666) -Y (FeedY 966)
  Draw-Text -Graphics $Graphics -Text 'share' -Font $fontBody -Brush $textSoft -X (FeedX 840) -Y (FeedY 966)

  foreach ($obj in @($bg, $nav, $panel, $panel2, $accent, $text, $textSoft, $muted, $badgeBrush, $line, $tabLine, $fontTitle, $fontBody, $fontSmall, $fontBold)) {
    if ($null -ne $obj) { $obj.Dispose() }
  }
}

$root = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $root 'artifacts'
if (-not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$profilePath = (Get-ChildItem -Path 'C:\Users\larak\Downloads' -File | Where-Object { $_.Name -like '*20_09_48.png' } | Select-Object -First 1 -ExpandProperty FullName)
$feedPostImagePath = (Get-ChildItem -Path 'C:\Users\larak\Downloads' -File | Where-Object { $_.Name -like 'KpK*.jpg' } | Select-Object -First 1 -ExpandProperty FullName)

if (-not (Test-Path $profilePath)) { throw "Profile screenshot not found: $profilePath" }

$profileImg = [System.Drawing.Image]::FromFile($profilePath)

$canvasWidth = 4140
$canvasHeight = 1360
$bitmap = New-Object System.Drawing.Bitmap($canvasWidth, $canvasHeight)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

$graphics.Clear((Get-Color '#F6F8FC'))

$titleFont = New-Object System.Drawing.Font('Segoe UI', 28, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$captionFont = New-Object System.Drawing.Font('Times New Roman', 28, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$labelFont = New-Object System.Drawing.Font('Segoe UI', 22, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$titleBrush = New-SolidBrush '#354255'
$captionBrush = New-SolidBrush '#2E3340'
$framePen = New-Pen '#D6DFED' 2

$margin = 70
$gap = 60
$screenTop = 150
$screenHeight = 780
$feedWidth = [int]($screenHeight * 1.5)
$messageWidth = 1412
$profileWidth = [int]($screenHeight * ($profileImg.Width / [double]$profileImg.Height))

$feedRect = [System.Drawing.RectangleF]::new($margin, $screenTop, $feedWidth, $screenHeight)
$messageRect = [System.Drawing.RectangleF]::new($feedRect.Right + $gap, $screenTop, $messageWidth, $screenHeight)
$profileRect = [System.Drawing.RectangleF]::new($messageRect.Right + $gap, $screenTop, $profileWidth, $screenHeight)

$screenBg = New-SolidBrush '#FFFFFF'
$titleFeed = Decode-Base64Utf8 '0JvQtdC90YLQsCDQv9GD0LHQu9C40LrQsNGG0LjQuQ=='
$titleMessages = Decode-Base64Utf8 '0KHRgtGA0LDQvdC40YbQsCDRgdC+0L7QsdGJ0LXQvdC40Lk='
$titleProfile = Decode-Base64Utf8 '0KHRgtGA0LDQvdC40YbQsCDQv9GA0L7RhNC40LvRjw=='
$labelDialog = Decode-Base64Utf8 '0L/QtdGA0LXRhdC+0LQg0Log0LTQuNCw0LvQvtCz0YM='
$labelOpenProfile = Decode-Base64Utf8 '0L7RgtC60YDRi9GC0LjQtSDQv9GA0L7RhNC40LvRjyDQv9C+0LvRjNC30L7QstCw0YLQtdC70Y8='
$labelBackToFeed = Decode-Base64Utf8 '0LLQvtC30LLRgNCw0YIg0Log0LvQtdC90YLQtQ=='
$figureCaption = Decode-Base64Utf8 '0KDQuNGBLiAzLlgg4oCTINCU0LjQvdCw0LzQuNGH0LXRgdC60LjQuSDQv9GA0L7RgtC+0YLQuNC/INC40L3RgtC10YDRhNC10LnRgdCw'
foreach ($rect in @($feedRect, $messageRect, $profileRect)) {
  Draw-RoundedRect -Graphics $graphics -Brush $screenBg -Pen $framePen -X ($rect.X - 6) -Y ($rect.Y - 6) -Width ($rect.Width + 12) -Height ($rect.Height + 12) -Radius 12
}

Draw-FeedScreen -Graphics $graphics -Rect $feedRect -PostImagePath $feedPostImagePath
Draw-MessagesScreen -Graphics $graphics -Rect $messageRect
$graphics.DrawImage($profileImg, $profileRect)

$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$graphics.DrawString($titleFeed, $titleFont, $titleBrush, [System.Drawing.PointF]::new($feedRect.X + ($feedRect.Width / 2), 86), $sf)
$graphics.DrawString($titleMessages, $titleFont, $titleBrush, [System.Drawing.PointF]::new($messageRect.X + ($messageRect.Width / 2), 86), $sf)
$graphics.DrawString($titleProfile, $titleFont, $titleBrush, [System.Drawing.PointF]::new($profileRect.X + ($profileRect.Width / 2), 86), $sf)

$feedX = [float](@($feedRect.X)[0])
$feedY = [float](@($feedRect.Y)[0])
$feedW = [float](@($feedRect.Width)[0])
$feedH = [float](@($feedRect.Height)[0])
$feedRight = [float](@($feedRect.Right)[0])
$feedBottom = [float](@($feedRect.Bottom)[0])
$messageX = [float](@($messageRect.X)[0])
$messageY = [float](@($messageRect.Y)[0])
$messageW = [float](@($messageRect.Width)[0])
$messageH = [float](@($messageRect.Height)[0])
$messageRight = [float](@($messageRect.Right)[0])
$profileX = [float](@($profileRect.X)[0])
$profileY = [float](@($profileRect.Y)[0])
$profileW = [float](@($profileRect.Width)[0])
$profileH = [float](@($profileRect.Height)[0])
$profileBottom = [float](@($profileRect.Bottom)[0])

$feedMessageStartX = $feedX + ($feedW * 0.038)
$feedMessageStartY = $feedY + ($feedH * 0.383)
$msgChatTargetX = $messageX + ($messageW * 0.193)
$msgChatTargetY = $messageY + ($messageH * 0.205)
$pointsFeedToMessages = @(
  $feedMessageStartX, $feedMessageStartY,
  ($feedRight + 60), ($feedY + 80),
  ($messageX - 120), ($messageY + 150),
  $msgChatTargetX, $msgChatTargetY
)
Draw-PrototypeArrow -Graphics $graphics -Points $pointsFeedToMessages -Label $labelDialog -LabelX ($feedRight + (($messageX - $feedRight) / 2) + 60) -LabelY ($screenTop + 100) -LabelFont $labelFont

$msgProfileStartX = $messageX + ($messageW * 0.385)
$msgProfileStartY = $messageY + ($messageH * 0.058)
$profileTargetX = $profileX + ($profileW * 0.31)
$profileTargetY = $profileY + ($profileH * 0.175)
$pointsMessagesToProfile = @(
  $msgProfileStartX, $msgProfileStartY,
  ($messageX + $messageW * 0.62), ($messageY - 110),
  ($profileX - 40), ($profileY - 80),
  $profileTargetX, $profileTargetY
)
Draw-PrototypeArrow -Graphics $graphics -Points $pointsMessagesToProfile -Label $labelOpenProfile -LabelX ($messageRight + (($profileX - $messageRight) / 2)) -LabelY 40 -LabelFont $labelFont

$profileHomeStartX = $profileX + ($profileW * 0.04)
$profileHomeStartY = $profileY + ($profileH * 0.095)
$feedReturnTargetX = $feedX + ($feedW * 0.54)
$feedReturnTargetY = $feedY + ($feedH * 0.36)
$pointsProfileToFeed = @(
  $profileHomeStartX, $profileHomeStartY,
  ($profileX + $profileW * 0.06), ($profileBottom + 220),
  ($feedX + $feedW * 0.72), ($feedBottom + 200),
  $feedReturnTargetX, $feedReturnTargetY
)
Draw-PrototypeArrow -Graphics $graphics -Points $pointsProfileToFeed -Label $labelBackToFeed -LabelX (($feedRight + $profileX) / 2) -LabelY ($screenTop + $screenHeight + 150) -LabelFont $labelFont

$graphics.DrawString($figureCaption, $captionFont, $captionBrush, [System.Drawing.PointF]::new($canvasWidth / 2, 1265), $sf)

$outputPath = Join-Path $outputDir 'dynamic-prototype-interface.png'
$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$sf.Dispose()
$screenBg.Dispose()
$framePen.Dispose()
$titleBrush.Dispose()
$captionBrush.Dispose()
$titleFont.Dispose()
$captionFont.Dispose()
$labelFont.Dispose()
$profileImg.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

Write-Output $outputPath
