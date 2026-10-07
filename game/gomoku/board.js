/* Canvas rendering, independent of game rules and search. */
function createBoardView(canvas, drawAnalysis) {
const ctx = canvas.getContext("2d");
const { SIZE, COLS } = Gomoku;
let W=0, pad=0, cell=0, moves=[], winLine=null;
        function draw() {
            ctx.fillStyle = "#e6b873";
            ctx.fillRect(0, 0, W, W);

            // grid
            ctx.strokeStyle = "#5b4632";
            ctx.lineWidth = 1;
            for (let i = 0; i < SIZE; i++) {
                ctx.beginPath();
                ctx.moveTo(pad, pad + i * cell);
                ctx.lineTo(pad + (SIZE - 1) * cell, pad + i * cell);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(pad + i * cell, pad);
                ctx.lineTo(pad + i * cell, pad + (SIZE - 1) * cell);
                ctx.stroke();
            }

            // star points
            ctx.fillStyle = "#5b4632";
            [[3, 3], [3, 11], [11, 3], [11, 11], [7, 7]].forEach(([x, y]) => {
                ctx.beginPath();
                ctx.arc(pad + x * cell, pad + y * cell, Math.max(2, cell * 0.07), 0, 2 * Math.PI);
                ctx.fill();
            });

            // labels
            ctx.fillStyle = "#6b5640";
            ctx.font = Math.max(9, cell * 0.34) + "px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            for (let i = 0; i < SIZE; i++) {
                ctx.fillText(COLS[i], pad + i * cell, pad / 2);
                ctx.fillText(COLS[i], pad + i * cell, W - pad / 2);
                ctx.fillText(i + 1, pad / 2, pad + i * cell);
                ctx.fillText(i + 1, W - pad / 2, pad + i * cell);
            }

            drawAnalysis(ctx, pad, cell);

            // pieces
            const r = cell * 0.44;

            moves.forEach((m, i) => {
                const x = pad + m.col * cell, y = pad + m.row * cell;
                const isLast = i === moves.length - 1;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, 2 * Math.PI);
                ctx.fillStyle = m.color === "black" ? "#000" : "#fff";
                ctx.fill();
                ctx.lineWidth = isLast ? 3 : 1.5;
                ctx.strokeStyle = isLast ? "#06c8d4" : "#000";
                ctx.stroke();
                ctx.fillStyle = m.color === "black" ? "#fff" : "#000";
                ctx.font = Math.max(8, cell * 0.32) + "px sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(i + 1, x, y);
            });

            // 胜利连线：顶层绿色胶囊框圈住5子
            if (winLine && winLine.length >= 5) {
                const a = winLine[0], b = winLine[winLine.length - 1];
                const x1 = pad + a.col * cell, y1 = pad + a.row * cell;
                const x2 = pad + b.col * cell, y2 = pad + b.row * cell;
                const radius = r + Math.max(3, cell * 0.12); // 半圆半径，略大于棋子
                // 沿首->尾方向构造胶囊：两个端点圆 + 中间矩形
                const dx = x2 - x1, dy = y2 - y1;
                const len = Math.hypot(dx, dy) || 1;
                const nx = -dy / len, ny = dx / len; // 法向单位向量

                ctx.beginPath();
                // 矩形四角
                ctx.moveTo(x1 + nx * radius, y1 + ny * radius);
                ctx.lineTo(x2 + nx * radius, y2 + ny * radius);
                // b 端半圆（在 b 外侧，沿逆时针从 n 到 -n）
                ctx.arc(x2, y2, radius, Math.atan2(ny, nx), Math.atan2(-ny, -nx), true);
                ctx.lineTo(x1 - nx * radius, y1 - ny * radius);
                // a 端半圆（在 a 外侧，沿逆时针从 -n 到 n）
                ctx.arc(x1, y1, radius, Math.atan2(-ny, -nx), Math.atan2(ny, nx), true);
                ctx.closePath();
                ctx.strokeStyle = "#39ff14";
                ctx.lineWidth = Math.max(3, cell * 0.1);
                ctx.stroke();
            }


        }


return {
 render(state) { moves=state.moves; winLine=state.winLine; draw(); },
 resize() {
 W=Math.floor(Math.max(220,Math.min(document.getElementById('wrap').clientWidth,window.innerHeight-50,760)));
 pad=Math.round(W*.045); cell=(W-pad*2)/(SIZE-1);
 const dpr=window.devicePixelRatio||1;
 canvas.width=W*dpr; canvas.height=W*dpr;
 canvas.style.width=W+'px'; canvas.style.height=W+'px';
 ctx.setTransform(dpr,0,0,dpr,0,0); draw();
 },
 point(event) { const rect=canvas.getBoundingClientRect(); return {col:Math.round(((event.clientX-rect.left)*W/rect.width-pad)/cell),row:Math.round(((event.clientY-rect.top)*W/rect.height-pad)/cell)}; }
};
}
