use std::sync::Arc;

use vello::kurbo::{Affine, Vec2};
use vello::peniko::color::palette;
use vello::util::{RenderContext, RenderSurface};
use vello::wgpu;
use vello::{AaConfig, Renderer, RendererOptions, Scene};
use winit::application::ApplicationHandler;
use winit::dpi::LogicalSize;
use winit::event::WindowEvent;
use winit::event_loop::ActiveEventLoop;
use winit::window::Window;

use crate::grid_pass::{GridLayerTextures, GridPass};
use crate::scene::{add_shapes_to_scene, affine_scale_factor};
use crate::state::{take_pending_camera_transform, take_pending_canvas_render_options};
use crate::types::CanvasRenderOptions;

pub const MIN_SURFACE_WIDTH: u32 = 800;
pub const MIN_SURFACE_HEIGHT: u32 = 600;

const VELLO_CLEAR_TRANSPARENT: vello::peniko::Color =
    vello::peniko::Color::new([0.0f32, 0.0, 0.0, 0.0]);

#[cfg(target_arch = "wasm32")]
pub fn device_pixel_ratio() -> f64 {
    web_sys::window()
        .map(|w| w.device_pixel_ratio())
        .unwrap_or(1.0)
}

#[cfg(not(target_arch = "wasm32"))]
pub fn device_pixel_ratio() -> f64 {
    1.0
}

pub struct RenderState {
    pub surface: RenderSurface<'static>,
    pub valid_surface: bool,
    pub window: Arc<Window>,
    pub canvas_id: Option<u32>,
    pub transform: Affine,
    /// Intermediate targets when using the WGPU procedural grid + Vello composite path.
    pub grid_layers: Option<GridLayerTextures>,
}

pub struct VelloRendererApp {
    pub context: RenderContext,
    pub renderers: Vec<Option<Renderer>>,
    pub grid_pass: Vec<Option<GridPass>>,
    pub states: Vec<RenderState>,
    pub scene: Scene,
}

impl VelloRendererApp {
    pub fn new() -> Self {
        Self {
            context: RenderContext::new(),
            renderers: vec![],
            grid_pass: vec![],
            states: vec![],
            scene: Scene::new(),
        }
    }

    /// When `render_opts.grid` is true, draws a procedural WGPU grid into an offscreen target, renders
    /// Vello on a transparent layer, then composites to `surface.target_view` before the usual blit.
    fn render_scene_to_surface_at(
        &mut self,
        state_idx: usize,
        width: u32,
        height: u32,
        effective_transform: Affine,
        render_opts: CanvasRenderOptions,
    ) {
        let VelloRendererApp {
            context,
            renderers,
            grid_pass,
            states,
            scene,
        } = self;
        let state = &mut states[state_idx];
        let canvas_id = state.canvas_id;
        let surface = &mut state.surface;
        let dev_id = surface.dev_id;
        let device_handle = &context.devices[dev_id];

        while grid_pass.len() <= dev_id {
            grid_pass.push(None);
        }

        let gpu_grid = render_opts.grid && render_opts.checkboard_style != 0;

        scene.reset();
        add_shapes_to_scene(
            scene,
            effective_transform,
            width,
            height,
            canvas_id,
            render_opts,
            gpu_grid,
        );

        if gpu_grid && width > 0 && height > 0 {
            let gp = grid_pass[dev_id].get_or_insert_with(|| {
                GridPass::new(&device_handle.device)
            });

            let need_new = state
                .grid_layers
                .as_ref()
                .map(|g| g.width != width || g.height != height)
                .unwrap_or(true);
            if need_new {
                state.grid_layers = Some(GridLayerTextures::new(
                    &device_handle.device,
                    width,
                    height,
                ));
            }
            let layers = state.grid_layers.as_ref().expect("grid layers");

            let inv = effective_transform.inverse();
            let zoom = affine_scale_factor(effective_transform).max(1e-6);
            gp.write_uniforms(
                &device_handle.queue,
                inv,
                width,
                height,
                zoom,
                &render_opts,
            );

            let mut grid_enc = device_handle
                .device
                .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                    label: Some("grid_background"),
                });
            gp.encode_grid_pass(&mut grid_enc, &layers.bg_view);
            device_handle.queue.submit([grid_enc.finish()]);

