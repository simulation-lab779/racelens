import { progressAt } from './engine.mjs';
import { runnerLabel } from './catalog.mjs';

export const FRAME_COLORS = ['','#f1efe5','#333b37','#d55648','#4d79b8','#ddbd4a','#40916b','#e28e43','#d38ea7'];
export class RaceTrack {
  constructor(canvas, onTick, onFinish) {
    this.canvas=canvas; this.ctx=canvas.getContext('2d');
    this.onTick=onTick; this.onFinish=onFinish;
    this.seconds=0; this.running=false; this.speed=1; this.frame=0;
    this.race=null; this.runners=[]; this.selected=null;
    this.resizeObserver=new ResizeObserver(()=>this.draw());
    this.resizeObserver.observe(canvas);
  }

  load(race,runners,selected) {
    this.pause(); this.race=race; this.runners=runners; this.selected=selected;
    this.seconds=0; this.done=false; this.draw(); this.report();
  }

  play() {
    if(!this.runners.length || this.running)return;
    if(this.done){this.seconds=0;this.done=false;}
    this.running=true;this.last=performance.now();
    const tick=now=>{
      if(!this.running)return;
      // Approximately 15 seconds for a 2000m race at 1x; slower closing stages.
      const leaderTime=Math.min(...this.runners.map(h=>h.time));
      const clockRate=this.seconds>leaderTime*0.85?5:10;
      this.seconds+=Math.min((now-this.last)/1000,0.1)*clockRate*this.speed;
      this.last=now;
      const finish=Math.max(...this.runners.map(h=>h.time));
      if(this.seconds>=finish){this.seconds=finish;this.running=false;this.done=true;}
      this.draw();this.report();
      if(this.running)this.frame=requestAnimationFrame(tick);
      else this.onFinish(this.runners);
    };
    this.frame=requestAnimationFrame(tick);
  }

  pause(){this.running=false;cancelAnimationFrame(this.frame);}
  seek(fraction) {
    this.pause();
    this.seconds=Math.max(...this.runners.map(h=>h.time))*fraction;
    this.done=fraction>=1;this.draw();this.report();
    if(this.done)this.onFinish(this.runners);
  }
  report() {
    if(!this.runners.length)return;
    const order=this.runners.slice().sort((a,b)=>progressAt(b,this.seconds)-progressAt(a,this.seconds)||a.rank-b.rank);
    this.onTick({seconds:this.seconds,progress:this.seconds/Math.max(...this.runners.map(h=>h.time)),order,running:this.running});
  }

