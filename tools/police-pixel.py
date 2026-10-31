# La police pixel d'Heirline, « Pochoir » : des lettres de 5 × 7 pixels (minuscules sur 5, jambages sur 2),
# dessinées ici en texte, puis assemblées en vraie police (TTF + WOFF2) avec fontTools.
# Chaque pixel est un carré de 100 unités ; un em vaut 8 pixels : à 16 px, un pixel de la police = 2 px d'écran.
# Lancer : python3 tools/police-pixel.py  →  client/public/pochoir.woff2
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
import os

PX = 100
EM = 8 * PX
CAP = 7  # hauteur des capitales (pixels)

# rangée 0 = haut des capitales ; le pied est sous la rangée 6 ; les rangées 7 et 8 sont les jambages
G = {
'A': [' ### ', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
'B': ['#### ', '#   #', '#   #', '#### ', '#   #', '#   #', '#### '],
'C': [' ### ', '#   #', '#    ', '#    ', '#    ', '#   #', ' ### '],
'D': ['#### ', '#   #', '#   #', '#   #', '#   #', '#   #', '#### '],
'E': ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#####'],
'F': ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#    '],
'G': [' ### ', '#   #', '#    ', '# ###', '#   #', '#   #', ' ####'],
'H': ['#   #', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
'I': ['###', ' # ', ' # ', ' # ', ' # ', ' # ', '###'],
'J': ['  ###', '   # ', '   # ', '   # ', '#  # ', '#  # ', ' ##  '],
'K': ['#   #', '#  # ', '# #  ', '##   ', '# #  ', '#  # ', '#   #'],
'L': ['#    ', '#    ', '#    ', '#    ', '#    ', '#    ', '#####'],
'M': ['#   #', '## ##', '# # #', '# # #', '#   #', '#   #', '#   #'],
'N': ['#   #', '##  #', '# # #', '#  ##', '#   #', '#   #', '#   #'],
'O': [' ### ', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
'P': ['#### ', '#   #', '#   #', '#### ', '#    ', '#    ', '#    '],
'Q': [' ### ', '#   #', '#   #', '#   #', '# # #', '#  # ', ' ## #'],
'R': ['#### ', '#   #', '#   #', '#### ', '# #  ', '#  # ', '#   #'],
'S': [' ####', '#    ', '#    ', ' ### ', '    #', '    #', '#### '],
'T': ['#####', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '  #  '],
'U': ['#   #', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
'V': ['#   #', '#   #', '#   #', '#   #', '#   #', ' # # ', '  #  '],
'W': ['#   #', '#   #', '#   #', '# # #', '# # #', '# # #', ' # # '],
'X': ['#   #', '#   #', ' # # ', '  #  ', ' # # ', '#   #', '#   #'],
'Y': ['#   #', '#   #', ' # # ', '  #  ', '  #  ', '  #  ', '  #  '],
'Z': ['#####', '    #', '   # ', '  #  ', ' #   ', '#    ', '#####'],
'a': ['    ', '    ', ' ###', '    #', ' ####', '#   #', ' ####'],
'b': ['#    ', '#    ', '#### ', '#   #', '#   #', '#   #', '#### '],
'c': ['    ', '    ', ' ###', '#   ', '#   ', '#   ', ' ###'],
'd': ['    #', '    #', ' ####', '#   #', '#   #', '#   #', ' ####'],
'e': ['     ', '     ', ' ### ', '#   #', '#####', '#    ', ' ### '],
'f': ['  ##', ' #  ', '####', ' #  ', ' #  ', ' #  ', ' #  '],
'g': ['     ', '     ', ' ####', '#   #', '#   #', ' ####', '    #', '    #', ' ### '],
'h': ['#    ', '#    ', '#### ', '#   #', '#   #', '#   #', '#   #'],
'i': ['#', ' ', '#', '#', '#', '#', '#'],
'j': ['  #', '   ', '  #', '  #', '  #', '  #', '  #', '  #', '## '],
'k': ['#   ', '#   ', '#  #', '# # ', '##  ', '# # ', '#  #'],
'l': ['# ', '# ', '# ', '# ', '# ', '# ', ' #'],
'm': ['     ', '     ', '## # ', '# # #', '# # #', '# # #', '#   #'],
'n': ['    ', '    ', '### ', '#  #', '#  #', '#  #', '#  #'],
'o': ['     ', '     ', ' ### ', '#   #', '#   #', '#   #', ' ### '],
'p': ['     ', '     ', '#### ', '#   #', '#   #', '#### ', '#    ', '#    ', '#    '],
'q': ['     ', '     ', ' ####', '#   #', '#   #', ' ####', '    #', '    #', '    #'],
'r': ['    ', '    ', '# ##', '##  ', '#   ', '#   ', '#   '],
's': ['    ', '    ', ' ###', '#   ', ' ## ', '   #', '### '],
't': [' #  ', ' #  ', '####', ' #  ', ' #  ', ' #  ', '  ##'],
'u': ['    ', '    ', '#  #', '#  #', '#  #', '#  #', ' ###'],
'v': ['     ', '     ', '#   #', '#   #', '#   #', ' # # ', '  #  '],
'w': ['     ', '     ', '#   #', '#   #', '# # #', '# # #', ' # # '],
'x': ['    ', '    ', '#  #', '#  #', ' ## ', '#  #', '#  #'],
'y': ['    ', '    ', '#  #', '#  #', '#  #', ' ###', '   #', '   #', '### '],
'z': ['    ', '    ', '####', '   #', ' ## ', '#   ', '####'],
'0': [' ### ', '#   #', '#  ##', '# # #', '##  #', '#   #', ' ### '],
'1': [' # ', '## ', ' # ', ' # ', ' # ', ' # ', '###'],
'2': [' ### ', '#   #', '    #', '   # ', '  #  ', ' #   ', '#####'],
'3': ['#### ', '    #', '    #', ' ### ', '    #', '    #', '#### '],
'4': ['   # ', '  ## ', ' # # ', '#  # ', '#####', '   # ', '   # '],
'5': ['#####', '#    ', '#### ', '    #', '    #', '#   #', ' ### '],
'6': [' ### ', '#    ', '#    ', '#### ', '#   #', '#   #', ' ### '],
'7': ['#####', '    #', '   # ', '  #  ', '  #  ', '  #  ', '  #  '],
'8': [' ### ', '#   #', '#   #', ' ### ', '#   #', '#   #', ' ### '],
'9': [' ### ', '#   #', '#   #', ' ####', '    #', '    #', ' ### '],
'.': [' ', ' ', ' ', ' ', ' ', ' ', '#'],
',': ['  ', '  ', '  ', '  ', '  ', '  ', ' #', '# '],
':': [' ', ' ', '#', ' ', ' ', ' ', '#'],
';': ['  ', '  ', ' #', '  ', '  ', '  ', ' #', '# '],
'!': ['#', '#', '#', '#', '#', ' ', '#'],
'?': [' ### ', '#   #', '    #', '   # ', '  #  ', '     ', '  #  '],
"'": ['#', '#'],
'’': [' #', ' #', '# '],
'‘': [' #', '# ', '##'],
'"': ['# #', '# #'],
'(': ['  #', ' # ', '#  ', '#  ', '#  ', ' # ', '  #'],
')': ['#  ', ' # ', '  #', '  #', '  #', ' # ', '#  '],
'[': ['##', '# ', '# ', '# ', '# ', '# ', '##'],
']': ['##', ' #', ' #', ' #', ' #', ' #', '##'],
'-': ['   ', '   ', '   ', '###'],
'–': ['    ', '    ', '    ', '####'],
'—': ['      ', '      ', '      ', '######'],
'_': ['     ', '     ', '     ', '     ', '     ', '     ', '     ', '#####'],
'+': ['     ', '  #  ', '  #  ', '#####', '  #  ', '  #  '],
'=': ['    ', '    ', '####', '    ', '####'],
'/': ['    #', '    #', '   # ', '  #  ', ' #   ', '#    ', '#    '],
'\\': ['#    ', '#    ', ' #   ', '  #  ', '   # ', '    #', '    #'],
'%': ['##  #', '##  #', '   # ', '  #  ', ' #   ', '#  ##', '#  ##'],
'&': [' ##  ', '#  # ', '#  # ', ' ##  ', '# # #', '#  # ', ' ## #'],
'*': ['     ', '# # #', ' ### ', '#####', ' ### ', '# # #'],
'#': [' # # ', ' # # ', '#####', ' # # ', '#####', ' # # ', ' # # '],
'<': ['   #', '  # ', ' #  ', '#   ', ' #  ', '  # ', '   #'],
'>': ['#   ', ' #  ', '  # ', '   #', '  # ', ' #  ', '#   '],
'·': [' ', ' ', ' ', '#'],
'•': ['  ', '  ', '##', '##'],
'…': ['     ', '     ', '     ', '     ', '     ', '     ', '# # #'],
'«': ['     ', '     ', '  # #', ' # # ', '# #  ', ' # # ', '  # #'],
'»': ['     ', '     ', '# #  ', ' # # ', '  # #', ' # # ', '# #  '],
'×': ['     ', '     ', '#   #', ' # # ', '  #  ', ' # # ', '#   #'],
'→': ['      ', '   #  ', '    # ', '######', '    # ', '   #  '],
'←': ['      ', '  #   ', ' #    ', '######', ' #    ', '  #   '],
'↑': ['  #  ', ' ### ', '# # #', '  #  ', '  #  ', '  #  ', '  #  '],
'↓': ['  #  ', '  #  ', '  #  ', '  #  ', '# # #', ' ### ', '  #  '],
'★': ['  #  ', '  #  ', '#####', ' ### ', ' # # ', '#   #'],
'✔': ['     ', '    #', '    #', '   # ', '#  # ', ' ##  ', '  #  '],
'✕': ['     ', '#   #', ' # # ', '  #  ', ' # # ', '#   #'],
'▲': ['     ', '  #  ', ' ### ', '#####'],
'▼': ['     ', '#####', ' ### ', '  #  '],
'°': [' # ', '# #', ' # '],
'/': ['    #', '    #', '   # ', '  #  ', ' #   ', '#    ', '#    '],
'|': ['#', '#', '#', '#', '#', '#', '#', '#'],
'@': [' ### ', '#   #', '# ###', '# # #', '# ###', '#    ', ' ####'],
'$': ['  #  ', ' ####', '# #  ', ' ### ', '  # #', '#### ', '  #  '],
'Œ': [' ####', '# #  ', '# #  ', '# ###', '# #  ', '# #  ', ' ####'],
'œ': ['     ', '     ', ' # # ', '# # #', '# ###', '# #  ', ' # ##'],
'Æ': [' ####', '# #  ', '# #  ', '#####', '# #  ', '# #  ', '# ###'],
'æ': ['     ', '     ', '#### ', '  # #', '#####', '# #  ', '#####'],
'ß': [' ##  ', '#  # ', '# #  ', '#  # ', '#   #', '#   #', '# ## '],
}

# les accents : des marques posées au-dessus (rangées négatives = au-dessus des capitales)
ACC = {
  'grave': ['#  ', ' # '], 'aigu': ['  #', ' # '], 'circ': [' # ', '# #'], 'trema': ['# #', '   '], 'cedille': [' # ', '#  '],
}
COMPOSES = {
  'à': ('a', 'grave'), 'â': ('a', 'circ'), 'ä': ('a', 'trema'), 'é': ('e', 'aigu'), 'è': ('e', 'grave'), 'ê': ('e', 'circ'), 'ë': ('e', 'trema'),
  'î': ('i', 'circ'), 'ï': ('i', 'trema'), 'ô': ('o', 'circ'), 'ö': ('o', 'trema'), 'ù': ('u', 'grave'), 'û': ('u', 'circ'), 'ü': ('u', 'trema'),
  'ÿ': ('y', 'trema'), 'ç': ('c', 'cedille'), 'á': ('a', 'aigu'), 'í': ('i', 'aigu'), 'ó': ('o', 'aigu'), 'ú': ('u', 'aigu'), 'ñ': ('n', 'circ'),
  'À': ('A', 'grave'), 'Â': ('A', 'circ'), 'Ä': ('A', 'trema'), 'É': ('E', 'aigu'), 'È': ('E', 'grave'), 'Ê': ('E', 'circ'), 'Ë': ('E', 'trema'),
  'Î': ('I', 'circ'), 'Ï': ('I', 'trema'), 'Ô': ('O', 'circ'), 'Ö': ('O', 'trema'), 'Ù': ('U', 'grave'), 'Û': ('U', 'circ'), 'Ü': ('U', 'trema'),
  'Ç': ('C', 'cedille'),
}

def pixels(rows, dy=0):
  out = []
  for y, r in enumerate(rows):
    for x, c in enumerate(r):
      if c == '#': out.append((x, y + dy))
  return out

def glyph_pixels(ch):
  if ch in G: return pixels(G[ch])
  base, acc = COMPOSES[ch]
  pts = pixels(G[base])
  w = max(x for x, _ in pts) + 1
  mark = ACC[acc]
  mw = 3
  ox = max(0, (w - mw + 1) // 2) if w > 1 else -1
  if acc == 'cedille':
    m = [(x + ox, y + 7) for x, y in pixels(mark)]
  elif base.isupper():
    m = [(x + ox, y - 3) for x, y in pixels(mark)]
  elif base == 'i':
    pts = [(x, y) for x, y in pts if y >= 2]  # le point du i laisse place à l'accent
    m = [(x - 1, y) for x, y in pixels(mark)]
  else:
    m = [(x + ox, y) for x, y in pixels(mark)]
  return pts + m

def width_of(ch, pts):
  if ch in G:
    return max(len(r) for r in G[ch])
  base, _ = COMPOSES[ch]
  return max(len(r) for r in G[base])

chars = list(G.keys()) + list(COMPOSES.keys())
names = ['.notdef', 'space', 'nbsp', 'thinsp'] + [f'u{ord(c):04X}' for c in chars]
fb = FontBuilder(EM, isTTF=True)
fb.setupGlyphOrder(names)
cmap = {32: 'space', 0xA0: 'nbsp', 0x202F: 'thinsp', 0x2009: 'thinsp'}
for c in chars: cmap[ord(c)] = f'u{ord(c):04X}'
fb.setupCharacterMap(cmap)

glyphs = {}
metrics = {}
def rect_glyph(pts):
  pen = TTGlyphPen(None)
  for x, y in pts:
    # y : rangée depuis le haut des capitales ; en unités de police, le pied est à 0
    x0 = x * PX; y1 = (CAP - y) * PX; y0 = y1 - PX
    pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x0 + PX, y1)); pen.lineTo((x0 + PX, y0)); pen.closePath()
  return pen.glyph()

empty = TTGlyphPen(None).glyph()
glyphs['.notdef'] = rect_glyph([(0, y) for y in range(7)] + [(3, y) for y in range(7)] + [(1, 0), (2, 0), (1, 6), (2, 6)]); metrics['.notdef'] = (5 * PX, 0)
glyphs['space'] = empty; metrics['space'] = (4 * PX, 0)
glyphs['nbsp'] = empty; metrics['nbsp'] = (4 * PX, 0)
glyphs['thinsp'] = empty; metrics['thinsp'] = (2 * PX, 0)
for c in chars:
  n = f'u{ord(c):04X}'
  pts = glyph_pixels(c)
  glyphs[n] = rect_glyph(pts)
  w = width_of(c, pts)
  minx = min((x for x, _ in pts), default=0)
  metrics[n] = ((w + 1) * PX, max(0, minx) * PX)
fb.setupGlyf(glyphs)
fb.setupHorizontalMetrics(metrics)
fb.setupHorizontalHeader(ascent=10 * PX, descent=-3 * PX)
fb.setupNameTable({'familyName': 'Pochoir', 'styleName': 'Regular', 'uniqueFontIdentifier': 'Pochoir-Heirline', 'fullName': 'Pochoir', 'psName': 'Pochoir-Regular', 'version': '1.0', 'copyright': 'Heirline'})
fb.setupOS2(sTypoAscender=10 * PX, sTypoDescender=-3 * PX, sTypoLineGap=0, usWinAscent=10 * PX, usWinDescent=3 * PX, sxHeight=5 * PX, sCapHeight=7 * PX)
fb.setupPost()
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', 'client', 'public')
os.makedirs(out, exist_ok=True)
fb.save(os.path.join(out, 'pochoir.ttf'))
fb.font.flavor = 'woff2'
fb.save(os.path.join(out, 'pochoir.woff2'))
print('Pochoir :', len(chars), 'signes')
