# アイコン画像を作る（外部の部品なし）。 使い方: python3 tests/make_icon.py
import zlib, struct, math
def png(path, n):
    cx = cy = n / 2
    pts = []
    for i in range(10):
        r = n * (0.36 if i % 2 == 0 else 0.15)
        a = -math.pi / 2 + i * math.pi / 5
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    def inside(x, y):
        c = False
        j = len(pts) - 1
        for i in range(len(pts)):
            xi, yi = pts[i]; xj, yj = pts[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: c = not c
            j = i
        return c
    rows = []
    for y in range(n):
        row = bytearray([0])
        for x in range(n):
            t = (x + y) / (2 * n)
            r, g, b = int(255 - 60 * t), int(140 + 60 * t), int(190 + 50 * (1 - t))
            if inside(x + .5, y + .5): r, g, b = 255, 250, 205
            row += bytes([r, g, b])
        rows.append(bytes(row))
    raw = zlib.compress(b''.join(rows), 9)
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', n, n, 8, 2, 0, 0, 0)) + chunk(b'IDAT', raw) + chunk(b'IEND', b''))
png('icons/icon-180.png', 180); png('icons/icon-512.png', 512)
