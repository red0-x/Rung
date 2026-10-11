import numpy as np, wave
SR=44100; BEAT=0.42
def hz(n):
    names={'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11}
    o=int(n[-1]); k=names[n[:-1]]
    return 440*2**((k-9)/12+(o-4))
mel=[('A4',1),('C5',2),('D5',1),('E5',1.5),('F5',.5),('E5',1),('D5',2),('B4',1),('G4',1.5),('A4',.5),('B4',1),
     ('C5',2),('A4',1),('A4',1.5),('G#4',.5),('A4',1),('B4',2),('G#4',1),('E4',2),('A4',1),
     ('C5',2),('D5',1),('E5',1.5),('F5',.5),('E5',1),('D5',2),('B4',1),('G4',1.5),('A4',.5),('B4',1),
     ('C5',1.5),('B4',.5),('A4',1),('G#4',1.5),('F#4',.5),('G#4',1),('A4',3)]
chords=[['A2','E3','A3'],['C3','G3','C4'],['G2','D3','G3'],['E2','B2','E3'],['A2','E3','A3'],['E2','B2','G#3'],['E2','B2','G#3'],
        ['A2','E3','A3'],['C3','G3','C4'],['G2','D3','G3'],['E2','B2','E3'],['A2','E3','A3'],['E2','B2','G#3'],['A2','E3','A3']]
total=sum(d for _,d in mel)*BEAT+1.5
out=np.zeros(int(SR*total))
def epiano(f,dur,amp):
    n=int(SR*(dur+0.8)); t=np.arange(n)/SR
    env=np.exp(-t*2.2)*np.minimum(1,t/0.008)
    s=np.sin(2*np.pi*f*t)+0.35*np.sin(2*np.pi*2*f*t)*np.exp(-t*4)+0.12*np.sin(2*np.pi*3*f*t)*np.exp(-t*7)
    s*=0.5+0.5*np.cos(2*np.pi*5*t)*0.15+0.5  # light tremolo
    return amp*env*s
def add(sig,start):
    i=int(start*SR); e=min(len(out),i+len(sig)); out[i:e]+=sig[:e-i]
t=0
for n,d in mel: add(epiano(hz(n),d*BEAT,0.32),t); t+=d*BEAT
# pad chords, one per bar of 3 beats after the 1-beat pickup
for b,ch in enumerate(chords):
    st=BEAT*(1+3*b); dur=3*BEAT; n=int(SR*(dur+0.3)); tt=np.arange(n)/SR
    env=np.minimum(1,tt/0.15)*np.minimum(1,np.maximum(0,(dur+0.3-tt)/0.3))
    for f in ch:
        add(0.07*env*(np.sin(2*np.pi*hz(f)*tt)+0.3*np.sin(2*np.pi*2*hz(f)*tt)),st)
out/=np.max(np.abs(out))*1.05
with wave.open('music_raw.wav','w') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out*32767).astype(np.int16).tobytes())
print(total)
