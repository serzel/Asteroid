export class Input {
  constructor(target = window) {
    this.target = target;
    this.down = new Set();
    this.pressed = new Set();
    this.keyboardLayout = "AZERTY";

    this.layouts = {
      AZERTY: {
        up: "KeyZ",
        left: "KeyQ",
        down: "KeyS",
        right: "KeyD",
      },
      QWERTY: {
        up: "KeyW",
        left: "KeyA",
        down: "KeyS",
        right: "KeyD",
      },
    };

    this.actionBindings = {
      shoot: "Space",
      debugToggle: "F1",
      debugProfiler: "F2",
      debugProfilerFreeze: "F3",
      debugSeams: "F4",
      debugSeamsNearest: "F5",
    };

    this.capturedCodes = new Set([
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "KeyZ",
      "KeyQ",
      ...Object.values(this.actionBindings),
    ]);

    this.onKeyDown = (e) => {
      if (this.capturedCodes.has(e.code)) e.preventDefault();

      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);

      if (e.code === "KeyP" && !e.repeat) {
        this.keyboardLayout = this.keyboardLayout === "AZERTY" ? "QWERTY" : "AZERTY";
        console.info(`Layout: ${this.keyboardLayout}`);
      }
    };

    this.onKeyUp = (e) => {
      if (this.capturedCodes.has(e.code)) e.preventDefault();
      this.down.delete(e.code);
    };

    this.onWindowBlur = () => {
      this.down.clear();
      this.pressed.clear();
    };

    this.onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        this.down.clear();
        this.pressed.clear();
      }
    };

    target.addEventListener("keydown", this.onKeyDown);
    target.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onWindowBlur);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  #directionCodes(action) {
    const layoutCodes = this.layouts[this.keyboardLayout];
    const arrowCodes = {
      up: "ArrowUp",
      down: "ArrowDown",
      left: "ArrowLeft",
      right: "ArrowRight",
    };
    const arrowCode = arrowCodes[action];
    const layoutCode = layoutCodes[action];
    if (!arrowCode || !layoutCode) return null;
    return [arrowCode, layoutCode];
  }

  #boundCode(action) {
    return this.actionBindings[action] ?? action;
  }

  isDown(code) {
    const directionCodes = this.#directionCodes(code);
    if (directionCodes) return directionCodes.some((c) => this.down.has(c));

    return this.down.has(this.#boundCode(code));
  }

  wasPressed(code) {
    const directionCodes = this.#directionCodes(code);
    if (directionCodes) return directionCodes.some((c) => this.pressed.has(c));

    return this.pressed.has(this.#boundCode(code));
  }

  endFrame() {
    this.pressed.clear();
  }

  destroy() {
    this.target.removeEventListener("keydown", this.onKeyDown);
    this.target.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onWindowBlur);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.down.clear();
    this.pressed.clear();
  }
}
