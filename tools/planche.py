# Une planche : des captures en grille, chacune réduite et titrée. python3 tools/planche.py sortie.jpg largeur colonnes img...
import sys, os
from PIL import Image, ImageDraw
out, larg, cols, imgs = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4:]
ims = [Image.open(p).convert('RGB') for p in imgs]
h = max(int(i.height * larg / i.width) for i in ims)
rows = (len(ims) + cols - 1) // cols
P = Image.new('RGB', (cols * larg, rows * (h + 18)), (16, 18, 22))
d = ImageDraw.Draw(P)
for k, (im, p) in enumerate(zip(ims, imgs)):
    r = im.resize((larg, int(im.height * larg / im.width)))
    x, y = (k % cols) * larg, (k // cols) * (h + 18)
    P.paste(r, (x, y + 18)); d.text((x + 4, y + 3), os.path.basename(p)[:-4], fill=(230, 230, 200))
P.save(out, quality=85)
