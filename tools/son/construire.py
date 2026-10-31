"""Le son de Heirline : bruitages, ambiances et musiques, construits à partir de sources CC0.

    bash tools/son/telecharger.sh                                  (une fois : les sources dans son/sources/)
    ~/.venvs/famcrawl-audio/bin/python -I tools/son/construire.py [sfx] [amb] [mus] [id…]

Écrit client/public/son/{sfx,amb,mus}/*.mp3 et client/src/son-manifest.json (fichiers, volumes, boucles).
Les bruitages partent des banques Kenney (impacts, lasers, interface, portes, moteurs), retravaillés ici (hauteur,
découpe, filtres, réverbération, superpositions) ; ce qui est organique (ÉDEN, la Couveuse) et les ambiances sont
synthétisés ici même, avec quelques sons Kenney semés dedans. Les musiques sont des pistes CC0 d'OpenGameArt,
égalisées en volume, avec leurs points de boucle mesurés. Rien n'est tiré au hasard sans graine : on reconstruit
toujours les mêmes fichiers.
"""
import json, os, subprocess, sys
import numpy as np
import librosa
import soundfile as sf
from scipy import signal

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'son', 'sources')
OUT = os.path.join(ROOT, 'client', 'public', 'son')
MANIFEST = os.path.join(ROOT, 'client', 'src', 'son-manifest.json')
SR = 44100
TMP = os.path.join(ROOT, 'son', 'tmp')
os.makedirs(TMP, exist_ok=True)

# ------------------------------------------------------------------ outils
_index = {}
for base, _, files in os.walk(os.path.join(SRC, 'kenney')):
    for f in files:
        if f.endswith('.ogg') and f != 'Preview.ogg':
            _index[f[:-4]] = os.path.join(base, f)
_cache = {}


def src(name):
    """un son Kenney (nom de fichier sans .ogg), mono, 44,1 kHz, silence de tête coupé"""
    if name not in _cache:
        y, _ = librosa.load(_index[name], sr=SR, mono=True)
        i = np.argmax(np.abs(y) > 10 ** (-45 / 20)) if np.any(np.abs(y) > 10 ** (-45 / 20)) else 0
        _cache[name] = y[i:].astype(np.float64)
    return _cache[name].copy()


def rate(x, r):
    """joué r fois plus vite : plus aigu et plus court (r < 1 : plus grave)"""
    if abs(r - 1) < 1e-3:
        return x
    return librosa.resample(x, orig_sr=SR, target_sr=int(SR / r), res_type='soxr_hq')


def cut(x, start=0.0, dur=None):
    a = int(start * SR)
    b = len(x) if dur is None else a + int(dur * SR)
    return x[a:b]


def fade(x, fi=0.002, fo=0.03):
    x = x.copy()
    n_i, n_o = min(len(x), int(fi * SR)), min(len(x), int(fo * SR))
    if n_i:
        x[:n_i] *= np.linspace(0, 1, n_i)
    if n_o:
        x[-n_o:] *= np.linspace(1, 0, n_o) ** 1.5
    return x


def _sos(kind, f):
    return signal.butter(4, f, btype=kind, fs=SR, output='sos')


def lp(x, f): return signal.sosfilt(_sos('lowpass', f), x, axis=-1)
def hp(x, f): return signal.sosfilt(_sos('highpass', f), x, axis=-1)
def bp(x, lo, hi): return signal.sosfilt(_sos('bandpass', [lo, hi]), x, axis=-1)


def mix(*parts, dur=None):
    """superpose des (son, décalage en s, gain)"""
    n = max(int(d * SR) + len(s) for s, d, g in parts)
    if dur:
        n = max(n, int(dur * SR))
    out = np.zeros(n)
    for s, d, g in parts:
        a = int(d * SR)
        out[a:a + len(s)] += s * g
    return out


def rng(seed): return np.random.default_rng(seed)


def ir(t60, seed=7, sr=SR):
    r = rng(seed)
    n = int(t60 * sr)
    e = np.exp(-6.9 * np.arange(n) / n)
    return r.standard_normal(n) * e


def rev(x, t60=0.6, wet=0.25, seed=7, dark=6000):
    w = signal.fftconvolve(x, lp(ir(t60, seed), dark))[: len(x) + int(t60 * SR)]
    w /= (np.max(np.abs(w)) + 1e-9)
    d = np.zeros(len(w))
    d[: len(x)] = x
    return d * (1 - wet) + w * wet * np.max(np.abs(x))


def noise(dur, color='white', seed=0):
    n = int(dur * SR)
    w = rng(seed).standard_normal(n)
    if color == 'white':
        return w
    f = np.fft.rfftfreq(n, 1 / SR)
    f[0] = f[1]
    s = np.fft.rfft(w) / (np.sqrt(f) if color == 'pink' else f)
    y = np.fft.irfft(s, n)
    return y / (np.max(np.abs(y)) + 1e-9)


def env(n, a, d, s=0.0, curve=2.0):
    """attaque a, chute d (s), en échantillons sur n"""
    e = np.zeros(n)
    na, nd = int(a * SR), int(d * SR)
    na = min(na, n)
    e[:na] = np.linspace(0, 1, na) if na else 0
    k = np.arange(n - na)
    e[na:] = s + (1 - s) * np.exp(-k / max(1, nd) * curve)
    return e


def osc(freq, dur, kind='sine', seed=0):
    """oscillateur à fréquence variable (tableau ou nombre)"""
    n = int(dur * SR)
    f = np.full(n, freq) if np.isscalar(freq) else np.interp(np.linspace(0, 1, n), np.linspace(0, 1, len(freq)), freq)
    ph = 2 * np.pi * np.cumsum(f) / SR
    if kind == 'sine':
        return np.sin(ph)
    if kind == 'saw':
        return 2 * ((ph / (2 * np.pi)) % 1) - 1
    if kind == 'square':
        return np.sign(np.sin(ph))
    if kind == 'tri':
        return 2 * np.abs(2 * ((ph / (2 * np.pi)) % 1) - 1) - 1


def growl(dur, f0=70, f1=50, seed=0, rough=0.5, formants=(400, 900, 2200)):
    """un cri de bête : dent de scie qui tremble, filtrée en formants, avec du souffle"""
    r = rng(seed)
    n = int(dur * SR)
    jit = np.cumsum(r.standard_normal(n)) / np.sqrt(SR) * 8
    f = np.linspace(f0, f1, n) * (1 + 0.04 * np.sin(2 * np.pi * 7 * np.arange(n) / SR)) + jit
    s = osc(f, dur, 'saw')
    am = 1 + rough * np.sin(2 * np.pi * (25 + 10 * r.random()) * np.arange(n) / SR)
    s *= am
    v = sum(bp(s, fo * 0.8, fo * 1.25) * g for fo, g in zip(formants, (1, 0.6, 0.3)))
    v += bp(noise(dur, 'pink', seed + 1), 300, 3000) * 0.35
    return v * env(n, 0.06, dur * 0.5, 0.3)