            renderers[dev_id]
                .as_mut()
                .expect("renderer")
                .render_to_texture(
                    &device_handle.device,
                    &device_handle.queue,
                    scene,
                    &layers.vello_view,
                    &vello::RenderParams {
                        base_color: VELLO_CLEAR_TRANSPARENT,
                        width,
                        height,
                        antialiasing_method: AaConfig::Msaa16,
                    },
                )
                .expect("render to texture");

            let surface_texture = surface
                .surface
                .get_current_texture()
                .expect("get current texture");
            let mut encoder = device_handle
                .device
                .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                    label: Some("composite_and_blit"),
                });
            gp.encode_composite_pass(
                &device_handle.device,
                &mut encoder,
                &layers.composite_view,
                &layers.bg_view,
                &layers.vello_view,
            );
            surface.blitter.copy(
                &device_handle.device,
                &mut encoder,
                &layers.composite_view,
                &surface_texture
                    .texture
                    .create_view(&wgpu::TextureViewDescriptor::default()),
            );
            device_handle.queue.submit([encoder.finish()]);
            surface_texture.present();
            device_handle.device.poll(wgpu::PollType::Poll).unwrap();
        } else {
            state.grid_layers = None;
            renderers[dev_id]
                .as_mut()
                .expect("renderer")
                .render_to_texture(
                    &device_handle.device,
                    &device_handle.queue,
                    scene,
                    &surface.target_view,
                    &vello::RenderParams {
                        base_color: palette::css::WHITE,
                        width,
                        height,
                        antialiasing_method: AaConfig::Msaa16,
                    },
                )
                .expect("render to texture");

            let surface_texture = surface
                .surface
                .get_current_texture()
                .expect("get current texture");
            let mut encoder = device_handle
                .device
                .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                    label: Some("Surface Blit"),
                });
            surface.blitter.copy(
                &device_handle.device,
                &mut encoder,
                &surface.target_view,
                &surface_texture
                    .texture
                    .create_view(&wgpu::TextureViewDescriptor::default()),
            );
            device_handle.queue.submit([encoder.finish()]);
            surface_texture.present();
            device_handle.device.poll(wgpu::PollType::Poll).unwrap();
        }
    }
}

impl ApplicationHandler for VelloRendererApp {
    fn resumed(&mut self, _event_loop: &ActiveEventLoop) {
        #[cfg(target_arch = "wasm32")]
        return;

        #[cfg(not(target_arch = "wasm32"))]
        {
            if !self.states.is_empty() { return; }
            let window = Arc::new(
                _event_loop
                    .create_window(
                        Window::default_attributes()
                            .with_inner_size(LogicalSize::new(800.0, 600.0))
                            .with_resizable(true)
                            .with_title("Vello Renderer - Infinite Canvas"),
                    )
                    .expect("create window"),
            );
            let size = window.inner_size();
            let surface_future = self.context.create_surface(
                window.clone(),
                size.width,
                size.height,
                wgpu::PresentMode::AutoVsync,
            );
            let surface = pollster::block_on(surface_future).expect("create surface");
            self.renderers.resize_with(self.context.devices.len(), || None);
            let dev_id = surface.dev_id;
            self.renderers[dev_id].get_or_insert_with(|| {
                Renderer::new(
                    &self.context.devices[dev_id].device,
                    RendererOptions::default(),
                )
                .expect("create renderer")
            });
            window.request_redraw();
            self.states.push(RenderState {
                surface,
                valid_surface: true,
                window,
                canvas_id: None,
                transform: Affine::IDENTITY,
                grid_layers: None,
            });
        }
    }

