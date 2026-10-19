"""Original full-length loops, with periodic note tails and room reflections."""
import json, math, random, struct, wave, hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent
RATE=24000
TAU=math.tau
rng=random.Random(195)

def add(buf,start,dur,midi,gain,voice):
 f=440*2**((midi-69)/12); n=round(dur*RATE); offset=round(start*RATE)
 # A filtered noise delay loop supplies a plucked-string excitation, rather than a plain sine.
 if voice in ('uke','harp'):
  length=max(2,round(RATE/f)); line=[rng.uniform(-1,1) for _ in range(length)]; at=0
 for i in range(n):
  t=i/RATE; u=t/dur; phase=TAU*f*t
  if voice in ('uke','harp'):
   value=line[at]; nxt=line[(at+1)%len(line)]
   line[at]=(value+nxt)*(.496 if voice=='uke' else .499)
   at=(at+1)%len(line)
   attack=min(1,t/.003)
   # A quiet fundamental gives low-velocity strings a stable body.
   tone=value*.8+math.sin(phase)*.18*math.exp(-t/(.22 if voice=='uke' else .65))
   env=attack*(1-u)**2
  elif voice=='reed':
   env=math.sin(min(1,t/.055)*math.pi/2)**2*(1-u)**1.4
   phase+=.035*math.sin(TAU*4.6*t)*min(1,t/.25)
   tone=(math.sin(phase)+.19*math.sin(3*phase)+.04*math.sin(5*phase))/1.23
  elif voice=='glass':
   env=(1-math.exp(-t/.006))*(1-u)**2
   tone=sum(a*math.sin(phase*r)*math.exp(-t/dec) for r,a,dec in [(1,1,1.1),(2.756,.24,.48),(5.404,.08,.22)])/1.32
  else:
   env=min(1,t/.035)*(1-u)**2
   tone=math.sin(phase)*math.exp(-t/.6)
  idx=offset+i
  if idx>=0:buf[idx % len(buf)]+=gain*env*tone

def render(name,bpm,bars,events,echo):
 rng.seed(195)
 buf=[0.] * round(bars*4*60/bpm*RATE)
 stems={voice:[0.]*len(buf) for voice in set(e[-1] for e in events)}
 for event in events:add(stems[event[-1]],*event)
 for stem in stems.values():
  for i,x in enumerate(stem):buf[i]+=x
 dry=buf[:]
 for delay,gain in echo:
  lag=round(delay*RATE)
  for i in range(len(buf)):buf[i]+=gain*dry[(i-lag)%len(buf)]
 mean=sum(buf)/len(buf);peak=max(abs(x-mean) for x in buf)
 rms=math.sqrt(sum((x-mean)**2 for x in buf)/len(buf))
 gain=min(.09/rms,.60/peak)
 pcm=[round((x-mean)*gain*32767) for x in buf]
 assert all(-32768<x<32767 for x in pcm)
 path=ROOT/(name+'.wav')
 payload=struct.pack('<'+'h'*len(pcm),*pcm)
 with wave.open(str(path),'wb') as w:
  w.setparams((1,2,RATE,0,'NONE','not compressed'));w.writeframes(payload)
 with wave.open(str(path),'rb') as w:
  assert (w.getnchannels(),w.getsampwidth(),w.getframerate(),w.getnframes())==(1,2,RATE,len(pcm))
  assert w.readframes(len(pcm))==payload
 derivatives=[abs(pcm[i]-pcm[i-1])/32768 for i in range(len(pcm))]
 seam=abs(pcm[0]-pcm[-1])/32768
 report=dict(file=path.name,bpm=bpm,bars=bars,seconds=len(pcm)/RATE,
  peak=max(map(abs,pcm))/32768,rms=math.sqrt(sum(x*x for x in pcm)/len(pcm))/32768,
  dc=sum(pcm)/len(pcm)/32768,seamDelta=seam,maxDerivative=max(derivatives),
  seamNeighbourhoodMaxDerivative=max(derivatives[:240]+derivatives[-240:]),
  dryStemRms={v:math.sqrt(sum(x*x for x in stem)/len(stem))*gain for v,stem in stems.items()},
  sha256=hashlib.sha256(path.read_bytes()).hexdigest())
 assert seam<.01 and abs(report['dc'])<.001
 (ROOT/(name+'-score.json')).write_text(json.dumps(dict(bpm=bpm,bars=bars,eventFormat=['seconds','durationSeconds','midi','gain','voice'],events=events,echo=echo),indent=2)+'\n')
 return report