def squelch(dur=0.35, seed=0, lo=1800, hi=250):
    """une giclée de chair : bruit filtré dont le filtre descend, avec un petit bloup"""
    n = int(dur * SR)
    w = noise(dur, 'white', seed)
    out = np.zeros(n)
    steps = 24
    for k in range(steps):
        a, b = k * n // steps, (k + 1) * n // steps
        fc = lo * (hi / lo) ** (k / steps)
        out[a:b] = bp(w, fc * 0.6, fc * 1.6)[a:b]
    blo = osc(np.linspace(180, 90, n), dur) * env(n, 0.005, 0.08) * 0.6
    return (out * env(n, 0.003, dur * 0.4) + blo)


def screech(dur=1.0, f0=2600, f1=1700, seed=0):
    """le frein qui crisse : un sifflement qui vibre, dans du bruit métallique"""
    n = int(dur * SR)
    r = rng(seed)
    f = np.linspace(f0, f1, n) * (1 + 0.012 * np.sin(2 * np.pi * 31 * np.arange(n) / SR)) + np.cumsum(r.standard_normal(n)) * 0.02
    s = osc(f, dur) + 0.4 * osc(f * 2.01, dur) + 0.2 * osc(f * 3.03, dur)
    s += bp(noise(dur, 'white', seed), 2000, 7000) * 0.5
    e = env(n, 0.05, dur, 0.6) * np.linspace(1, 0.2, n)
    return s * e


def crackle(dur=1.0, seed=0, density=60):
    """le grésillement d'un vieux haut-parleur"""
    r = rng(seed)
    n = int(dur * SR)
    out = bp(noise(dur, 'white', seed), 1200, 4000) * 0.15
    for _ in range(int(density * dur)):
        i = r.integers(0, n - 200)
        out[i:i + 40] += r.uniform(-1, 1) * np.exp(-np.arange(40) / 8)
    return out


def bell(freq, dur=1.5, partials=((1, 1), (2.76, 0.4), (5.4, 0.2), (8.9, 0.1))):
    n = int(dur * SR)
    return sum(osc(freq * p, dur) * g * env(n, 0.002, dur / (1 + p * 0.6)) for p, g in partials)


def chime(notes, step=0.16, dur=0.9, kind='sine'):
    parts = []
    for i, f in enumerate(notes):
        n = int(dur * SR)
        t = osc(f, dur, kind) * 0.7 + osc(f * 2, dur) * 0.2
        parts.append((t * env(n, 0.004, dur * 0.35), i * step, 1.0))
    return mix(*parts)


def thump(f0=55, dur=0.35, seed=0):
    n = int(dur * SR)
    return osc(np.linspace(f0 * 1.8, f0, n), dur) * env(n, 0.004, dur * 0.4)


def E(x, a=0.01, d=0.2, s=0.0):
    """une enveloppe sur un son déjà là"""
    return x * env(len(x), a, d, s)


def ramp(x, a=0.2, b=1.0):
    return x * np.linspace(a, b, len(x))


def loopfit(x, n, xf=0.4):
    """un son répété jusqu'à n échantillons, chaque reprise fondue dans la précédente"""
    k = int(xf * SR)
    out = np.zeros(n + len(x))
    pos, step = 0, len(x) - k
    w = np.ones(len(x))
    w[:k] = np.sin(np.linspace(0, np.pi / 2, k))
    w[-k:] = np.cos(np.linspace(0, np.pi / 2, k))
    while pos < n:
        out[pos:pos + len(x)] += x * w
        pos += step
    return out[:n]


def norm(x, peak_db=-1.0):
    m = np.max(np.abs(x)) + 1e-12
    return x * (10 ** (peak_db / 20) / m)


def encode(x, path, kbps=96, stereo=False):
    tmp = os.path.join(TMP, 'x.wav')
    data = x.T if stereo else x
    sf.write(tmp, np.clip(data, -1, 1).astype(np.float32), SR)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', tmp, '-ac', '2' if stereo else '1', '-ar', str(SR),
                    '-codec:a', 'libmp3lame', '-b:a', f'{kbps}k', path], check=True)


# ------------------------------------------------------------------ les bruitages
SFX = {}


def S(id, fn, n=1, vol=0.5, bus='fx', voix=4, prio=1, var=0.05, dist=1.0):
    """un bruitage : fn(i) rend la variante i ; voix = sons joués en même temps au plus ; prio : 0 décor, 1 normal,
    2 important (jamais coupé) ; var : variation de hauteur à chaque lecture ; dist : 0 = pas spatialisé"""
    SFX[id] = dict(fn=fn, n=n, vol=vol, bus=bus, voix=voix, prio=prio, var=var, dist=dist)


