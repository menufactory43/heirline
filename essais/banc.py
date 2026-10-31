#!/usr/bin/env python3
"""Banc de charge : pour chaque techno et chaque nombre de clients, CPU/mémoire du serveur, tick, bande passante, confirmation.
Usage : python3 banc.py [secondes] [backends...]"""
import json, os, subprocess, sys, threading, time, urllib.request, statistics
SEC = int(sys.argv[1]) if len(sys.argv) > 1 else 20
BACKENDS = sys.argv[2:] or ['colyseus', 'stdbq', 'stdb']
CLIENT = os.path.expanduser('~/heirline/essais/client')
SPACETIME = os.path.expanduser('~/.local/bin/spacetime')

def pid_on(port):
    return int(subprocess.check_output(['lsof', '-tiTCP:%d' % port, '-sTCP:LISTEN']).split()[0])

def sampler(pid, out, stop):
    while not stop.is_set():
        try:
            cpu, rss = subprocess.check_output(['ps', '-o', '%cpu=,rss=', '-p', str(pid)]).split()
            out.append((float(cpu), int(rss) / 1024))
        except Exception: pass
        time.sleep(1)

def tick_reset(b):
    if b == 'colyseus': urllib.request.urlopen('http://127.0.0.1:3567').read()
    else: subprocess.run([SPACETIME, 'call', 'heirline-essai', 'reset_stats', '--server', 'local'], capture_output=True)

def tick_read(b):
    if b == 'colyseus':
        d = json.loads(urllib.request.urlopen('http://127.0.0.1:3567').read()); return round(d['mean'], 1), round(d['sd'], 2), round(d['max'], 1)
    out = subprocess.run([SPACETIME, 'sql', 'heirline-essai', 'SELECT n, sum, sum_sq, max FROM tick_stat', '--server', 'local'], capture_output=True, text=True).stdout
    row = [l for l in out.splitlines() if l.strip() and l.strip()[0].isdigit()][0].split('|')
    n, s, ss, mx = int(row[0]), float(row[1]), float(row[2]), float(row[3])
    m = s / max(n, 1); return round(m, 1), round(max(ss / max(n, 1) - m * m, 0) ** 0.5, 2), round(mx, 1)

def run(b, n):
    pid = pid_on(2567 if b == 'colyseus' else 3000)
    procs = []
    per = [n] if n <= 50 else [50] * (n // 50)
    for k in per:
        if os.environ.get('NUC'):  # bots sur le NUC, pour laisser le Mac au serveur seul
            cmd = ['ssh', 'nuc', f'cd heirline-essais/client && PATH=$HOME/.local/bin:$PATH BOT_HOST=127.0.0.1 npx tsx bots.ts {b} {k} {SEC}']
        else:
            cmd = ['npx', 'tsx', 'bots.ts', b, str(k), str(SEC)]
        procs.append(subprocess.Popen(cmd, cwd=CLIENT, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True))
    time.sleep(3 + n * 0.03)  # le temps que tout le monde se connecte
    tick_reset(b)
    samples, stop = [], threading.Event()
    th = threading.Thread(target=sampler, args=(pid, samples, stop)); th.start()
    res = [json.loads(p.communicate()[0].strip().splitlines()[-1]) for p in procs]
    stop.set(); th.join()
    tick = tick_read(b)
    sm = samples[2:] or samples
    cpu = statistics.mean(s[0] for s in sm); mem = max(s[1] for s in sm)
    avg = lambda f: round(statistics.mean(f(r) for r in res), 2)
    return {
        'techno': b, 'clients': n, 'cpu_%': round(cpu), 'mem_Mo': round(mem),
        'tick_moy_ms': tick[0], 'tick_ecart_ms': tick[1], 'tick_max_ms': tick[2],
        'montant_ko_s': avg(lambda r: r['montant_ko_s_par_client']), 'descendant_ko_s': avg(lambda r: r['descendant_ko_s_par_client']),
        'confirmation_p50_ms': avg(lambda r: r['confirmation_ms']['p50']), 'confirmation_p95_ms': avg(lambda r: r['confirmation_ms']['p95']),
        'maj_ecart_ms': avg(lambda r: r['ecart_entre_mises_a_jour_ms']['ecart']), 'maj_p95_ms': avg(lambda r: r['ecart_entre_mises_a_jour_ms']['p95']),
    }

rows = []
for b in BACKENDS:
    for n in (1, 50, 100):
        r = run(b, n); rows.append(r); print(json.dumps(r), flush=True)
        time.sleep(4)
json.dump(rows, open(os.path.expanduser('~/heirline/essais/banc%s.json' % ('-nuc' if os.environ.get('NUC') else '')), 'w'), indent=1)
