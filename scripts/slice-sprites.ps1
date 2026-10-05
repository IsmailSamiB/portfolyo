# Düz renk zeminli sprite sayfasını oyunun beklediği ızgaraya çevirir.
#  - düz renkli (magenta) zemini KAYNAK çözünürlükte şeffaflaştırır, kenarı 1 piksel aşındırır,
#    kenardaki renk taşmasını giderir (karakterin etrafında mor çizgi kalmasın)
#  - kareleri boşluklardan kendisi bulur (eşit ızgaraya oturmayan sayfalar için), bulamazsa eşit böler
#  - her kareyi hücresine alt-orta hizalı, 2 piksel kenar boşluğuyla, önceden çarpılmış alfayla küçültür
#
#   karakter: -Cols 4 -Rows 4 -CellW 64 -CellH 96
#   Fırfır:   -Cols 6 -Rows 1 -CellW 64 -CellH 48 -Out public\assets\sprites\firfir.png
param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Out,
  [int]$Cols = 4,
  [int]$Rows = 4,
  [int]$CellW = 64,
  [int]$CellH = 96,
  [int]$Tolerance = 110
)

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class SpriteSlicer
{
    static List<int[]> Bands(bool[] filled, int expected, int length)
    {
        var bands = new List<int[]>();
        int start = -1;
        for (int i = 0; i <= filled.Length; i++)
        {
            bool on = i < filled.Length && filled[i];
            if (on && start < 0) start = i;
            if (!on && start >= 0) { if (i - start >= 6) bands.Add(new[] { start, i }); start = -1; }
        }
        if (bands.Count == expected) return bands;
        // Boşluklardan ayrılamadı: eşit böl
        bands.Clear();
        for (int k = 0; k < expected; k++) bands.Add(new[] { k * length / expected, (k + 1) * length / expected });
        return bands;
    }

    public static string Run(string source, string output, int cols, int rows, int cellW, int cellH, int tol)
    {
        Bitmap src;
        using (var loaded = new Bitmap(source))
            src = loaded.Clone(new Rectangle(0, 0, loaded.Width, loaded.Height), PixelFormat.Format32bppArgb);
        int w = src.Width, h = src.Height;
        var data = src.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        var px = new byte[data.Stride * h];
        Marshal.Copy(data.Scan0, px, 0, px.Length);
        int stride = data.Stride;
        int kb = px[2 * stride + 8], kg = px[2 * stride + 9], kr = px[2 * stride + 10];

        // 1) zemin: anahtar renge yakın ya da belirgin magenta
        var bg = new bool[w * h];
        for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++)
            {
                int i = y * stride + x * 4;
                int b = px[i], g = px[i + 1], r = px[i + 2];
                int dist = Math.Abs(r - kr) + Math.Abs(g - kg) + Math.Abs(b - kb);
                int spill = Math.Min(r, b) - g;
                bg[y * w + x] = dist < tol || (spill > 110 && r > 150 && b > 150);
            }

        // 2) kenarı 1 piksel aşındır
        var cut = (bool[])bg.Clone();
        for (int y = 1; y < h - 1; y++)
            for (int x = 1; x < w - 1; x++)
            {
                int p = y * w + x;
                if (!bg[p] && (bg[p - 1] || bg[p + 1] || bg[p - w] || bg[p + w])) cut[p] = true;
            }

        // 3) kenara yakın piksellerde kalan magenta taşmasını gider; şeffafları sıfırla
        for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++)
            {
                int p = y * w + x, i = y * stride + x * 4;
                if (cut[p]) { px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0; continue; }
                bool nearEdge = false;
                for (int dy = -2; dy <= 2 && !nearEdge; dy++)
                    for (int dx = -2; dx <= 2; dx++)
                    {
                        int nx = x + dx, ny = y + dy;
                        if (nx < 0 || ny < 0 || nx >= w || ny >= h || cut[ny * w + nx]) { nearEdge = true; break; }
                    }
                if (!nearEdge) continue;
                int b = px[i], g = px[i + 1], r = px[i + 2];
                int spill = Math.Min(r, b) - g;
                if (spill > 12) { px[i] = (byte)(b - spill * 0.8); px[i + 2] = (byte)(r - spill * 0.8); }
            }
        Marshal.Copy(px, 0, data.Scan0, px.Length);
        src.UnlockBits(data);

        // 4) kareleri bul
        var rowFilled = new bool[h];
        for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) if (!cut[y * w + x]) { rowFilled[y] = true; break; }
        var rowBands = Bands(rowFilled, rows, h);
        var boxes = new List<Rectangle>();
        int maxW = 1, maxH = 1;
        foreach (var rb in rowBands)
        {
            var colFilled = new bool[w];
            for (int x = 0; x < w; x++) for (int y = rb[0]; y < rb[1]; y++) if (!cut[y * w + x]) { colFilled[x] = true; break; }
            foreach (var cb in Bands(colFilled, cols, w))
            {
                int x0 = int.MaxValue, y0 = int.MaxValue, x1 = -1, y1 = -1;
                for (int y = rb[0]; y < rb[1]; y++)
                    for (int x = cb[0]; x < cb[1]; x++)
                        if (!cut[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
                var box = x1 < 0 ? Rectangle.Empty : Rectangle.FromLTRB(x0, y0, x1 + 1, y1 + 1);
                boxes.Add(box);
                if (box.Width > maxW) maxW = box.Width;
                if (box.Height > maxH) maxH = box.Height;
            }
        }

        // 5) ortak ölçekle hücrelere yerleştir (önceden çarpılmış alfa: kenarda renk sızmaz)
        double scale = Math.Min((cellW - 4.0) / maxW, (cellH - 4.0) / maxH);
        using (var sheet = new Bitmap(cols * cellW, rows * cellH, PixelFormat.Format32bppPArgb))
        {
            using (var g = Graphics.FromImage(sheet))
            {
                g.Clear(Color.Transparent);
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.CompositingQuality = CompositingQuality.HighQuality;
                for (int k = 0; k < boxes.Count; k++)
                {
                    var box = boxes[k];
                    if (box.IsEmpty) continue;
                    int c = k % cols, r = k / cols;
                    using (var cell = src.Clone(box, PixelFormat.Format32bppPArgb))
                    using (var attrs = new ImageAttributes())
                    {
                        attrs.SetWrapMode(WrapMode.TileFlipXY);
                        int dw = Math.Max(1, (int)Math.Round(box.Width * scale));
                        int dh = Math.Max(1, (int)Math.Round(box.Height * scale));
                        var dest = new Rectangle(c * cellW + (cellW - dw) / 2, (r + 1) * cellH - dh - 2, dw, dh);
                        g.SetClip(new Rectangle(c * cellW + 1, r * cellH + 1, cellW - 2, cellH - 2));
                        g.DrawImage(cell, dest, 0, 0, cell.Width, cell.Height, GraphicsUnit.Pixel, attrs);
                    }
                }
            }
            sheet.Save(output, ImageFormat.Png);
        }
        src.Dispose();
        return boxes.Count + " kare, olcek " + scale.ToString("0.000");
    }
}
'@

$outPath = Join-Path (Get-Location) $Out
New-Item -ItemType Directory -Force (Split-Path $outPath) | Out-Null
$result = [SpriteSlicer]::Run((Resolve-Path $Source).Path, $outPath, $Cols, $Rows, $CellW, $CellH, $Tolerance)
"Yazıldı: $Out ($result)"