    fn window_event(
        &mut self,
        event_loop: &ActiveEventLoop,
        window_id: winit::window::WindowId,
        event: WindowEvent,
    ) {
        let Some(idx) = self
            .states
            .iter()
            .position(|s| s.window.id() == window_id)
        else {
            return;
        };
        match event {
            WindowEvent::CloseRequested => event_loop.exit(),
            WindowEvent::Resized(size) => {
                let state = &mut self.states[idx];
                if size.width != 0 && size.height != 0 {
                    let w = size.width.max(MIN_SURFACE_WIDTH);
                    let h = size.height.max(MIN_SURFACE_HEIGHT);
                    #[cfg(target_arch = "wasm32")]
                    {
                        use winit::platform::web::WindowExtWebSys;
                        if let Some(canvas) = state.window.canvas() {
                            canvas.set_width(w);
                            canvas.set_height(h);
                        }
                    }
                    self.context.resize_surface(&mut state.surface, w, h);
                    state.grid_layers = None;
                    state.valid_surface = true;
                    state.window.request_redraw();
                } else {
                    state.valid_surface = false;
                }
            }
            WindowEvent::RedrawRequested => {
                if !self.states[idx].valid_surface {
                    return;
                }
                let canvas_id = self.states[idx].canvas_id;
                let mut width = self.states[idx].surface.config.width;
                let mut height = self.states[idx].surface.config.height;

                #[cfg(target_arch = "wasm32")]
                if let Some(cid) = canvas_id {
                    use crate::state::{EXPORT_VIEW_PENDING, RESTORE_PENDING, RESTORE_STATE};
                    use wasm_bindgen::JsValue;

                    let need_restore = RESTORE_PENDING.with(|c| c.borrow_mut().remove(&cid).is_some());
                    if need_restore {
                        if let Some((w, h, affine)) =
                            RESTORE_STATE.with(|c| c.borrow_mut().remove(&cid))
                        {
                            {
                                let s = &mut self.states[idx];
                                s.transform = affine;
                                width = w;
                                height = h;
                                use winit::platform::web::WindowExtWebSys;
                                if let Some(canvas) = s.window.canvas() {
                                    canvas.set_width(w);
                                    canvas.set_height(h);
                                }
                                self.context.resize_surface(&mut s.surface, w, h);
                                s.grid_layers = None;
                            }
                        }
                    } else if let Some((opts, on_rendered)) =
                        EXPORT_VIEW_PENDING.with(|c| c.borrow_mut().remove(&cid))
                    {
                        let export_w = opts.width.max(1.0).min(8192.0) as u32;
                        let export_h = opts.height.max(1.0).min(8192.0) as u32;
                        {
                            let s = &mut self.states[idx];
                            RESTORE_STATE.with(|c| {
                                c.borrow_mut().insert(cid, (width, height, s.transform));
                            });
                            s.transform = Affine::translate(Vec2::new(-opts.left, -opts.top));
                            use winit::platform::web::WindowExtWebSys;
                            if let Some(canvas) = s.window.canvas() {
                                canvas.set_width(export_w);
                                canvas.set_height(export_h);
                            }
                            self.context
                                .resize_surface(&mut s.surface, export_w, export_h);
                            s.grid_layers = None;
                        }
                        let effective_transform = self.states[idx].transform;
                        let render_opts = take_pending_canvas_render_options(canvas_id);
                        self.render_scene_to_surface_at(
                            idx,
                            export_w,
                            export_h,
                            effective_transform,
                            render_opts,
                        );
                        let _ = on_rendered.call1(&JsValue::NULL, &JsValue::from(cid));
                        RESTORE_PENDING.with(|c| c.borrow_mut().insert(cid, ()));
                        self.states[idx].window.request_redraw();
                        return;
                    }
                }

                if let Some(affine) = take_pending_camera_transform(canvas_id) {
                    self.states[idx].transform = affine;
                }
                if width == 0 || height == 0 {
                    self.states[idx].window.request_redraw();
                    return;
                }
                self.states[idx].window.request_redraw();
                let dpr = device_pixel_ratio();
                let effective_transform = self.states[idx].transform * Affine::scale(dpr);
                let render_opts = take_pending_canvas_render_options(canvas_id);
                self.render_scene_to_surface_at(
                    idx,
                    width,
                    height,
                    effective_transform,
                    render_opts,
                );
            }
            _ => {}
        }
    }

    fn about_to_wait(&mut self, _event_loop: &ActiveEventLoop) {}
}

#[cfg(not(target_arch = "wasm32"))]
pub fn run_native() -> anyhow::Result<()> {
    use winit::event_loop::EventLoop;
    let mut app = VelloRendererApp::new();
    let event_loop = EventLoop::new()?;
    event_loop.run_app(&mut app).expect("event loop");
    Ok(())
}