  draw() {
    if(!this.race)return;
    const dpr=Math.min(window.devicePixelRatio||1,2),rect=this.canvas.getBoundingClientRect();
    this.canvas.width=Math.max(1,rect.width*dpr);this.canvas.height=Math.max(1,rect.height*dpr);
    const c=this.ctx;c.setTransform(this.canvas.width/1000,0,0,this.canvas.height/510,0,0);
    c.clearRect(0,0,1000,510);
    c.fillStyle='#163e31';c.fillRect(0,0,1000,510);
    // Grass stripes, original vector stadium, and an abstract one-lap course.
    for(let x=-500;x<1400;x+=100){c.fillStyle='#ffffff02';c.beginPath();c.moveTo(x,0);c.lineTo(x+75,0);c.lineTo(x+575,510);c.lineTo(x+500,510);c.fill();}
    c.save();c.translate(500,246);
    const ellipse=(rx,ry)=>{c.beginPath();c.ellipse(0,0,rx,ry,0,0,Math.PI*2);};
    ellipse(439,183);c.fillStyle='#4b6d49';c.fill();
    for(let i=0;i<5;i++){ellipse(430-i*10,174-i*9);c.strokeStyle=i===0?'#e2dfbd':'#a4b88b45';c.lineWidth=i===0?3:1;c.stroke();}
    ellipse(381,129);c.fillStyle='#1d4d3a';c.fill();c.strokeStyle='#dfdec4';c.lineWidth=2;c.stroke();
    c.textAlign='center';c.fillStyle='#73977c';c.font='11px sans-serif';c.fillText('R A C E L E N S   R E P L A Y',0,-33);
    c.fillStyle='#eef0db';c.font='bold 31px sans-serif';c.fillText(this.race.name,0,14);
    c.fillStyle='#9eb89b';c.font='13px sans-serif';c.fillText(`${this.race.venue}  ${this.race.surface} ${this.race.distance.toLocaleString()}m  /  ${this.race.horses.length}頭`,0,44);
    c.fillStyle='#c7cfae';c.font='10px sans-serif';c.fillText('SIMULATED RACE · 実際のレース映像ではありません',0,76);
    // Finish line at the bottom of the schematic oval.
    for(let x=-7;x<7;x+=7)for(let y=131;y<185;y+=7){c.fillStyle=((x+7)/7+(y-131)/7)%2?'#f9f6db':'#26382b';c.fillRect(x,y,7,7);}
    c.fillStyle='#e8e5ca';c.font='bold 10px sans-serif';c.fillText('FINISH',0,204);
    const dir=this.race.direction==='left'?-1:1;
    for(const h of this.runners.slice().sort((a,b)=>Number(a.number===this.selected)-Number(b.number===this.selected))){
      const p=progressAt(h,this.seconds);
      const lane=(h.number-1)%5;
      const spread=(h.number-1)*0.004*Math.max(0,1-this.seconds/10);
      const angle=Math.PI/2+dir*(p-spread)*Math.PI*2;
      const x=(397+lane*8)*Math.cos(angle),y=(143+lane*7)*Math.sin(angle);
      c.save();c.translate(x,y);
      if(h.number===this.selected){c.beginPath();c.arc(0,0,17,0,Math.PI*2);c.fillStyle='#f0c76c40';c.fill();c.strokeStyle='#f0c76c';c.lineWidth=2;c.stroke();}
      c.fillStyle='#101c1980';c.beginPath();c.ellipse(2,5,12,7,0,0,Math.PI*2);c.fill();
      c.fillStyle=FRAME_COLORS[h.frame]||'#647e73';c.strokeStyle='#ffffff75';c.lineWidth=1;
      const halfWidth=this.race.numberStatus==='temporary'?15:10;
      c.beginPath();c.roundRect(-halfWidth,-11,halfWidth*2,20,5);c.fill();c.stroke();
      c.fillStyle=h.frame===1||h.frame===5?'#28362b':'#fff';c.font=`bold ${this.race.numberStatus==='temporary'?9:11}px sans-serif`;c.fillText(runnerLabel(this.race,h.number),0,3);
      if(h.number===this.selected){c.font='bold 12px sans-serif';c.lineWidth=4;c.strokeStyle='#173d31';c.strokeText(h.name,0,-23);c.fillStyle='#f8e3a2';c.fillText(h.name,0,-23);}
      c.restore();
    }
    c.restore();
    c.fillStyle='#aac09d';c.textAlign='left';c.font='10px sans-serif';c.fillText('コース模式図 / 距離・コーナー形状は実コースを再現していません',26,29);
    c.textAlign='right';c.fillText(this.race.direction==='left'?'← LEFT-HANDED':'RIGHT-HANDED →',974,29);
    const leading=this.runners.slice().sort((a,b)=>progressAt(b,this.seconds)-progressAt(a,this.seconds)||a.rank-b.rank)[0];
    const remaining=Math.max(0,Math.round((1-progressAt(leading,this.seconds))*this.race.distance));
    c.textAlign='left';c.fillStyle='#d4ddbd';c.font='12px sans-serif';c.fillText(this.seconds===0?'READY TO RACE':this.done?'FINISHED':remaining<=600?'FINAL STRETCH':'RACE IN PROGRESS',28,477);
    c.textAlign='right';c.font='bold 22px sans-serif';c.fillStyle='#f1ead1';c.fillText(`残り ${remaining.toLocaleString()}m`,972,478);
  }
}
