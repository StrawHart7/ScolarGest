const VALID_STATES = new Set(["idle","happy","thinking","surprised","sad","error","success","loading","sleeping","singing"]);

export const resolveState = (state) => VALID_STATES.has(state) ? state : 'idle';

export const preset = {
  "version": 2,
  "id": "wobbi-original",
  "slug": "scola",
  "name": "Scola",
  "componentName": "Scola",
  "preset": "wobbi",
  "shape": "ghost",
  "eyes": "classic",
  "nose": "none",
  "brows": "none",
  "mouth": "smile",
  "depth": "soft",
  "color": "#0052cc",
  "mouthColor": "#ffffff",
  "noseColor": "#001848",
  "browColor": "#001848",
  "pupilColor": "#001848",
  "lashColor": "#001848",
  "eyeOutlineColor": "#001848",
  "eyeOutlineWidth": 0,
  "head": "none",
  "accessory": "none",
  "accessoryColor": "#262331",
  "accentColor": "#b2c5ff",
  "eyeColor": "#ffffff",
  "outlineColor": "#001848",
  "outlineWidth": 0,
  "background": {
    "type": "solid",
    "color": "#ffffff"
  },
  "size": 256,
  "defaultState": "idle",
  "reactions": {
    "idle": {
      "duration": 2400,
      "intensity": 60,
      "easing": "ease-out",
      "playback": "loop",
      "movements": [
        {
          "type": "blink",
          "enabled": true
        },
        {
          "type": "eye-movement",
          "enabled": true
        }
      ]
    },
    "happy": {
      "duration": 800,
      "intensity": 60,
      "easing": "ease-out",
      "playback": "loop",
      "movements": [
        {
          "type": "bounce",
          "enabled": true
        },
        {
          "type": "squash",
          "enabled": true
        },
        {
          "type": "tilt",
          "enabled": true
        },
        {
          "type": "blink",
          "enabled": true
        }
      ]
    },
    "thinking": {
      "duration": 800,
      "intensity": 60,
      "easing": "ease-out",
      "playback": "loop",
      "movements": [
        {
          "type": "tilt",
          "enabled": true
        },
        {
          "type": "eye-movement",
          "enabled": true
        }
      ]
    },
    "surprised": {
      "duration": 800,
      "intensity": 60,
      "easing": "ease-out",
      "playback": "loop",
      "movements": [
        {
          "type": "squash",
          "enabled": true
        },
        {
          "type": "blink",
          "enabled": true
        }
      ]
    },
    "sad": {
      "duration": 800,
      "intensity": 60,
      "easing": "ease-out",
      "playback": "loop",
      "movements": [
        {
          "type": "tilt",
          "enabled": true
        }
      ]
    },
    "error": {
      "duration": 800,
      "intensity": 60,
      "easing": "ease-out",
      "playback": "loop",
      "movements": [
        {
          "type": "shake",
          "enabled": true
        }
      ]
    },
    "success": {
      "duration": 800,
      "intensity": 60,
      "easing": "ease-out",
      "playback": "loop",
      "movements": [
        {
          "type": "bounce",
          "enabled": true
        },
        {
          "type": "squash",
          "enabled": true
        }
      ]
    },
    "loading": {
      "duration": 800,
      "intensity": 60,
      "easing": "ease-out",
      "playback": "loop",
      "movements": [
        {
          "type": "tilt",
          "enabled": true
        },
        {
          "type": "blink",
          "enabled": true
        }
      ]
    },
    "sleeping": {
      "duration": 800,
      "intensity": 60,
      "easing": "ease-out",
      "playback": "loop",
      "movements": [
        {
          "type": "blink",
          "enabled": true
        }
      ]
    },
    "singing": {
      "duration": 800,
      "intensity": 60,
      "easing": "ease-out",
      "playback": "loop",
      "movements": [
        {
          "type": "bounce",
          "enabled": true
        },
        {
          "type": "mouth",
          "enabled": true
        }
      ]
    }
  },
  "export": {
    "folder": "src/components/mascot",
    "framework": "react"
  },
  "accessibility": {
    "respectReducedMotion": true,
    "pauseOffscreen": true,
    "label": "Scola, la mascotte de ScolarGest"
  }
};
