# Markdown to HTML converter for HRM docs
# Run: powershell -ExecutionPolicy Bypass -File convert-to-html.ps1

$CSS = @'
*, *::before, *::after { box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 15px; line-height: 1.7; color: #24292f;
  margin: 0; background: #f6f8fa; display: flex;
}
#sidebar {
  width: 260px; min-height: 100vh; background: #fff;
  border-right: 1px solid #d0d7de; padding: 20px 0;
  position: sticky; top: 0; height: 100vh; overflow-y: auto;
  flex-shrink: 0;
}
#sidebar h2 { font-size: 12px; font-weight: 600; color: #57606a;
  text-transform: uppercase; letter-spacing: .06em;
  padding: 8px 20px 4px; margin: 16px 0 4px; }
#sidebar ul { list-style: none; margin: 0; padding: 0; }
#sidebar li a {
  display: block; padding: 5px 20px 5px 28px;
  color: #0969da; text-decoration: none; font-size: 13px;
  border-left: 3px solid transparent; line-height: 1.4;
}
#sidebar li a:hover { background: #f6f8fa; border-left-color: #0969da; }
#sidebar li.h1 a { padding-left: 20px; font-weight: 600; font-size: 13px; }
#sidebar li.h2 a { padding-left: 28px; }
#sidebar li.h3 a { padding-left: 40px; font-size: 12px; color: #57606a; }
#content {
  flex: 1; max-width: 900px; padding: 40px 48px;
  background: #fff; min-height: 100vh;
}
h1 { font-size: 2em; border-bottom: 1px solid #d0d7de; padding-bottom: .3em; margin-top: 1.5em; }
h2 { font-size: 1.5em; border-bottom: 1px solid #d0d7de; padding-bottom: .3em; margin-top: 1.8em; }
h3 { font-size: 1.2em; margin-top: 1.5em; }
h4 { font-size: 1em; margin-top: 1.2em; }
h1:first-child, h2:first-child { margin-top: 0; }
a { color: #0969da; text-decoration: none; }
a:hover { text-decoration: underline; }
p { margin: 0 0 16px; }
pre {
  background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px;
  padding: 16px; overflow-x: auto; font-size: 13px; line-height: 1.5;
  margin: 0 0 16px;
}
code {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 85%;
}
pre code { font-size: inherit; background: none; padding: 0; border: none; }
:not(pre) > code {
  background: rgba(175,184,193,.2); padding: .2em .4em;
  border-radius: 6px; font-size: 85%;
}
blockquote {
  margin: 0 0 16px; padding: 0 1em;
  color: #57606a; border-left: .25em solid #d0d7de;
}
blockquote p { margin-bottom: 0; }
table { border-collapse: collapse; width: 100%; margin: 0 0 16px; font-size: 14px; }
thead { background: #f6f8fa; }
th, td { border: 1px solid #d0d7de; padding: 8px 12px; text-align: left; }
th { font-weight: 600; }
tr:nth-child(even) { background: #f6f8fa; }
ul, ol { padding-left: 2em; margin: 0 0 16px; }
li { margin: 4px 0; }
hr { border: none; border-top: 1px solid #d0d7de; margin: 24px 0; }
.badge {
  display: inline-block; padding: 2px 8px; border-radius: 12px;
  font-size: 12px; font-weight: 600; margin-right: 4px;
}
.lock { background: #fff8c5; color: #9a6700; }
.method-get { color: #1a7f37; font-weight: 700; }
.method-post { color: #0969da; font-weight: 700; }
.method-patch { color: #9a6700; font-weight: 700; }
.method-delete { color: #cf222e; font-weight: 700; }

/* Syntax highlight classes */
.kw { color: #cf222e; }
.st { color: #0a3069; }
.cm { color: #6e7781; font-style: italic; }
.nm { color: #953800; }
.kv { color: #0550ae; }

/* Scroll margin for anchor links */
h1, h2, h3, h4 { scroll-margin-top: 20px; }
'@

function ConvertInline($text) {
    # Escape HTML first in non-code spans
    # Bold+italic
    $text = $text -replace '\*\*\*(.+?)\*\*\*', '<strong><em>$1</em></strong>'
    # Bold
    $text = $text -replace '\*\*(.+?)\*\*', '<strong>$1</strong>'
    # Italic
    $text = $text -replace '(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', '<em>$1</em>'
    # Inline code (protect from further replacements)
    $text = $text -replace '`([^`]+)`', '<code>$1</code>'
    # Links
    $text = $text -replace '\[([^\]]+)\]\(([^)]+)\)', '<a href="$2">$1</a>'
    # ~~strikethrough~~
    $text = $text -replace '~~(.+?)~~', '<del>$1</del>'
    return $text
}

function MakeId($text) {
    $id = $text.ToLower()
    $id = $id -replace '[^\w\s\-àáâãäåæçèéêëìíîïðñòóôõöùúûüýÿ]', ''
    $id = $id -replace '\s+', '-'
    $id = $id -replace '-+', '-'
    $id = $id.Trim('-')
    return $id
}

function ConvertMarkdown($mdContent, $docTitle) {
    $lines = $mdContent -split "`r?`n"
    $html = [System.Text.StringBuilder]::new()
    $tocEntries = [System.Collections.Generic.List[hashtable]]::new()

    $inCode   = $false
    $codeLang = ''
    $inTable  = $false
    $tableHead= $true
    $inBq     = $false
    $inUl     = $false
    $inOl     = $false
    $codeLines= [System.Text.StringBuilder]::new()

    foreach ($rawLine in $lines) {
        $line = $rawLine

        # ── CODE BLOCK ───────────────────────────────────────────
        if ($line -match '^```(.*)$') {
            if ($inCode) {
                $escaped = $codeLines.ToString() -replace '&', '&amp;' -replace '<', '&lt;' -replace '>', '&gt;'
                $null = $html.AppendLine("<pre><code class=`"language-$codeLang`">$escaped</code></pre>")
                $codeLines.Clear() | Out-Null
                $inCode = $false; $codeLang = ''
            } else {
                # close any open blocks
                if ($inUl)    { $null = $html.AppendLine('</ul>'); $inUl = $false }
                if ($inOl)    { $null = $html.AppendLine('</ol>'); $inOl = $false }
                if ($inTable) { $null = $html.AppendLine('</tbody></table>'); $inTable = $false }
                if ($inBq)    { $null = $html.AppendLine('</blockquote>'); $inBq = $false }
                $inCode = $true
                $codeLang = $matches[1].Trim()
            }
            continue
        }
        if ($inCode) { $null = $codeLines.AppendLine($line); continue }

        # ── CLOSE TABLE IF LINE NOT A TABLE ROW ──────────────────
        if ($inTable -and $line -notmatch '^\|') {
            $null = $html.AppendLine('</tbody></table>')
            $inTable = $false
        }
        # ── CLOSE LISTS ──────────────────────────────────────────
        if ($inUl -and $line -notmatch '^[ \t]*[-*+] ') {
            $null = $html.AppendLine('</ul>'); $inUl = $false
        }
        if ($inOl -and $line -notmatch '^[ \t]*\d+\. ') {
            $null = $html.AppendLine('</ol>'); $inOl = $false
        }
        # ── CLOSE BLOCKQUOTE ─────────────────────────────────────
        if ($inBq -and $line -notmatch '^>') {
            $null = $html.AppendLine('</blockquote>'); $inBq = $false
        }

        # ── HEADINGS ─────────────────────────────────────────────
        if ($line -match '^(#{1,4}) (.+)$') {
            $level = $matches[1].Length
            $text  = $matches[2].Trim()
            $id    = MakeId $text
            $tocEntries.Add(@{ level=$level; text=$text; id=$id })
            $inner = ConvertInline $text
            $null = $html.AppendLine("<h$level id=`"$id`">$inner</h$level>")
            continue
        }

        # ── HORIZONTAL RULE ──────────────────────────────────────
        if ($line -match '^---+$') {
            $null = $html.AppendLine('<hr>')
            continue
        }

        # ── BLOCKQUOTE ───────────────────────────────────────────
        if ($line -match '^> ?(.*)$') {
            if (-not $inBq) { $null = $html.AppendLine('<blockquote>'); $inBq = $true }
            $inner = ConvertInline $matches[1]
            $null = $html.AppendLine("<p>$inner</p>")
            continue
        }

        # ── TABLE ────────────────────────────────────────────────
        if ($line -match '^\|') {
            if ($line -match '^\|[\s\-\|:]+\|$') {
                # separator row → switch to tbody
                $null = $html.AppendLine('</thead><tbody>')
                $tableHead = $false
                continue
            }
            if (-not $inTable) {
                $null = $html.AppendLine('<table><thead>')
                $inTable = $true; $tableHead = $true
            }
            $cells = $line -split '\|' | Where-Object { $_ -ne '' }
            $tag = if ($tableHead) { 'th' } else { 'td' }
            $null = $html.Append('<tr>')
            foreach ($c in $cells) {
                $inner = ConvertInline $c.Trim()
                $null = $html.Append("<$tag>$inner</$tag>")
            }
            $null = $html.AppendLine('</tr>')
            continue
        }

        # ── UNORDERED LIST ───────────────────────────────────────
        if ($line -match '^[ \t]*[-*+] (.+)$') {
            if (-not $inUl) { $null = $html.AppendLine('<ul>'); $inUl = $true }
            $inner = ConvertInline $matches[1]
            $null = $html.AppendLine("<li>$inner</li>")
            continue
        }

        # ── ORDERED LIST ─────────────────────────────────────────
        if ($line -match '^[ \t]*\d+\. (.+)$') {
            if (-not $inOl) { $null = $html.AppendLine('<ol>'); $inOl = $true }
            $inner = ConvertInline $matches[1]
            $null = $html.AppendLine("<li>$inner</li>")
            continue
        }

        # ── BLANK LINE ───────────────────────────────────────────
        if ($line.Trim() -eq '') { continue }

        # ── PARAGRAPH ────────────────────────────────────────────
        $inner = ConvertInline $line
        $null = $html.AppendLine("<p>$inner</p>")
    }

    # Close any open blocks
    if ($inCode)  { $null = $html.AppendLine("</code></pre>") }
    if ($inTable) { $null = $html.AppendLine('</tbody></table>') }
    if ($inUl)    { $null = $html.AppendLine('</ul>') }
    if ($inOl)    { $null = $html.AppendLine('</ol>') }
    if ($inBq)    { $null = $html.AppendLine('</blockquote>') }

    # ── BUILD SIDEBAR TOC ─────────────────────────────────────────
    $toc = [System.Text.StringBuilder]::new()
    $null = $toc.AppendLine('<nav id="sidebar">')
    $null = $toc.AppendLine("<h2>$docTitle</h2><ul>")
    foreach ($entry in $tocEntries) {
        $lvlClass = "h$($entry.level)"
        $null = $toc.AppendLine("<li class=`"$lvlClass`"><a href=`"#$($entry.id)`">$($entry.text)</a></li>")
    }
    $null = $toc.AppendLine('</ul></nav>')

    return @{ toc = $toc.ToString(); body = $html.ToString() }
}

function WriteHtml($srcFile, $outFile, $title) {
    Write-Host "Converting: $srcFile" -ForegroundColor Cyan
    $md = Get-Content -Path $srcFile -Raw -Encoding UTF8
    $result = ConvertMarkdown $md $title

    $fullHtml = @"
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>$title - HRM Docs</title>
<style>
$CSS
</style>
</head>
<body>
$($result.toc)
<main id="content">
$($result.body)
</main>
<script>
// Highlight active TOC link on scroll
const headings = document.querySelectorAll('h1,h2,h3,h4');
const links = document.querySelectorAll('#sidebar a');
const obs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      links.forEach(l => l.classList.remove('active'));
      const a = document.querySelector('#sidebar a[href="#'+e.target.id+'"]');
      if (a) a.classList.add('active');
    }
  });
}, { rootMargin: '0px 0px -80% 0px' });
headings.forEach(h => { if(h.id) obs.observe(h); });
</script>
<style>#sidebar a.active { background:#ddf4ff; border-left-color:#0969da; font-weight:600; }</style>
</body>
</html>
"@

    [System.IO.File]::WriteAllText($outFile, $fullHtml, [System.Text.Encoding]::UTF8)
    Write-Host "  -> $outFile" -ForegroundColor Green
}

$backendDocs = $PSScriptRoot
$frontendDocs = Join-Path (Split-Path (Split-Path $PSScriptRoot)) "frontend\docs"

Write-Host "`n=== Backend Docs ===" -ForegroundColor Magenta
WriteHtml "$backendDocs\api-spec.md"        "$backendDocs\api-spec.html"        "API Specification"
WriteHtml "$backendDocs\database-schema.md" "$backendDocs\database-schema.html" "Database Schema"
WriteHtml "$backendDocs\business-rules.md"  "$backendDocs\business-rules.html"  "Business Rules VN"
WriteHtml "$backendDocs\architecture.md"    "$backendDocs\architecture.html"    "Architecture"

Write-Host "`n=== Frontend Docs ===" -ForegroundColor Magenta
WriteHtml "$frontendDocs\architecture.md"    "$frontendDocs\architecture.html"    "FE Architecture"
WriteHtml "$frontendDocs\ui-conventions.md"  "$frontendDocs\ui-conventions.html"  "UI Conventions"
WriteHtml "$frontendDocs\component-guide.md" "$frontendDocs\component-guide.html" "Component Guide"

Write-Host "`nDone! 7 HTML files created." -ForegroundColor Yellow
