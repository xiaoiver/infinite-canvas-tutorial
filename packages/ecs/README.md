# @infinite-canvas-tutorial/ecs

This repository contains the core module code for the Infinite Canvas Tutorial project.
Since [Lesson 18], I've used [Becsy] to refactor the whole application.

As for UIs you can choose the following, but it's not necessary:

-   `@infinite-canvas-tutorial/webcomponents` Use [Spectrum] to implement, refer to Photoshop online.

## Features

-   Entity Component System (ECS) architecture.
-   Versioning with [Epoch Semantic].

## Getting Started

Create a system:

```ts
import { System, Commands } from '@infinite-canvas-tutorial/ecs';

class StartUpSystem extends System {
    private readonly commands = new Commands(this);
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

## Examples

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
