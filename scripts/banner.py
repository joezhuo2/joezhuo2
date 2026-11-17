import math
import random
from PIL import Image, ImageDraw, ImageFont

W, H, S = 1000, 270, 2
FPS = 24
EMOJI = "\U0001F44B"
PREFIX, NAME1, NAME2 = EMOJI + " Hi there! I'm ", "CrystalFlux", "Joe Zhuo"
TYPE_F, DEL_F = 3, 2
N_NODES, LINK_DIST = 40, 175

TEXT_FONT = ImageFont.truetype("C:/Windows/Fonts/consolab.ttf", 54 * S)
EMOJI_FONT = ImageFont.truetype("C:/Windows/Fonts/seguiemj.ttf", 50 * S)


def timeline():
    frames = []

    def hold(text, seconds):
        frames.extend((text, (i // 12) % 2 == 0) for i in range(int(seconds * FPS)))

    def type_(start, add):
        for i in range(1, len(add) + 1):
            frames.extend([(start + add[:i], True)] * TYPE_F)

    def delete(text, keep):
        for n in range(len(text) - 1, keep - 1, -1):
            frames.extend([(text[:n], True)] * DEL_F)

    hold("", 0.5)
    type_("", PREFIX + NAME1)
    hold(PREFIX + NAME1, 1.5)
    delete(PREFIX + NAME1, len(PREFIX))
    hold(PREFIX, 0.3)
    type_(PREFIX, NAME2)
    hold(PREFIX + NAME2, 2.0)
    delete(PREFIX + NAME2, 0)
    return frames


def make_nodes():
    rng = random.Random(7)
    nodes = []
    for _ in range(N_NODES):
        nodes.append(dict(
            bx=rng.uniform(0, W), by=rng.uniform(0, H),
            ax=rng.uniform(25, 80), ay=rng.uniform(15, 50),
            kx=rng.choice((1, 2)), ky=rng.choice((1, 2)),
            px=rng.uniform(0, 2 * math.pi), py=rng.uniform(0, 2 * math.pi),
            r=rng.uniform(2.5, 6),
        ))
    return nodes


def node_positions(nodes, t):
    # integer frequencies over the full loop make the motion seamless
    a = 2 * math.pi * t
    return [(n["bx"] + n["ax"] * math.sin(n["kx"] * a + n["px"]),
             n["by"] + n["ay"] * math.sin(n["ky"] * a + n["py"])) for n in nodes]


def gray(alpha, ink=105):
    v = round(255 - alpha * (255 - ink))
    return (v, v, v)


def render(nodes, t, text, cursor):
    img = Image.new("RGB", (W * S, H * S), "white")
    d = ImageDraw.Draw(img)
    pts = node_positions(nodes, t)

    links = []
    for i in range(len(pts)):
        for j in range(i + 1, len(pts)):
            dist = math.dist(pts[i], pts[j])
            if dist < LINK_DIST:
                links.append((1 - dist / LINK_DIST, pts[i], pts[j]))
    for a, p, q in sorted(links):
        d.line([(p[0] * S, p[1] * S), (q[0] * S, q[1] * S)], fill=gray(a * 0.45), width=3 * S // 2)

    for (x, y), n in zip(pts, nodes):
        r = n["r"] * S
        d.ellipse([x * S - r, y * S - r, x * S + r, y * S + r], fill=gray(0.75))

    x0, base = 60 * S, (H // 2 + 18) * S
    tx = x0 + 80 * S
    if text:
        d.text((x0, base), EMOJI, font=EMOJI_FONT, embedded_color=True, anchor="ls")
        d.text((tx, base), text[2:], font=TEXT_FONT, fill=(20, 20, 20), anchor="ls")
    if cursor:
        if not text:
            cx = x0
        elif len(text) == 1:
            cx = x0 + d.textlength(EMOJI, font=EMOJI_FONT, embedded_color=True) + 3 * S
        else:
            cx = tx + d.textlength(text[2:], font=TEXT_FONT) + 3 * S
        d.rectangle([cx, base - 44 * S, cx + 4 * S, base + 8 * S], fill=(20, 20, 20))
        assert cx + 4 * S < (W - 30) * S, "text overflows the banner"

    return img.resize((W, H), Image.LANCZOS)


def main():
    frames = timeline()
    nodes = make_nodes()
    total = len(frames)

    palette_ref = render(nodes, 0, PREFIX + NAME1, True).quantize(colors=96, method=Image.Quantize.MEDIANCUT)
    pal = palette_ref.getpalette()[:96 * 3]
    # Pillow's palette lookup is coarse, so snap every near-white entry to pure white
    pal = [255 if min(pal[k - k % 3:k - k % 3 + 3]) >= 245 else v for k, v in enumerate(pal)]
    palette_ref.putpalette(pal)
    out = [render(nodes, i / total, txt, cur).quantize(palette=palette_ref, dither=Image.Dither.NONE)
           for i, (txt, cur) in enumerate(frames)]

    durations = [50 if i % 6 == 5 else 40 for i in range(total)]  # averages 41.67ms = 24fps
    assert abs(sum(durations[:6]) / 6 - 1000 / FPS) < 0.01
    out[0].save("banner.gif", save_all=True, append_images=out[1:], duration=durations, loop=0, optimize=True, disposal=1)
    print(f"{total} frames, {total / FPS:.1f}s")


if __name__ == "__main__":
    main()