K = src
# — les armes : une par classe, et une version « chargée » à partir du palier 3 (niveau 10)
S('tir_fan_1', lambda i: fade(cut(rate(K(f'laserSmall_00{i}'), 1.15), 0, 0.11), fo=0.04), n=3, vol=0.17, voix=3, var=0.04)
S('tir_fan_2', lambda i: fade(mix((cut(rate(K(f'laserSmall_00{i + 2}'), 0.95), 0, 0.13), 0, 1), (lp(cut(K(f'impactMetal_light_00{i}'), 0, 0.08), 3000), 0, 0.35)), fo=0.05), n=3, vol=0.2, voix=3, var=0.04)
S('tir_med_1', lambda i: fade(cut(rate(K(f'laserRetro_00{i}'), 1.05), 0, 0.2), fo=0.06), n=2, vol=0.28, voix=3)
S('tir_med_2', lambda i: fade(mix((cut(rate(K(f'laserRetro_00{i + 2}'), 0.92), 0, 0.24), 0, 1), (cut(rate(K('forceField_001'), 1.6), 0, 0.2), 0, 0.3)), fo=0.08), n=2, vol=0.3, voix=3)
S('tir_ing_1', lambda i: fade(mix((cut(K(f'explosionCrunch_00{i}'), 0, 0.28), 0, 1), (lp(cut(K(f'impactMetal_medium_00{i}'), 0, 0.1), 2500), 0, 0.5)), fo=0.12), n=2, vol=0.34, voix=3)
S('tir_ing_2', lambda i: fade(mix((cut(rate(K(f'explosionCrunch_00{i + 2}'), 0.85), 0, 0.34), 0, 1), (lp(cut(K('lowFrequency_explosion_000'), 0, 0.3), 400), 0, 0.6)), fo=0.15), n=2, vol=0.38, voix=3)
S('tir_rob', lambda i: fade(cut(rate(K(f'laser{4 + i}'), 1.25), 0, 0.12), fo=0.04), n=3, vol=0.16, voix=3, prio=0)
S('tir_tourelle', lambda i: fade(cut(rate(K(f'laserSmall_00{3 + i}'), 1.5), 0, 0.09), fo=0.03), n=2, vol=0.15, voix=2, prio=0)
S('tir_eden', lambda i: fade(mix((squelch(0.18, 30 + i, 2400, 600), 0, 0.8), (cut(rate(K('slime_000'), 1.6 + 0.2 * i), 0, 0.15), 0, 0.6)), fo=0.05), n=3, vol=0.24, voix=3)
S('tir_machine', lambda i: fade(cut(rate(K(f'laserRetro_00{i}'), 0.7), 0, 0.22), fo=0.06), n=2, vol=0.22, voix=3)
# — les impacts
S('touche_chair', lambda i: fade(mix((cut(K(f'impactSoft_medium_00{i}'), 0, 0.14), 0, 1), (squelch(0.12, 40 + i, 1500, 400), 0, 0.5)), fo=0.04), n=4, vol=0.24, voix=4, prio=0, var=0.08)
S('touche_metal', lambda i: fade(cut(K(f'impactMetal_light_00{i}'), 0, 0.16), fo=0.05), n=4, vol=0.22, voix=4, prio=0, var=0.08)
S('touche_mur', lambda i: fade(cut(K(f'impactGeneric_light_00{i}'), 0, 0.1), fo=0.04), n=3, vol=0.12, voix=2, prio=0, var=0.1)
S('aie', lambda i: fade(mix((cut(K(f'impactPunch_medium_00{i}'), 0, 0.2), 0, 1), (lp(noise(0.12, 'pink', 50 + i), 900) * env(int(0.12 * SR), 0.002, 0.04), 0, 0.5)), fo=0.06), n=3, vol=0.42, voix=2, prio=2, dist=0)
S('mort_eden', lambda i: fade(rev(mix((squelch(0.5, 60 + i, 1400, 150), 0, 1), (cut(rate(K(f'slime_00{i}'), 0.8), 0, 0.5), 0.02, 0.8), (cut(K(f'impactSoft_heavy_00{i}'), 0, 0.3), 0, 0.6)), 0.4, 0.2), fo=0.12), n=2, vol=0.34, voix=3)
S('mort_machine', lambda i: fade(mix((cut(K(f'explosionCrunch_00{3 + i}'), 0, 0.6), 0, 1), (cut(K(f'impactMetal_heavy_00{i}'), 0, 0.4), 0.05, 0.6)), fo=0.15), n=2, vol=0.36, voix=3)
S('mort_bete', lambda i: fade(mix((growl(0.5, 140 - 20 * i, 60, 70 + i, 0.6, (500, 1100, 2400)), 0, 0.8), (cut(K(f'impactPunch_heavy_00{i}'), 0, 0.3), 0.08, 0.8)), fo=0.12), n=2, vol=0.32, voix=3)
S('boum', lambda i: fade(rev(mix((cut(K(f'explosionCrunch_00{i}'), 0, 0.9), 0, 1), (cut(K(f'lowFrequency_explosion_00{i % 2}'), 0, 1.2), 0, 0.9)), 0.9, 0.25), fo=0.3), n=2, vol=0.5, voix=3, prio=2)
S('boum_eden', lambda i: fade(rev(mix((cut(K(f'lowFrequency_explosion_00{i % 2}'), 0, 1.0), 0, 0.9), (squelch(0.6, 80 + i, 1200, 120), 0, 1), (cut(rate(K('slime_001'), 0.6), 0, 0.6), 0.03, 0.7)), 0.8, 0.25), fo=0.3), n=2, vol=0.46, voix=3, prio=2)
# — les compétences et le soldat
S('esquive', lambda i: fade(E(hp(cut(rate(K(f'thrusterFire_00{i}'), 1.4), 0, 0.22), 300), 0.02, 0.1), fo=0.06), n=2, vol=0.3, voix=2, dist=0.3)
S('bouclier', lambda i: fade(mix((cut(K('forceField_000'), 0, 0.9), 0, 1), (chime([392, 587], 0.07, 0.6), 0, 0.25)), fo=0.25), vol=0.4, voix=2, prio=2)
S('grenade_lance', lambda i: fade(mix((cut(K('metalClick'), 0, 0.1), 0, 0.8), (hp(cut(rate(K('thrusterFire_002'), 2.0), 0, 0.2), 900), 0.06, 0.5)), fo=0.06), vol=0.3, voix=2)
S('injection', lambda i: fade(mix((cut(rate(K('forceField_002'), 1.3), 0, 0.7), 0, 0.7), (chime([523, 659, 784, 1047], 0.06, 0.7), 0.05, 0.45)), fo=0.25), vol=0.4, voix=2, prio=2)
S('adrenaline', lambda i: fade(mix((cut(K('powerUp5'), 0, 0.8), 0, 1), (thump(70, 0.3), 0, 0.6), (thump(70, 0.3), 0.18, 0.5)), fo=0.2), vol=0.38, voix=2, prio=2)
S('tourelle_pose', lambda i: fade(mix((cut(K('doorClose_000'), 0, 0.5), 0, 0.8), (cut(K('metalLatch'), 0, 0.2), 0.25, 0.9), (cut(rate(K('computerNoise_001'), 1.2), 0, 0.35), 0.4, 0.4)), fo=0.1), vol=0.4, voix=2, prio=2)
S('surcharge', lambda i: fade(mix((cut(K('phaserUp3'), 0, 0.7), 0, 0.9), (cut(rate(K('forceField_004'), 0.8), 0, 0.8), 0.1, 0.6), (cut(K('zapTwoTone'), 0, 0.3), 0.4, 0.4)), fo=0.25), vol=0.42, voix=2, prio=2)
S('releve', lambda i: fade(mix((chime([262, 330, 392, 523], 0.14, 1.4, 'tri'), 0, 0.7), (cut(K('powerUp10'), 0, 0.9), 0.1, 0.5)), fo=0.4), vol=0.45, voix=1, prio=2, dist=0)
S('aterre', lambda i: fade(rev(mix((cut(K('lowDown'), 0, 0.8), 0, 0.8), (cut(K('impactPunch_heavy_002'), 0, 0.3), 0, 1), (thump(45, 0.6), 0, 0.7)), 0.8, 0.3), fo=0.3), vol=0.5, voix=1, prio=2, dist=0)
S('releve_allie', lambda i: fade(chime([392, 523, 659], 0.09, 0.8), fo=0.2), vol=0.32, voix=2)
S('niveau', lambda i: fade(mix((cut(K('jingles_STEEL00'), 0, 2.2), 0, 1)), fo=0.4), vol=0.45, voix=1, prio=2, bus='ui', dist=0)
# — le robot
S('robot_pas', lambda i: fade(lp(mix((cut(rate(K(f'footstep_concrete_00{i}'), 0.7), 0, 0.2), 0, 1), (cut(rate(K(f'impactMetal_light_00{i}'), 0.6), 0, 0.12), 0, 0.25)), 2600), fo=0.05), n=4, vol=0.16, voix=2, prio=0, var=0.06)
S('monture_monte', lambda i: fade(mix((cut(K('doorOpen_001'), 0, 0.5), 0, 0.7), (cut(rate(K('engineCircular_001'), 1.2), 0, 0.6), 0.15, 0.5)), fo=0.2), vol=0.36, voix=1, dist=0.4)
S('monture_descend', lambda i: fade(mix((cut(K('doorClose_001'), 0, 0.45), 0, 0.8), (cut(K('metalLatch'), 0, 0.2), 0.2, 0.6)), fo=0.15), vol=0.34, voix=1, dist=0.4)
S('repare', lambda i: fade(mix((cut(K('computerNoise_000'), 0, 0.5), 0, 0.6), (cut(K('metalLatch'), 0, 0.2), 0.1, 0.8), (chime([523, 784], 0.08, 0.5), 0.35, 0.35)), fo=0.15), vol=0.36, voix=2)
S('avantposte', lambda i: fade(rev(mix((cut(K('forceField_003'), 0, 1.0), 0, 0.8), (bell(220, 1.6), 0.1, 0.5), (cut(K('impactBell_heavy_001'), 0, 0.8), 0, 0.5)), 1.0, 0.3), fo=0.4), vol=0.44, voix=1, prio=2)
S('panne', lambda i: fade(mix((cut(K('spaceTrash3'), 0, 0.5), 0, 0.8), (cut(K('phaserDown2'), 0, 0.6), 0.05, 0.6)), fo=0.15), vol=0.34, voix=1)
# — les ennemis
S('eclosion', lambda i: fade(mix((squelch(0.4, 90 + i, 900, 200), 0, 1), (cut(rate(K('slime_001'), 1.3), 0, 0.3), 0.05, 0.7)), fo=0.1), n=2, vol=0.3, voix=2)
S('morsure', lambda i: fade(mix((cut(K(f'impactPunch_medium_00{2 + i}'), 0, 0.15), 0, 0.9), (squelch(0.15, 100 + i, 2500, 900), 0, 0.5)), fo=0.04), n=2, vol=0.3, voix=2)
S('crache', lambda i: fade(mix((squelch(0.22, 110 + i, 2800, 700), 0, 0.9), (cut(rate(K('slime_000'), 1.4), 0, 0.2), 0, 0.5)), fo=0.06), n=2, vol=0.26, voix=3, prio=0)
S('cri_eden', lambda i: fade(rev(growl(0.7 + 0.2 * i, 180 + 40 * i, 110, 120 + i, 0.7, (650, 1500, 3200)), 0.5, 0.25), fo=0.2), n=2, vol=0.3, voix=2, prio=0)
# — la Couveuse et l'arène
S('balle_motif', lambda i: fade(mix((cut(rate(K(f'pepSound{1 + i}'), 0.6), 0, 0.18), 0, 0.8), (squelch(0.12, 130 + i, 1800, 700), 0, 0.4)), fo=0.06), n=3, vol=0.2, voix=3, prio=0, dist=0.5)
S('balle_touche', lambda i: fade(mix((cut(K(f'impactSoft_medium_00{i}'), 0, 0.12), 0, 0.7), (squelch(0.1, 140 + i, 2000, 800), 0, 0.5)), fo=0.04), n=2, vol=0.3, voix=2, prio=1, dist=0)
S('zone_annonce', lambda i: fade(mix((osc(np.linspace(220, 140, int(0.9 * SR)), 0.9, 'tri') * env(int(0.9 * SR), 0.15, 0.5, 0.2) * 0.4, 0, 1), (bp(noise(0.9, 'pink', 150 + i), 200, 900) * env(int(0.9 * SR), 0.3, 0.4, 0.3), 0, 0.5)), fo=0.2), n=2, vol=0.3, voix=2, dist=0.4)
S('zone_boum', lambda i: fade(rev(mix((cut(K(f'explosionCrunch_00{i}'), 0, 0.6), 0, 0.7), (squelch(0.5, 160 + i, 1000, 150), 0, 1), (thump(50, 0.4), 0, 0.8)), 0.6, 0.2), fo=0.2), n=2, vol=0.42, voix=3, prio=2, dist=0.5)
S('colonne_spores', lambda i: fade(mix((hp(noise(0.9, 'pink', 170 + i), 1500) * env(int(0.9 * SR), 0.05, 0.6), 0, 0.6), (squelch(0.4, 175 + i, 600, 200), 0.05, 0.8)), fo=0.2), n=2, vol=0.36, voix=3, prio=2, dist=0.5)
S('sol_arrache', lambda i: fade(rev(mix((cut(K(f'impactMining_00{i}'), 0, 0.4), 0, 0.8), (cut(K(f'impactWood_heavy_00{i}'), 0, 0.4), 0.02, 0.6), (squelch(0.5, 180 + i, 700, 120), 0.05, 0.8)), 0.6, 0.2), fo=0.2), n=3, vol=0.36, voix=3, prio=1, dist=0.5)
S('mur_chair', lambda i: fade(mix((E(lp(cut(rate(K('spaceEngineLow_002'), 0.6), 0, 2.0), 500), 0.4, 1.5, 0.4), 0, 0.9), (squelch(0.8, 190, 900, 120), 0.3, 0.7), (squelch(0.8, 191, 700, 100), 1.0, 0.6)), fo=0.5), vol=0.48, voix=1, prio=2, dist=0)
S('flash', lambda i: fade(mix((cut(rate(K('phaserUp1'), 0.55), 0, 0.8), 0, 0.8), (cut(rate(K('forceField_001'), 0.7), 0, 0.8), 0, 0.6), (osc(np.linspace(300, 1400, int(0.6 * SR)), 0.6) * env(int(0.6 * SR), 0.3, 0.3) * 0.3, 0, 1)), fo=0.15), vol=0.42, voix=1, prio=2, dist=0)
S('couveuse_cri', lambda i: fade(rev(mix((growl(1.6, 95, 60, 200 + i, 0.8, (380, 850, 2100)), 0, 1), (growl(1.4, 190, 120, 210 + i, 0.6, (700, 1600, 3000)), 0.1, 0.45), (cut(rate(K('lowFrequency_explosion_001'), 0.7), 0, 1.4), 0, 0.5)), 1.4, 0.35), fo=0.5), vol=0.55, voix=1, prio=2, dist=0)
S('sac_creve', lambda i: fade(rev(mix((squelch(0.9, 220, 1200, 90), 0, 1), (cut(rate(K('slime_001'), 0.5), 0, 0.9), 0.02, 0.8), (cut(K('lowFrequency_explosion_000'), 0, 1.0), 0, 0.7), (cut(K('impactSoft_heavy_004'), 0, 0.4), 0, 0.8)), 1.2, 0.3), fo=0.4), vol=0.6, voix=1, prio=2)
S('boss_mort', lambda i: fade(rev(mix((growl(2.2, 110, 40, 230, 0.9, (350, 800, 1900)), 0, 0.9), (cut(K('lowFrequency_explosion_001'), 0, 1.5), 0.4, 0.9), (squelch(1.2, 231, 1000, 80), 0.6, 0.9), (cut(rate(K('slime_001'), 0.45), 0, 1.2), 0.8, 0.7)), 2.0, 0.35), fo=0.8), vol=0.62, voix=1, prio=2, dist=0)
# — le monorail
S('rail_cloche', lambda i: fade(rev(mix((bell(659, 2.2), 0, 0.8), (bell(523, 2.2), 0.45, 0.8), (cut(K('impactBell_heavy_000'), 0, 1.2), 0, 0.35)), 1.4, 0.3), fo=0.5), vol=0.42, voix=1, prio=2, dist=0.4)
S('rail_frein', lambda i: fade(mix((screech(1.4, 2700, 1600, 240), 0, 0.5), (lp(cut(rate(K('spaceEngineLow_000'), 0.8), 0, 1.4), 600), 0, 0.6), (cut(K('impactMetal_heavy_002'), 0, 0.4), 1.25, 0.5)), fo=0.3), vol=0.36, voix=1, prio=2, dist=0.4)
S('rail_portes', lambda i: fade(mix((cut(K(f'doorOpen_00{i}'), 0, 0.8), 0, 0.9), (hp(noise(0.5, 'white', 250 + i), 2500) * env(int(0.5 * SR), 0.01, 0.2), 0, 0.3)), fo=0.15), n=2, vol=0.38, voix=1, prio=2, dist=0.4)
S('rail_annonce', lambda i: fade(mix((chime([784, 659, 523], 0.22, 0.9, 'tri'), 0, 0.5), (crackle(1.6, 260), 0, 0.8), (bp(noise(1.6, 'pink', 261), 400, 3000) * 0.15, 0, 1)), fo=0.3), vol=0.36, voix=1, prio=2, bus='ui', dist=0)
S('rail_depart', lambda i: fade(mix((ramp(lp(cut(rate(K('spaceEngine_001'), 0.7), 0, 2.2), 900)), 0, 0.8), (cut(K('metalLatch'), 0, 0.2), 0, 0.5)), fo=0.4), vol=0.36, voix=1, prio=2, dist=0.4)
# — l'interface
S('ui_clic', lambda i: fade(cut(K(['click_001', 'click1'][i]), 0, 0.12), fo=0.03), n=2, vol=0.3, bus='ui', voix=2, prio=2, dist=0, var=0.02)
S('ui_ouvre', lambda i: fade(cut(K('open_001'), 0, 0.3), fo=0.05), vol=0.3, bus='ui', voix=1, prio=2, dist=0, var=0)
S('ui_ferme', lambda i: fade(cut(K('close_001'), 0, 0.3), fo=0.05), vol=0.28, bus='ui', voix=1, prio=2, dist=0, var=0)
S('ui_erreur', lambda i: fade(cut(K('error_004'), 0, 0.4), fo=0.05), vol=0.3, bus='ui', voix=1, prio=2, dist=0, var=0)
S('quete_prise', lambda i: fade(mix((cut(K('confirmation_001'), 0, 0.6), 0, 0.8), (cut(K('bookFlip2'), 0, 0.3), 0, 0.5)), fo=0.1), vol=0.36, bus='ui', voix=1, prio=2, dist=0, var=0)
S('quete_prete', lambda i: fade(cut(K('question_002'), 0, 0.6), fo=0.1), vol=0.32, bus='ui', voix=1, prio=2, dist=0, var=0)
S('quete_rendue', lambda i: fade(cut(K('jingles_STEEL02'), 0, 2.4), fo=0.4), vol=0.42, bus='ui', voix=1, prio=2, dist=0, var=0)
S('butin_0', lambda i: fade(mix((cut(K('handleCoins'), 0, 0.3), 0, 0.7), (cut(K('drop_001'), 0, 0.2), 0, 0.4)), fo=0.06), vol=0.26, bus='ui', voix=2, dist=0)
S('butin_1', lambda i: fade(mix((cut(K('pluck_001'), 0, 0.4), 0, 0.8), (cut(K('handleCoins2'), 0, 0.3), 0, 0.4)), fo=0.08), vol=0.3, bus='ui', voix=2, dist=0, var=0)
S('butin_2', lambda i: fade(mix((cut(K('confirmation_003'), 0, 0.6), 0, 0.8), (chime([880, 1175, 1568], 0.07, 0.8), 0.05, 0.35)), fo=0.15), vol=0.34, bus='ui', voix=2, prio=2, dist=0, var=0)
S('butin_3', lambda i: fade(mix((cut(K('jingles_NES03'), 0, 1.6), 0, 0.7), (chime([659, 880, 1047, 1319, 1760], 0.08, 1.2), 0, 0.35)), fo=0.3), vol=0.4, bus='ui', voix=1, prio=2, dist=0, var=0)
S('ferraille', lambda i: fade(mix((cut(K(f'impactTin_medium_00{i}'), 0, 0.15), 0, 0.6), (cut(K('handleCoins'), 0.05, 0.2), 0, 0.4)), fo=0.05), n=2, vol=0.2, bus='ui', voix=2, prio=0, dist=0)
S('passage', lambda i: fade(rev(mix((cut(K('doorOpen_002'), 0, 0.8), 0, 0.7), (cut(K('phaseJump2'), 0, 0.6), 0.1, 0.5)), 0.6, 0.2), fo=0.2), vol=0.36, bus='ui', voix=1, prio=2, dist=0, var=0)
S('gare_repare', lambda i: fade(mix((cut(K('computerNoise_002'), 0, 0.6), 0, 0.5), (cut(K('powerUp7'), 0, 0.8), 0.2, 0.6), (bell(784, 1.0), 0.6, 0.3)), fo=0.3), vol=0.38, bus='ui', voix=1, prio=2, dist=0, var=0)
S('bulle', lambda i: fade(cut(rate(K(f'select_00{1 + i}'), 1.1), 0, 0.12), fo=0.03), n=3, vol=0.14, bus='ui', voix=1, prio=0, dist=0.6, var=0.1)
S('lecture', lambda i: fade(mix((cut(K('bookOpen'), 0, 0.5), 0, 0.8), (cut(K('bookFlip1'), 0, 0.3), 0.25, 0.5)), fo=0.1), vol=0.32, bus='ui', voix=1, prio=2, dist=0, var=0)

