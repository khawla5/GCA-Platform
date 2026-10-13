const SVG_NS = "http://www.w3.org/2000/svg";
const STROKE = 2;
const PHOTO_RADIUS = 24;
const DIAG_BOTTOM = 0.63;

type Pt = [number, number];

function lineX(a: Pt, b: Pt, y: number): number {
  return a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]);
}

export function initLoginFrame(): void {
  const card = document.querySelector<HTMLElement>(".login-card");
  const photo = card?.querySelector<HTMLElement>(".login-left");
  if (!card || !photo) return;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("login-frame");
  const path = document.createElementNS(SVG_NS, "path");
  svg.appendChild(path);
  card.appendChild(svg);

  const draw = (): void => {
    const cw = card.clientWidth;
    const ch = card.clientHeight;
    const w = photo.offsetWidth;
    const h = photo.offsetHeight;
    if (!cw || !ch || !w || !h || w > cw * 0.9 || h > ch) {
      path.setAttribute("d", "");
      return;
    }
    svg.setAttribute("viewBox", `0 0 ${cw} ${ch}`);
    const x0 = photo.offsetLeft;
    const y0 = photo.offsetTop;
    const d = STROKE / 2;
    const r = PHOTO_RADIUS + d;

    const A: Pt = [x0 + w, y0];
    const B: Pt = [x0 + DIAG_BOTTOM * w, y0 + h];
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const nx = (B[1] - A[1]) / len;
    const ny = -(B[0] - A[0]) / len;
    const Q: Pt = [A[0] + nx * d, A[1] + ny * d];
    const Q2: Pt = [B[0] + nx * d, B[1] + ny * d];
    const v: Pt = [(Q2[0] - Q[0]) / len, (Q2[1] - Q[1]) / len];

    const cx = x0 + w - PHOTO_RADIUS;
    const cy = y0 + PHOTO_RADIUS;
    const qx = Q[0] - cx;
    const qy = Q[1] - cy;
    const b = v[0] * qx + v[1] * qy;
    const disc = b * b - (qx * qx + qy * qy - r * r);
    const t = disc >= 0 ? -b - Math.sqrt(disc) : 0;
    const P: Pt = [Q[0] + v[0] * t, Q[1] + v[1] * t];

    const bottom = y0 + h + d;
    const bx = lineX(Q, Q2, bottom);
    const f = (n: number) => n.toFixed(2);
    const arc = (x: number, y: number) => `A${r},${r} 0 0 1 ${f(x)},${f(y)}`;

    path.setAttribute(
      "d",
      `M${f(x0 - d)},${f(y0 + PHOTO_RADIUS)} ${arc(x0 + PHOTO_RADIUS, y0 - d)} L${f(cx)},${f(y0 - d)} ${arc(P[0], P[1])} L${f(bx)},${f(bottom)} L${f(x0 + PHOTO_RADIUS)},${f(bottom)} ${arc(x0 - d, y0 + h - PHOTO_RADIUS)} Z`,
    );
  };

  new ResizeObserver(draw).observe(card);
  new ResizeObserver(draw).observe(photo);
  window.addEventListener("resize", draw);
  draw();
}