#[cfg(target_arch = "wasm32")]
#[allow(deprecated)]
pub async fn run_all_canvases_async() {
    use winit::platform::web::WindowAttributesExtWebSys;
    use winit::event_loop::EventLoop;
    use wasm_bindgen::JsValue;
    use crate::state::{CANVAS_SHAPES, CANVAS_WINDOWS, NEXT_CANVAS_ID, PENDING_CANVASES, RUNNER_SCHEDULED};

    let pending = PENDING_CANVASES.with(|c| c.borrow_mut().drain(..).collect::<Vec<_>>());
    if pending.is_empty() {
        RUNNER_SCHEDULED.set(false);
        return;
    }

    let event_loop = match EventLoop::new() {
        Ok(el) => el,
        Err(_) => { RUNNER_SCHEDULED.set(false); return; }
    };

    let mut context = RenderContext::new();
    let mut window_items: Vec<(u32, Arc<Window>, u32, u32, js_sys::Function)> =
        Vec::with_capacity(pending.len());

    for (canvas, on_ready) in pending {
        let canvas_id = NEXT_CANVAS_ID.with(|c| {
            let mut id = c.borrow_mut();
            let next = *id;
            *id = id.saturating_add(1);
            next
        });
        CANVAS_SHAPES.with(|c| {
            c.borrow_mut().insert(canvas_id, Vec::new());
        });

        let mut attrs = Window::default_attributes()
            .with_inner_size(LogicalSize::new(800.0, 600.0))
            .with_resizable(true)
            .with_title("Vello Renderer - Infinite Canvas");
        attrs = attrs.with_canvas(Some(canvas));
        let window = match event_loop.create_window(attrs) {
            Ok(w) => Arc::new(w),
            Err(_) => continue,
        };
        let (width, height) = {
            use winit::platform::web::WindowExtWebSys;
            if let Some(ref c) = window.canvas() {
                c.set_attribute("tabindex", "0").ok();
                let w = c.width().max(MIN_SURFACE_WIDTH);
                let h = c.height().max(MIN_SURFACE_HEIGHT);
                if w == 0 || h == 0 {
                    let cw = (c.client_width().max(1) as u32).max(MIN_SURFACE_WIDTH);
                    let ch = (c.client_height().max(1) as u32).max(MIN_SURFACE_HEIGHT);
                    c.set_width(cw);
                    c.set_height(ch);
                    (cw, ch)
                } else {
                    (w, h)
                }
            } else {
                let size = window.inner_size();
                (size.width.max(MIN_SURFACE_WIDTH), size.height.max(MIN_SURFACE_HEIGHT))
            }
        };
        window_items.push((canvas_id, window, width, height, on_ready));
    }

    if window_items.is_empty() {
        RUNNER_SCHEDULED.set(false);
        return;
    }

    let mut built: Vec<(u32, Arc<Window>, RenderSurface<'static>, js_sys::Function)> =
        Vec::with_capacity(window_items.len());
    for (canvas_id, window, width, height, on_ready) in window_items {
        let surface = match context
            .create_surface(window.clone(), width, height, wgpu::PresentMode::AutoVsync)
            .await
        {
            Ok(s) => s,
            Err(_) => continue,
        };
        built.push((canvas_id, window, surface, on_ready));
    }

    let mut renderers: Vec<Option<Renderer>> = vec![];
    renderers.resize_with(context.devices.len(), || None);
    let mut states: Vec<RenderState> = Vec::with_capacity(built.len());
    for (canvas_id, window, surface, on_ready) in built {
        let dev_id = surface.dev_id;
        renderers[dev_id].get_or_insert_with(|| {
            Renderer::new(
                &context.devices[dev_id].device,
                RendererOptions::default(),
            )
            .expect("create renderer")
        });
        CANVAS_WINDOWS.with(|c| {
            c.borrow_mut().insert(canvas_id, window.clone());
        });
        {
            use winit::platform::web::WindowExtWebSys;
            window.set_prevent_default(false);
        }
        states.push(RenderState {
            surface,
            valid_surface: true,
            window: window.clone(),
            canvas_id: Some(canvas_id),
            transform: Affine::IDENTITY,
            grid_layers: None,
        });
        let _ = on_ready.call1(&JsValue::NULL, &JsValue::from(canvas_id));
        window.request_redraw();
    }

    let mut app = VelloRendererApp {
        context,
        renderers,
        grid_pass: vec![],
        states,
        scene: Scene::new(),
    };
    let _ = event_loop.run_app(&mut app);
}