# ------------------------------------------------------------------ les ambiances (boucles de 30 s, stéréo)
AMB_LEN, AMB_X = 30.0, 3.0


def stereo(l, r): return np.vstack([l, r])


def wide(fn, seed):
    """un même bruit en deux versions décorrélées, pour l'espace"""
    return stereo(fn(seed), fn(seed + 1000))


def place(buf, s, t, pan=0.0, g=1.0):
    """pose un son mono s à t secondes, panoramique pan (-1 gauche, 1 droite)"""
    a = int(t * SR)
    b = min(buf.shape[1], a + len(s))
    if b <= a:
        return
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[0, a:b] += s[: b - a] * g * gl * 1.41
    buf[1, a:b] += s[: b - a] * g * gr * 1.41


def lfo(n, rate_hz, seed, depth=0.5, base=0.5):
    r = rng(seed)
    t = np.arange(n) / SR
    v = sum(np.sin(2 * np.pi * rate_hz * k * t + r.random() * 6.28) / k for k in (1, 2.3, 4.1))
    v = v / (np.max(np.abs(v)) + 1e-9)
    return base + depth * v


def vent(total, seed, force=0.5, lo=200, hi=1400):
    n = int(total * SR)
    def one(s):
        w = noise(total, 'pink', s)
        # filtre qui respire : on mélange deux bandes selon un lfo lent
        a, b = bp(w, lo * 0.6, lo * 2.2), bp(w, hi * 0.5, hi * 1.6)
        m = np.clip(lfo(n, 0.05, s + 1, 0.5, 0.5), 0, 1)
        return (a * (1 - m) + b * m) * np.clip(lfo(n, 0.07, s + 2, 0.4, 0.6), 0.1, 1) * force
    return wide(one, seed)


