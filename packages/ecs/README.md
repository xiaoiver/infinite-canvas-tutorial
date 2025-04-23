# @infinite-canvas-tutorial/ecs

This repository contains the core module code for the Infinite Canvas Tutorial project.
Since [Lesson 18], I've used [Becsy] to refactor the whole application.

As for UIs you can choose the following, but it's not necessary:

-   `@infinite-canvas-tutorial/webcomponents` Use [Spectrum] to implement, refer to Photoshop online.

## Features

-   Entity Component System (ECS) architecture.
-   Versioning with [Epoch Semantic].

## Getting Started

Create a system and create API instance in `initialize` hook:

```ts
import {
    System,
    Commands,
    API,
    DefaultStateManagement,
} from '@infinite-canvas-tutorial/ecs';

class StartUpSystem extends System {
    private readonly commands = new Commands(this);

    initialize(): void {
        const api = new API(new DefaultStateManagement(), this.commands);

        api.createCanvas({
            element: $canvas,
            width: window.innerWidth,
            height: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio,
        });
        api.createCamera({
            zoom: 1,
        });

        api.updateNodes([
            {
                id: '1',
                type: 'rect',
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                fill: 'red',
            },
        ]);
        api.record();
    }
}
```

Declare a plugin with system stages. Here we use `PreStartUp` to create some shapes.

```ts
import { system, PreStartUp } from '@infinite-canvas-tutorial/ecs';

const MyPlugin = () => {
    system(PreStartUp)(StartUpSystem);
};
```

Start running this app, use the built-in `DefaultPlugins`:

```ts
import { App } from '@infinite-canvas-tutorial/ecs';

// Add our custom plugin before running
const app = new App().addPlugins(...DefaultPlugins, MyPlugin);
app.run();
```

## API

### createCanvas

-   element `HTMLCanvasElement | OffscreenCanvas`
-   width `number` Default to `0`.
-   height `number` Default to `0`.
-   renderer `'webgl' | 'webgpu'` Default to `'webgl'`.
-   shaderCompilerPath `string`
-   devicePixelRatio `number` Default to `1`.

```ts
const canvas = api.createCanvas({
    element: $canvas,
    width: 100,
    height: 100,
}); // Entity
```

### createCamera

Return a camera entity:

```ts
const camera = api.createCamera({
    zoom: 1,
}); // Entity
```

Then we can pan the camera with [Transform](#transform) component like this:

```ts
camera.write(Transform).translation = { x: 100, y: 100 };
```

### client2Viewport

Convert in client and viewport coordinate systems.

```ts
api.client2Viewport({ x, y }); // { x, y }
```

### viewport2Client

### viewport2Canvas

### canvas2Viewport

### getAppState

### setAppState

### getNodes

### setNodes

## Components

We can read and write components of an entity. Take [Transform](#transform) as an example:

```ts
const transform = entity.read(Transform);
entity.write(Transform).translation.x = 100;
```

### Transform

A 2D transform has the following fields:

-   translation `Vec2`
-   scale `Vec2`
-   rotation `number`

```ts
entity.write(Transform).translation = { x: 100, y: 100 };
entity.write(Transform).translation.x = 100;
entity.write(Transform).rotation = Math.PI;
```

### Parent & Children

Hierarchy with refs and backrefs.

```ts
entity.read(Parent).children; // [child1, child2]
entity.read(Children).parent; // parent
```

### Visibility

Whether an entity is visible. Propagates down the entity hierarchy.

```ts
entity.write(Visibility).value = 'inherited';
entity.write(Visibility).value = 'visible';
entity.write(Visibility).value = 'hidden';
```

### Circle

-   cx `number`
-   cy `number`
-   r `number`

## Project Structure

```bash
src/
├── plugins/                   # Built-in plugins
│   │── Hierarchy
│   │── Transform
|   │── ...
├── components/                # Components
│   │── Canvas
│   │── Theme
│   │── Grid
|   |── ...
├── systems/                   # Systems
|   |── ...
├── enviroment/                # Browser, WebWorker...
├── shaders/                   # Built-in shaders e.g. SDF, Mesh...
├── drawcalls/
```

## Recipes

### Resize with window

```ts
window.addEventListener('resize', () => {
    resize(window.innerWidth, window.innerHeight); // Resize <canvas>

    Object.assign(canvasEntity.write(Canvas), {
        // Update width & height of Canvas component
        width: window.innerWidth,
        height: window.innerHeight,
    });
});
```

## FAQs

### A precedence cycle in systems

Open devtools in `DEV` environment, you can see the system execution order printed in console:

```bash
System execution order:
    PreStartUpPlaceHolder
    StartUpSystem
    StartUpPlaceHolder
    SetupDevice
    PostStartUpPlaceHolder
    EventWriter
...
```

[Lesson 18]: https://infinitecanvas.cc/guide/lesson-018
[Becsy]: https://lastolivegames.github.io/becsy/
[Spectrum]: https://opensource.adobe.com/spectrum-web-components
[Epoch Semantic]: https://antfu.me/posts/epoch-semver
