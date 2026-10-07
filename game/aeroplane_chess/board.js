// Geometry reconstructed from the Wikimedia Fei xing qi board reference.
// Clockwise seats: red (SE), blue (SW), yellow (NW), green (NE).
export const rotate=([x,y],p)=>{for(let i=0;i<p;i++)[x,y]=[19-y,x];return [x,y];};
const quarter=[[17,11.5],[16.55,12.55],[15.5,13],[14.5,13],[13.5,12.65],[12.65,13.5],[13,14.5],[13,15.5],[12.55,16.55],[11.5,17],[10.5,17],[9.5,17],[8.5,17]];
export const RING=Array.from({length:4},(_,p)=>quarter.map(c=>rotate(c,p))).flat();
export const airport=(p,i)=>rotate([15+i%2*2,15+Math.floor(i/2)*2],p);
export const point=(p,pos,i=0)=>pos<0?airport(p,i):pos===0?rotate([17.35,13.35],p):pos<=50?RING[(p*13+pos)%52]:rotate([66.5-pos,9.5],p);
// Two split quarter-circle cells at each inner bend; triangular outer corners.
export const TILE_PATHS=[
'M16 11H18V12H16Z','M16 12H18L16 14Z','M15 12H16V14H15Z','M14 12H15V14H14Z',
'M14 14L12.5858 12.5858A2 2 0 0 1 14 12Z','M14 14H12A2 2 0 0 1 12.5858 12.5858Z',
'M12 14H14V15H12Z','M12 15H14V16H12Z','M12 16H14L12 18Z',
'M11 16H12V18H11Z','M10 16H11V18H10Z','M9 16H10V18H9Z','M8 16H9V18H8Z'];