def vagues(total, seed, g=1.0):
    n = int(total * SR)
    r = rng(seed)
    buf = np.zeros((2, n))
    t = 0.0
    while t < total:
        d = r.uniform(5.5, 8.5)
        k = int(d * SR)
        ressac = np.sin(np.linspace(0, np.pi, k)) ** 3
        w = stereo(bp(noise(d, 'pink', int(r.integers(1e6))), 150, 1200), bp(noise(d, 'pink', int(r.integers(1e6))), 150, 1200))
        crash = bp(noise(d, 'white', int(r.integers(1e6))), 1800, 5000) * (np.sin(np.linspace(0, np.pi, k)) ** 8) * 0.07
        a = int(t * SR)
        b = min(n, a + k)
        buf[:, a:b] += (w * ressac + crash)[:, : b - a] * g
        t += d * r.uniform(0.55, 0.8)
    return buf


def mouette(seed):
    r = rng(seed)
    parts = []
    for j in range(r.integers(1, 4)):
        d = r.uniform(0.25, 0.45)
        n = int(d * SR)
        f = np.concatenate([np.linspace(1500, 2300, n // 3), np.linspace(2300, 1300, n - n // 3)]) * r.uniform(0.9, 1.1)
        s = osc(f, d, 'saw') * 0.3 + osc(f, d) * 0.7
        s = bp(s, 900, 5000) * env(n, 0.03, d * 0.6, 0.2) * np.hanning(n) ** 0.3
        parts.append((s, j * r.uniform(0.35, 0.55), 1))
    return mix(*parts)


def oiseau(seed):
    r = rng(seed)
    parts = []
    base = r.uniform(2500, 4800)
    for j in range(r.integers(2, 7)):
        d = r.uniform(0.04, 0.12)
        n = int(d * SR)
        f = base * (1 + r.uniform(-0.25, 0.35) * np.linspace(0, 1, n) ** r.uniform(0.5, 2))
        parts.append((osc(f, d) * np.hanning(n), j * r.uniform(0.08, 0.16), r.uniform(0.6, 1)))
    return mix(*parts)


def insectes(total, seed, g=0.15, f=5200):
    n = int(total * SR)
    def one(s):
        w = bp(noise(total, 'white', s), f * 0.85, f * 1.15)
        am = (np.sin(2 * np.pi * 42 * np.arange(n) / SR) > 0.2).astype(float)
        gate = np.clip(lfo(n, 0.11, s + 5, 0.9, 0.3), 0, 1)
        return w * am * gate * g
    return wide(one, seed)


def grenouille(seed):
    r = rng(seed)
    parts = []
    f0 = r.uniform(250, 420)
    for j in range(r.integers(1, 4)):
        d = r.uniform(0.12, 0.2)
        n = int(d * SR)
        s = osc(f0 * (1 + 0.15 * np.linspace(0, 1, n)), d, 'square') * (np.sin(2 * np.pi * 60 * np.arange(n) / SR) > 0)
        parts.append((bp(s, 300, 1500) * np.hanning(n), j * 0.28, 1))
    return mix(*parts)


def bulle(seed):
    r = rng(seed)
    d = r.uniform(0.06, 0.16)
    n = int(d * SR)
    return osc(np.linspace(r.uniform(150, 260), r.uniform(450, 900), n), d) * env(n, 0.004, d * 0.4)


def goutte(seed):
    r = rng(seed)
    d = 0.08
    n = int(d * SR)
    return osc(np.linspace(r.uniform(1200, 1800), r.uniform(2400, 3400), n), d) * env(n, 0.001, 0.02)


def bourdon(total, notes, seed, g=0.2, kind='sine'):
    """une nappe grave : quelques notes légèrement désaccordées qui battent lentement"""
    n = int(total * SR)
    out = np.zeros((2, n))
    for k, f in enumerate(notes):
        for c in range(2):
            det = 1 + (0.002 * (c * 2 - 1)) * (k + 1)
            out[c] += osc(f * det, total, kind) * lfo(n, 0.03 + 0.01 * k, seed + k * 7 + c, 0.3, 0.7) / len(notes)
    return lp(out, 1800) * g


def boucle(buf):
    """30 s qui se répètent sans couture : la fin (3 s de plus) se fond dans le début"""
    n, x = int(AMB_LEN * SR), int(AMB_X * SR)
    out = buf[:, :n].copy()
    k = np.linspace(0, 1, x)
    out[:, :x] = out[:, :x] * np.sin(k * np.pi / 2) + buf[:, n:n + x] * np.cos(k * np.pi / 2)
    return out


def semer(buf, total, fn, every, seed, g=1.0, pan=0.8):
    r = rng(seed)
    t = r.uniform(0, every)
    while t < total - 1:
        place(buf, fn(int(r.integers(1e6))), t, r.uniform(-pan, pan), g * r.uniform(0.5, 1))
        t += r.uniform(every * 0.5, every * 1.5)


def kenney_semes(names, rate_r=(0.8, 1.1), lowpass=3000, wet=0.4):
    def fn(seed):
        r = rng(seed)
        s = rate(src(names[int(r.integers(len(names)))]), r.uniform(*rate_r))
        return rev(lp(s, lowpass), 1.2, wet, seed)
    return fn


AMB = {}


def A(id, fn, vol=0.5):
    AMB[id] = dict(fn=fn, vol=vol)


T = AMB_LEN + AMB_X


def amb_port():
    b = lp(vagues(T, 1, 0.9), 3500) + vent(T, 2, 0.25)
    semer(b, T, mouette, 5, 3, 0.6)
    semer(b, T, kenney_semes(['impactMetal_medium_000', 'impactMetal_medium_002', 'impactPlank_medium_001', 'impactWood_medium_003'], (0.85, 1.0), 2200, 0.5), 2.5, 4, 0.12)
    semer(b, T, kenney_semes(['creak1', 'creak2', 'creak3'], (0.7, 0.9), 2500, 0.3), 7, 5, 0.18)
    place(b, rev(bell(392, 3.0), 2.0, 0.5), 21.0, -0.5, 0.1)
    return b


def amb_plaines():
    b = vent(T, 10, 0.5, 250, 1600) + insectes(T, 11, 0.06, 4800)
    semer(b, T, oiseau, 4, 12, 0.18)
    return b


def amb_foret():
    b = vent(T, 20, 0.28, 300, 1200) + insectes(T, 21, 0.035, 6200)
    semer(b, T, oiseau, 1.8, 22, 0.22)
    semer(b, T, kenney_semes(['creak1', 'creak3'], (0.5, 0.7), 1200, 0.5), 9, 23, 0.1)
    return b


def amb_marais():
    b = vent(T, 30, 0.18, 200, 900) + insectes(T, 31, 0.04, 3600)
    semer(b, T, grenouille, 2.2, 32, 0.25)
    semer(b, T, bulle, 0.7, 33, 0.12)
    return b


def amb_plateaux():
    return vent(T, 40, 0.75, 180, 2200) + vent(T, 41, 0.3, 600, 3200)


def amb_cimetiere():
    b = vent(T, 50, 0.45, 200, 1300)
    semer(b, T, kenney_semes(['creak1', 'creak2', 'creak3'], (0.45, 0.7), 1800, 0.5), 3.5, 51, 0.25)
    semer(b, T, kenney_semes(['impactMetal_heavy_001', 'impactMetal_heavy_003', 'impactPlate_heavy_002'], (0.55, 0.75), 1500, 0.6), 6, 52, 0.12)
    return b


def amb_eden():
    b = bourdon(T, [55, 82.4, 110, 164.8], 60, 0.35, 'tri')
    b += wide(lambda s: bp(noise(T, 'pink', s), 150, 700) * lfo(int(T * SR), 0.18, s, 0.45, 0.5), 61) * 0.25
    semer(b, T, lambda s: squelch(0.5, s, 900, 150), 3, 62, 0.12)
    for k in range(int(T / 1.1)):
        place(b, lp(thump(48, 0.3), 300), k * 1.1, 0, 0.18)
        place(b, lp(thump(44, 0.3), 300), k * 1.1 + 0.28, 0, 0.12)
    return b


def amb_epave():
    b = bourdon(T, [50, 100, 150], 70, 0.3, 'sine') + wide(lambda s: lp(noise(T, 'brown', s), 400), 71) * 0.25
    semer(b, T, goutte, 2.5, 72, 0.12)
    semer(b, T, kenney_semes(['creak1', 'creak2', 'creak3'], (0.4, 0.6), 1500, 0.6), 5, 73, 0.22)
    semer(b, T, kenney_semes(['computerNoise_000', 'computerNoise_002', 'computerNoise_003'], (0.7, 0.9), 2500, 0.6), 7, 74, 0.08)
    semer(b, T, kenney_semes(['impactMetal_light_001', 'impactMetal_light_003'], (0.5, 0.7), 2000, 0.7), 4, 75, 0.1)
    return b


def amb_nid():
    b = bourdon(T, [41.2, 61.7, 82.4], 80, 0.35, 'saw')
    b += wide(lambda s: bp(noise(T, 'pink', s), 120, 500) * lfo(int(T * SR), 0.25, s, 0.5, 0.5), 81) * 0.3
    for k in range(int(T / 0.95)):
        place(b, lp(thump(52, 0.35), 260), k * 0.95, 0, 0.3)
        place(b, lp(thump(46, 0.35), 260), k * 0.95 + 0.25, 0, 0.2)
    semer(b, T, lambda s: squelch(0.6, s, 800, 120), 1.6, 82, 0.18)
    semer(b, T, kenney_semes(['slime_000', 'slime_001'], (0.4, 0.6), 1200, 0.6), 4, 83, 0.15)
    return b


def amb_front():
    b = vent(T, 90, 0.35, 200, 1200)
    semer(b, T, kenney_semes(['lowFrequency_explosion_000', 'lowFrequency_explosion_001', 'explosionCrunch_001', 'explosionCrunch_003'], (0.6, 0.85), 700, 0.7), 3.2, 91, 0.35)
    def rafale(seed):
        r = rng(seed)
        coups = [(lp(rate(src(f'laserSmall_00{int(r.integers(5))}'), r.uniform(0.7, 0.9)), 1800), j * r.uniform(0.09, 0.14), 1) for j in range(int(r.integers(3, 9)))]
        return rev(mix(*coups), 1.5, 0.6, seed)
    semer(b, T, rafale, 2.5, 92, 0.1)
    return b


def amb_pluie():
    n = int(T * SR)
    b = wide(lambda s: hp(noise(T, 'pink', s), 1200) * 0.4 + hp(noise(T, 'white', s + 3), 5000) * 0.15, 100)
    r = rng(101)
    for _ in range(int(T * 30)):
        place(b, goutte(int(r.integers(1e6))) * 0.5, r.uniform(0, T - 0.1), r.uniform(-1, 1), r.uniform(0.05, 0.2))
    return b


def amb_rail():
    """le roulement du monorail : moteur grave et le claquement régulier des joints du rail"""
    moteur = lp(loopfit(rate(src('spaceEngineLow_001'), 0.7), int(T * SR)), 700)
    b = stereo(moteur, np.roll(moteur, int(0.37 * SR))) * 0.5
    b += vent(T, 111, 0.25, 400, 2500)
    k = 0
    while k * 0.62 < T:
        place(b, lp(src(f'impactMetal_light_00{k % 5}'), 2500), k * 0.62, -0.2, 0.25)
        place(b, lp(src(f'impactMetal_light_00{(k + 2) % 5}'), 2500), k * 0.62 + 0.11, 0.2, 0.2)
        k += 1
    return b


A('port', amb_port, 0.5)
A('plaines', amb_plaines, 0.45)
A('foret', amb_foret, 0.5)
A('marais', amb_marais, 0.5)
A('plateaux', amb_plateaux, 0.42)
A('cimetiere', amb_cimetiere, 0.5)
A('eden', amb_eden, 0.5)
A('epave', amb_epave, 0.55)
A('nid', amb_nid, 0.55)
A('front', amb_front, 0.45)
A('pluie', amb_pluie, 0.4)
A('rail', amb_rail, 0.5)

# ------------------------------------------------------------------ les musiques
O = os.path.join(SRC, 'oga')
MUS = {
    # id : fichier, boucle (sans couture d'origine ou à mesurer), volume, rôle
    'titre': dict(f='ehlers/Alexander Ehlers - Great mission.mp3', boucle='mesure', vol=0.55),
    'explo': dict(f='exploration_theme.ogg', boucle='native', vol=0.6),
    'ville': dict(f='ehlers/Alexander Ehlers - Flags.mp3', boucle='mesure', vol=0.5),
    'sombre': dict(f='dark/sector.ogg', boucle='native', vol=0.6),
    'eden': dict(f='dark/urgent.ogg', boucle='native', vol=0.55),
    'epave': dict(f='dark/airy.ogg', boucle='native', vol=0.6),
    'nid': dict(f='dark/pulse.ogg', boucle='native', vol=0.6),
    'boss': dict(f='boss_junkala.wav', boucle='native', vol=0.5),
    'boss_rage': dict(f='ehlers/Alexander Ehlers - Doomed.mp3', boucle='mesure', vol=0.5),
    'victoire': dict(f='victory_cynic.wav', boucle=None, vol=0.55),
    'mort': dict(f='defeat.mp3', boucle=None, vol=0.5, garde=11.0),
}


def mesure_boucle(y):
    """une boucle dans une chanson : un début et une fin, séparés par des temps entiers, tels que ce qui suit l'un
    ressemble le plus à ce qui suit l'autre (on saute de la fin au début sans que ça s'entende)"""
    m = y.mean(axis=0)
    hop = 512
    tempo, beats = librosa.beat.beat_track(y=m, sr=SR, hop_length=hop, tightness=200)
    chroma = librosa.feature.chroma_cqt(y=m, sr=SR, hop_length=hop)
    mel = librosa.power_to_db(librosa.feature.melspectrogram(y=m, sr=SR, hop_length=hop, n_mels=48))
    mel = (mel - mel.mean()) / (mel.std() + 1e-6)
    feat = np.vstack([chroma * 3, mel])
    w = int(4 * SR / hop)
    dur = len(m) / SR
    bt = beats * hop / SR
    starts = [b for b in beats if 6 < b * hop / SR < dur * 0.35]
    ends = [b for b in beats if dur * 0.55 < b * hop / SR < dur - 8]
    best, bs, be = -1e9, None, None
    for s in starts:
        a = feat[:, s:s + w]
        for e in ends:
            if (e - s) * hop / SR < 40:
                continue
            b = feat[:, e:e + w]
            if b.shape[1] < w or a.shape[1] < w:
                continue
            c = np.sum(a * b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9)
            c += 0.02 * ((e - s) * hop / SR) / dur  # à ressemblance égale, la boucle la plus longue
            if c > best:
                best, bs, be = c, s, e
    return bs * hop / SR, be * hop / SR, float(best), float(np.atleast_1d(tempo)[0])


def loudnorm(path_in, path_out, target=-16):
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', path_in, '-af', f'loudnorm=I={target}:TP=-1.5:LRA=11', '-ar', str(SR), path_out], check=True)


# ------------------------------------------------------------------ construction
def main():
    args = sys.argv[1:]
    quoi = [a for a in args if a in ('sfx', 'amb', 'mus')] or ['sfx', 'amb', 'mus']
    ids = [a for a in args if a not in ('sfx', 'amb', 'mus')]
    man = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else {'sfx': {}, 'amb': {}, 'mus': {}}
    for d in ('sfx', 'amb', 'mus'):
        os.makedirs(os.path.join(OUT, d), exist_ok=True)
    if 'sfx' in quoi:
        for id, s in SFX.items():
            if ids and id not in ids:
                continue
            files = []
            for i in range(s['n']):
                x = norm(s['fn'](i))
                name = f'{id}_{i + 1}.mp3' if s['n'] > 1 else f'{id}.mp3'
                encode(x, os.path.join(OUT, 'sfx', name), 80)
                files.append(f'son/sfx/{name}')
            man['sfx'][id] = dict(f=files, vol=s['vol'], bus=s['bus'], voix=s['voix'], prio=s['prio'], var=s['var'], dist=s['dist'])
            print('✓ sfx', id, len(files))
    if 'amb' in quoi:
        for id, a in AMB.items():
            if ids and id not in ids:
                continue
            x = boucle(a['fn']())
            x = x / (np.max(np.abs(x)) + 1e-9) * 0.89
            encode(x, os.path.join(OUT, 'amb', f'{id}.mp3'), 64, stereo=True)
            man['amb'][id] = dict(f=f'son/amb/{id}.mp3', vol=a['vol'], fin=AMB_LEN)
            print('✓ amb', id)
    if 'mus' in quoi:
        for id, m in MUS.items():
            if ids and id not in ids:
                continue
            tmp = os.path.join(TMP, 'm.wav')
            loudnorm(os.path.join(O, m['f']), tmp)
            y, _ = librosa.load(tmp, sr=SR, mono=False)
            if y.ndim == 1:
                y = np.vstack([y, y])
            # silence de tête et de queue
            nz = np.where(np.max(np.abs(y), axis=0) > 10 ** (-50 / 20))[0]
            y = y[:, nz[0]: nz[-1] + 1]
            info = {}
            if m['boucle'] == 'native':
                info = dict(debut=0.0, fin=round(y.shape[1] / SR, 3))
            elif m['boucle'] == 'mesure':
                a, b, score, tempo = mesure_boucle(y)
                info = dict(debut=round(a, 3), fin=round(b, 3))
                y = y[:, : int((b + 3) * SR)]  # on garde 3 s après la fin, pour le fondu de boucle
                print(f'  boucle {id} : {a:.1f} → {b:.1f} s (ressemblance {score:.2f}, {tempo:.0f} bpm)')
            else:
                if m.get('garde'):
                    y = y[:, : int(m['garde'] * SR)]
                    k = int(2.0 * SR)
                    y[:, -k:] *= np.linspace(1, 0, k) ** 2
            encode(y, os.path.join(OUT, 'mus', f'{id}.mp3'), 96, stereo=True)
            man['mus'][id] = dict(f=f'son/mus/{id}.mp3', vol=m['vol'], **info)
            print('✓ mus', id, f'{y.shape[1] / SR:.0f} s')
    json.dump(man, open(MANIFEST, 'w'), indent=1, ensure_ascii=False)
    tot = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(OUT) for f in fs)
    print(f'{len(man["sfx"])} bruitages, {len(man["amb"])} ambiances, {len(man["mus"])} musiques — {tot / 1e6:.1f} Mo')


if __name__ == '__main__':
    main()
