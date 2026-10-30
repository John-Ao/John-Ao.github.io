// Lowest-order quadrupole inspiral, artificial Hermite bridge, fitted 220 QNM.
// All observer times are seconds; input masses are detector-frame solar masses.
export const T_SUN = 4.92549095e-6;
export const R_SUN = 1476.62504;
const MPC = 3.085677581491367e22;
const X0 = 20, XC = 6;

export function buildModel(M, q, spin) {
  if (!(Number.isFinite(M) && M > 0 && Number.isFinite(q) && q >= 1 &&
        Number.isFinite(spin) && spin >= 0 && spin < .999)) {
    throw new RangeError("Expected M > 0, q >= 1, and 0 <= spin < 0.999.");
  }
  const eta=q/(1+q)**2, tm=M*T_SUN, duration=(X0**4-XC**4)*5/(256*eta)*tm;
  const bridge=12*tm, mf=.95*M;
  const fq=(1.5251-1.1568*(1-spin)**.1292)/(2*Math.PI*mf*T_SUN);
  const Q=.7000+1.4187*(1-spin)**(-.4990), damp=Q/(Math.PI*fq);
  const fcut=XC**(-1.5)/(Math.PI*tm), phasecut=(X0**2.5-XC**2.5)/(16*eta);
  const amplitude=4*eta*M*R_SUN/(400*MPC)*1e21;
  const ac=amplitude/XC, ap=1.8*ac;
  const dc=ac*64*eta/(5*XC**4*tm), dp=-ap/damp;
  const dxcut=-64*eta/(5*XC**3*tm);
  return {M,q,spin,eta,tm,duration,bridge,mf,fq,Q,damp,fcut,phasecut,amplitude,ac,ap,dc,dp,dxcut,
    m1:M*q/(1+q),m2:M/(1+q),chirpMass:M*eta**.6,
    merger:duration+bridge,total:duration+bridge+8*damp};
}

export function sample(t, m) {
  if (!Number.isFinite(t)) throw new RangeError("Time must be finite.");
  t=Math.max(0,t);
  if(t<=m.duration) {
    const x=Math.max(XC,(X0**4-256*m.eta/5*t/m.tm)**.25);
    const phase=(X0**2.5-x**2.5)/(16*m.eta), a=m.amplitude/x;
    return {x,phase,f:x**(-1.5)/(Math.PI*m.tm),a,h:a*Math.cos(phase),stage:"inspiral"};
  }
  if(t<m.merger) {
    const u=(t-m.duration)/m.bridge,s=3*u*u-2*u*u*u;
    const f=m.fcut+(m.fq-m.fcut)*s;
    const phase=m.phasecut+2*Math.PI*(m.fcut*(t-m.duration)+(m.fq-m.fcut)*m.bridge*(u**3-.5*u**4));
    const a=(2*u**3-3*u*u+1)*m.ac+(u**3-2*u*u+u)*m.bridge*m.dc
      +(-2*u**3+3*u*u)*m.ap+(u**3-u*u)*m.bridge*m.dp;
    const x=XC*(1-s)+(u**3-2*u*u+u)*m.bridge*m.dxcut;
    return {x,phase,f,a,h:a*Math.cos(phase),stage:"merger"};
  }
  const elapsed=t-m.merger;
  const phase=m.phasecut+Math.PI*(m.fcut+m.fq)*m.bridge+2*Math.PI*m.fq*elapsed;
  const a=m.ap*Math.exp(-elapsed/m.damp);
  return {x:0,phase,f:m.fq,a,h:a*Math.cos(phase),stage:"ringdown"};
}
