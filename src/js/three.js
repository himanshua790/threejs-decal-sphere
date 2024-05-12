import GUI from 'lil-gui';
import * as T from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry';

const device = {
  width: window.innerWidth,
  height: window.innerHeight,
  pixelRatio: window.devicePixelRatio
};

export default class Three {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(
      75,
      device.width / device.height,
      0.1,
      100
    );
    this.camera.position.set(0, 0, 30);
    this.scene.add(this.camera);
    this.renderer = new T.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true
    });
    this.renderer.setSize(device.width, device.height);
    this.renderer.setPixelRatio(Math.min(device.pixelRatio, 2));
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.clock = new T.Clock();
    this.loadingManager = new T.LoadingManager();
    this.loadingManager.onStart = () => {
      console.log('Loading started');
    };
    this.loadingManager.onLoad = () => {
      console.log('Loading finished');
    };
    this.loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
      console.log('Loading progressing', url, itemsLoaded, itemsTotal);
    };
    this.loadingManager.onError = (url) => {
      console.error('Loading error', url);
    };
    this.intersection = {
      intersects: false,
      point: new T.Vector3(),
      normal: new T.Vector3()
    };
    this.mouse = new T.Vector2();
    this.intersects = [];
    this.mouseHelper;
    this.position = new T.Vector3();
    this.orientation = new T.Euler();
    this.size = new T.Vector3(0.1, 0.1, 0.1);
    this.decals = [];
    this.params = {
      minScale: 5,
      maxScale: 10,
      envMapIntensity: 2.5,
      metalness: 0.6,
      roughness: 0,
      clear: () => {}
    };
    this.decalMaterial = undefined;
    this.gui = new GUI();
    this.sampleDecals = [];
    this.setLights();
    this.setGeometry();
    this.setResize();
    this.setEnvironmentMap();
    this.loadDecals();
    this.setupPointer();
    this.addGUI();
    this.render();
  }

  setLights() {
    // Ambient light setup
    this.ambientLight = new T.AmbientLight(new T.Color(1, 1, 1, 1));
    this.ambientLight.intensity = 4;
    this.scene.add(this.ambientLight);
  }

  setGeometry() {
    // Sphere geometry setup
    this.sphereGeometry = new T.SphereGeometry(15, 64, 64);
    this.sphereMaterial = new T.MeshStandardMaterial({
      color: '#000000',
      roughness: 0,
      metalness: 0.3
    });
    this.sphereMesh = new T.Mesh(this.sphereGeometry, this.sphereMaterial);
    this.scene.add(this.sphereMesh);
  }

  loadDecals() {
    // Load decal textures
    const textureLoader = new T.TextureLoader(this.loadingManager);
    const sticker1 = textureLoader.load('/assets/textures/sticker1.png');
    const sticker2 = textureLoader.load('/assets/textures/sticker2.png');
    const sticker3 = textureLoader.load('/assets/textures/sticker3.png');
    const sticker4 = textureLoader.load('/assets/textures/sticker4.png');
    const sticker5 = textureLoader.load('/assets/textures/sticker5.png');
    const decalDiffuse = textureLoader.load(
      '/assets/textures/decal-diffuse.png'
    );
    decalDiffuse.name = 'splash';
    decalDiffuse.colorSpace = T.SRGBColorSpace;
    const allDecals = [
      sticker1,
      sticker2,
      sticker3,
      sticker4,
      sticker5,
      decalDiffuse
    ];
    this.sampleDecals = allDecals;
    // Decal material setup
    this.decalMaterial = new T.MeshStandardMaterial({
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      wireframe: false,
      envMap: this.envMap,
      envMapIntensity: this.params.envMapIntensity,
      roughness: this.params.roughness,
      metalness: this.params.metalness
    });
  }

  setEnvironmentMap() {
    // Environment map setup
    const cubeTextureLoader = new T.CubeTextureLoader(this.loadingManager);
    this.envMap = cubeTextureLoader.load([
      '/assets/environmentMaps/px.png',
      '/assets/environmentMaps/nx.png',
      '/assets/environmentMaps/py.png',
      '/assets/environmentMaps/ny.png',
      '/assets/environmentMaps/pz.png',
      '/assets/environmentMaps/nz.png'
    ]);
    this.scene.environment = this.envMap;
    this.scene.background = new T.Color('#000000');
  }

  setupPointer() {
    // Setup for mouse pointer interaction
    const geometry = new T.BufferGeometry();
    geometry.setFromPoints([new T.Vector3(), new T.Vector3()]);
    this.line = new T.Line(geometry, new T.LineBasicMaterial());
    this.scene.add(this.line);
    this.raycaster = new T.Raycaster();
    this.mouseHelper = new T.Mesh(
      new T.BoxGeometry(1, 1, 10),
      new T.MeshNormalMaterial()
    );
    this.mouseHelper.visible = false;
    this.scene.add(this.mouseHelper);
    let moved = false;
    this.controls.addEventListener('change', () => {
      moved = true;
    });
    window.addEventListener('pointerdown', () => {
      moved = false;
    });
    window.addEventListener('pointerup', (event) => {
      if (!moved) {
        this.checkIntersection(event.clientX, event.clientY);
        if (this.intersection.intersects) this.shoot();
      }
    });
    window.addEventListener('pointermove', (event) => {
      this.onPointerMove(event);
    });
  }

  checkIntersection(x, y) {
    // Check intersection with the sphere
    if (!this.sphereMesh) return;
    this.mouse.x = (x / window.innerWidth) * 2 - 1;
    this.mouse.y = -(y / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    this.raycaster.intersectObject(this.sphereMesh, false, this.intersects);
    if (this.intersects.length > 0) {
      const p = this.intersects[0].point;
      this.mouseHelper.position.copy(p);
      this.intersection.point.copy(p);
      const n = this.intersects[0].face.normal.clone();
      n.transformDirection(this.sphereMesh.matrixWorld);
      n.multiplyScalar(10);
      n.add(this.intersects[0].point);
      this.intersection.normal.copy(this.intersects[0].face.normal);
      this.mouseHelper.lookAt(n);
      const positions = this.line.geometry.attributes.position;
      positions.setXYZ(0, p.x, p.y, p.z);
      positions.setXYZ(1, n.x, n.y, n.z);
      positions.needsUpdate = true;
      this.intersection.intersects = true;
      this.intersects.length = 0;
    } else {
      this.intersection.intersects = false;
    }
  }

  onPointerMove(event) {
    if (event.isPrimary) {
      this.checkIntersection(event.clientX, event.clientY);
    }
  }

  shoot() {
    // Create and place a decal
    this.position.copy(this.intersection.point);
    this.orientation.copy(this.mouseHelper.rotation);
    if (this.params.rotate) this.orientation.z = Math.random() * 2 * Math.PI;
    const scale =
      this.params.minScale +
      Math.random() * (this.params.maxScale - this.params.minScale);
    this.size.set(scale, scale, scale);
    const material = this.decalMaterial.clone();
    material.map =
      this.sampleDecals[Math.floor(Math.random() * this.sampleDecals.length)];
    if (material.map.name === 'splash') {
      material.color.setHex(Math.random() * '0xffffff');
    }
    const m = new T.Mesh(
      new DecalGeometry(
        this.sphereMesh,
        this.position,
        this.orientation,
        this.size
      ),
      material
    );
    m.renderOrder = this.decals.length;
    this.decals.push(m);
    this.scene.add(m);
  }

  removeDecals() {
    // Remove all decals from the scene
    for (const d of this.decals) {
      this.scene.remove(d);
    }
    this.decals.length = 0;
  }

  render() {
    // Render loop
    this.scene.traverse((object) => {
      if (
        object instanceof T.Mesh &&
        object.material &&
        this.envMap &&
        object.material instanceof T.MeshStandardMaterial
      ) {
        object.material.envMap = this.envMap;
        object.material.envMapIntensity = 1;
      }
    });
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.render.bind(this));
  }

  setResize() {
    // Update camera aspect ratio on window resize
    window.addEventListener('resize', () => {
      device.width = window.innerWidth;
      device.height = window.innerHeight;
      this.camera.aspect = device.width / device.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(device.width, device.height);
      this.renderer.setPixelRatio(Math.min(device.pixelRatio, 2));
    });
  }

  addGUI() {
    // Setup GUI controls
    this.gui
      .add(this.ambientLight, 'intensity', 0, 10, 0.01)
      .name('ambientLight intensity');
    this.gui
      .add(this.params, 'metalness', 0, 1, 0.01)
      .name('decal metalness')
      .onChange(() => {
        this.decalMaterial.metalness = this.params.metalness;
      });
    this.gui
      .add(this.params, 'roughness', 0, 1, 0.01)
      .name('decal roughness')
      .onChange(() => {
        this.decalMaterial.roughness = this.params.roughness;
      });
    this.gui
      .add(this.params, 'clear')
      .onChange(() => {
        this.removeDecals();
      })
      .name('clear decals');
    this.gui.open();
  }
}