def woodland():
 bpm=82;spb=60/bpm;events=[]
 chords=[[67,71,74,79],[67,72,76,79],[67,71,76,79],[69,74,78,81],[67,71,74,79],[67,71,76,79],[69,72,76,81],[69,74,78,81]]
 bass=[43,36,40,38,35,40,33,38]
 phrases=[
 [[67,71,74],[72,71,67],[64,67,71],[69,66,62],[71,74,79],[76,74,71],[72,69,67],[66,69,62]],
 [[74,79,78],[76,79,76],[71,74,76],[78,76,74],[79,74,71],[76,71,67],[72,76,74],[69,66,62]],
 [[71,74,71],[72,71,67],[67,71,69],[66,69,74],[74,71,67],[71,67,64],[69,67,64],[66,64,62]]]
 for bar in range(24):
  chord=chords[bar%8];melody=phrases[bar//8][bar%8]
  events.append((bar*4*spb,2.6*spb,bass[bar%8],.062,'bass'))
  # Quiet strums underneath; picked replies only in the reed's phrase gaps.
  strokes=[(0,False,.042),(1.5,True,.026),(2,False,.032)] if bar%2==0 else [(0,False,.036),(2.5,True,.025)]
  for beat,up,level in strokes:
   for j,key in enumerate(reversed(chord) if up else chord):events.append(((bar*4+beat)*spb+j*.014,.75,key,level,'uke'))
  for j,key in enumerate(melody):events.append(((bar*4+[.4,1.5,2.6][j])*spb,[.82,.72,.98][j]*spb,key,[.17,.15,.155][j],'reed'))
  if bar%4==3:
   for j,key in enumerate(chord[-2:]):events.append(((bar*4+3.65)*spb+j*.10,.6,key,.046,'uke'))
 return render('woodland-journey-clarinet-ukulele-v2',bpm,24,events,[(.11,.07),(.23,.04)])

def palace():
 bpm=68;spb=60/bpm;events=[]
 chords=[[62,66,69,76],[59,62,66,73],[55,62,67,71],[57,62,64,69],[62,66,69,73],[59,66,69,74],[55,62,66,71],[57,61,64,69]]
 melody=[[78,81],[76,85],[79,83],[81,76],[86,85],[83,78],[79,76],[76,73],
 [81,86],[85,88],[83,86],[88,85],[86,81],[83,78],[79,76],[76,73]]
 for bar in range(16):
  chord=chords[bar%8]
  events.append((bar*4*spb,3.2*spb,chord[0]-12,.065,'bass'))
  for j,key in enumerate(chord):events.append(((bar*4+.28+j*.46)*spb,2.3,key,.22-j*.018,'harp'))
  for j,key in enumerate(melody[bar]):events.append(((bar*4+[.8,2.6][j])*spb,2.5,key,.14 if j==0 else .105,'glass'))
  if bar%4==3:
   for j,key in enumerate(reversed(chord)):events.append(((bar*4+3.0)*spb+j*.08,1.8,key+12,.085,'harp'))
 return render('crystal-palace-harp-glass-v2',bpm,16,events,[(.29,.18),(.53,.11),(.79,.065),(1.13,.035)])

if __name__=='__main__':
 reports=[woodland(),palace()]
 (ROOT/'measurements.json').write_text(json.dumps(reports,indent=2)+'\n')
 print(json.dumps(reports,indent=2))
