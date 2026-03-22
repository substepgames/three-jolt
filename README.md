# three-jolt

Game template using Three.js and Jolt physics

## Stack

- [Three.js](https://github.com/mrdoob/three.js): rendering, model & texture loading, math, scene management
- [JoltPhysics.js](https://github.com/jrouwe/JoltPhysics.js): physics engine
- [Tone.js](https://github.com/Tonejs/Tone.js): sound system
- [Solid](https://github.com/solidjs/solid): reactive GUI

## Features

- Out of the box Three.js standard material renderer
- Asset loading for (models, textures, audio)
- Multithreaded Jolt physics engine setup
- Physics debug overlay
- Performance stats widget
- Chart widget
- Input (mouse & keyboard, game controller) handling
- Orbital camera controls
- Demo scene using every feature

## Rationale

Most popular approach to indie game development is using full-blown game engines with:

- built in 3D editor
- visual scripting
- workshop/marketplace integration
- rigid pricing and licensing

Another common approach is [to use game framework](https://gamedev.stackexchange.com/a/31774/134556) instead of game
engine and try separating code that is specific to current game from code that can be nicely reused in other
(subsequent) games.
After a couple of years making prototype games for the web I decided to put useful additions I made under the same
roof, being readily available for future work.
This template will be updated with more stuff that will prove itself useful.

Writing these features from scratch takes days, but removing them takes seconds.
