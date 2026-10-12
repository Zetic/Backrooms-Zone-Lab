import { buildMesh, sceneBounds, cameraBasis, cameraMatrix } from './mesh.js';

const vertexSource = `
attribute vec3 a_position; attribute vec3 a_normal; attribute vec3 a_color; attribute vec3 a_pick;
uniform mat4 u_matrix; varying vec3 v_color; varying vec3 v_normal; varying vec3 v_pick;
void main(){ gl_Position=u_matrix*vec4(a_position,1.0); v_color=a_color; v_normal=a_normal; v_pick=a_pick; }`;
const fragmentSource = `
precision mediump float; uniform bool u_picking; varying vec3 v_color; varying vec3 v_normal; varying vec3 v_pick;
void main(){ if(u_picking){gl_FragColor=vec4(v_pick,1.0);}else{ float light=length(v_normal)<0.1?1.0:0.65+0.35*abs(dot(normalize(v_normal),normalize(vec3(0.4,-0.5,0.9)))); gl_FragColor=vec4(v_color*light,1.0); } }`;

export class Viewer3D {
  constructor(canvas, onSelect) {
    this.canvas = canvas; this.onSelect = onSelect;
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    if (!gl) throw new Error('WebGL is unavailable. Floor plans and canonical export remain usable.');
    this.gl = gl;
    const shader = (type, source) => { const result = gl.createShader(type); gl.shaderSource(result, source); gl.compileShader(result); if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(result)); return result; };
    this.program = gl.createProgram();
    const vs = shader(gl.VERTEX_SHADER, vertexSource), fs = shader(gl.FRAGMENT_SHADER, fragmentSource);
    gl.attachShader(this.program, vs); gl.attachShader(this.program, fs); gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
    gl.deleteShader(vs); gl.deleteShader(fs);
    this.buffer = gl.createBuffer(); this.lineBuffer = gl.createBuffer();
    this.pickingFramebuffer = gl.createFramebuffer(); this.pickingTexture = gl.createTexture(); this.pickingDepth = gl.createRenderbuffer();
    this.camera = { yaw: -.8, pitch: .8, target: [8.5, 7, 3], extent: 15, zoom: 1 };
    this.pending = false;
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(canvas);
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    canvas.addEventListener('pointerdown', event => { if (!this.plan) return; this.drag = { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, pan: event.shiftKey || event.button === 2 }; canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener('pointermove', event => {
      if (!this.drag) return;
      const dx = event.clientX - this.drag.x, dy = event.clientY - this.drag.y;
      if (this.drag.pan) {
        const { right, up } = cameraBasis(this.camera.yaw, this.camera.pitch), scale = this.camera.extent / this.camera.zoom * 2 / canvas.clientHeight;
        this.camera.target = this.camera.target.map((v, i) => v - right[i] * dx * scale + up[i] * dy * scale);
      } else { this.camera.yaw -= dx * .006; this.camera.pitch = Math.max(.1, Math.min(1.5, this.camera.pitch + dy * .006)); }
      this.drag.x = event.clientX; this.drag.y = event.clientY; this.invalidate();
    });
    canvas.addEventListener('pointerup', event => { const drag = this.drag; this.drag = null; if (drag && !drag.pan && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 4) this.pick(event); });
    canvas.addEventListener('pointercancel', () => { this.drag = null; });
    canvas.addEventListener('wheel', event => { event.preventDefault(); this.camera.zoom = Math.max(.4, Math.min(4, this.camera.zoom * Math.exp(-event.deltaY * .001))); this.invalidate(); }, { passive: false });
    canvas.addEventListener('keydown', event => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '0'].includes(event.key)) event.preventDefault();
      if (event.key === 'ArrowLeft') this.camera.yaw += .12;
      if (event.key === 'ArrowRight') this.camera.yaw -= .12;
      if (event.key === 'ArrowUp') this.camera.pitch = Math.min(1.5, this.camera.pitch + .1);
      if (event.key === 'ArrowDown') this.camera.pitch = Math.max(.1, this.camera.pitch - .1);
      if (event.key === '+' || event.key === '=') this.camera.zoom = Math.min(4, this.camera.zoom * 1.1);
      if (event.key === '-') this.camera.zoom = Math.max(.4, this.camera.zoom / 1.1);
      if (event.key === '0') this.reset();
      this.invalidate();
    });
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); this.lost = true; canvas.setAttribute('aria-label', '3D context lost. Reload the page to restore the viewer.'); });
    canvas.addEventListener('webglcontextrestored', () => location.reload());
  }
  update(plan, options) {
    this.plan = plan; this.options = options;
    const gl = this.gl, mesh = buildMesh(plan, options), ids = new Map(plan.spaces.map((s, i) => [s.id, i + 1]));
    const packed = [];
    for (const face of mesh.faces) {
      const id = ids.get(face.spaceId) ?? 0, pick = [(id & 255) / 255, ((id >> 8) & 255) / 255, ((id >> 16) & 255) / 255];
      for (const position of face.points) packed.push(...position, ...face.normal, ...face.color, ...pick);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(packed), gl.STATIC_DRAW); this.vertexCount = packed.length / 12;
    const lines = mesh.lines.flatMap(line => [line.a, line.b].flatMap(position => [...position, 0, 0, 0, ...line.color, 0, 0, 0]));
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lines), gl.STATIC_DRAW); this.lineCount = lines.length / 12;
    this.invalidate();
  }
  reset() {
    if (this.plan) {
      const { min, max } = sceneBounds(this.plan);
      this.camera.target = min.map((v, i) => (v + max[i]) / 2); this.camera.target[2] = this.options?.scope === 'all' || this.options?.scope === 'top' ? this.camera.target[2] : 2.3;
      this.camera.extent = Math.max((max[0] - min[0]) * .4, (max[1] - min[1]) * .65);
    }
    this.camera.yaw = -.8; this.camera.pitch = .8; this.camera.zoom = 1; this.invalidate();
  }
  resize() {
    const ratio = Math.min(devicePixelRatio || 1, 2), width = Math.max(1, Math.round(this.canvas.clientWidth * ratio)), height = Math.max(1, Math.round(this.canvas.clientHeight * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width; this.canvas.height = height;
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.pickingTexture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.pickingDepth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickingFramebuffer); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.pickingTexture, 0); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.pickingDepth); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    this.invalidate();
  }
  bind(buffer) {
    const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    for (const [index, name] of ['a_position', 'a_normal', 'a_color', 'a_pick'].entries()) {
      const location = gl.getAttribLocation(this.program, name); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 48, index * 12);
    }
  }
  draw(picking = false) {
    if (!this.plan || this.lost) return;
    const gl = this.gl;
    gl.useProgram(this.program); gl.viewport(0, 0, this.canvas.width, this.canvas.height); gl.clearColor(.075, .105, .12, 1); if (picking) gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.BLEND); gl.disable(gl.DITHER);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'u_matrix'), false, cameraMatrix(this.camera, this.canvas.width / this.canvas.height)); gl.uniform1i(gl.getUniformLocation(this.program, 'u_picking'), picking ? 1 : 0);
    this.bind(this.buffer); gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
    if (!picking && this.lineCount) { this.bind(this.lineBuffer); if (this.options.navigation) gl.disable(gl.DEPTH_TEST); gl.drawArrays(gl.LINES, 0, this.lineCount); }
  }
  pick(event) {
    const gl = this.gl, box = this.canvas.getBoundingClientRect(), x = Math.floor((event.clientX - box.left) * this.canvas.width / box.width), y = this.canvas.height - 1 - Math.floor((event.clientY - box.top) * this.canvas.height / box.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickingFramebuffer); this.draw(true);
    const pixel = new Uint8Array(4); gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const id = pixel[0] | pixel[1] << 8 | pixel[2] << 16;
    if (id && this.plan.spaces[id - 1]) this.onSelect(this.plan.spaces[id - 1].id);
    this.invalidate();
  }
  invalidate() { if (!this.pending) { this.pending = true; requestAnimationFrame(() => { this.pending = false; this.draw(); }); } }
}
