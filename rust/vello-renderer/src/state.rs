#[cfg(target_arch = "wasm32")]
use std::cell::{Cell, RefCell};
#[cfg(target_arch = "wasm32")]
use std::collections::HashMap;
use std::sync::Arc;

use vello::kurbo::Affine;
#[cfg(target_arch = "wasm32")]
use vello::peniko::ImageBrush;
use winit::window::Window;

use crate::types::CanvasRenderOptions;
#[cfg(target_arch = "wasm32")]
use crate::types::{ExportViewOpts, JsShape};

#[cfg(target_arch = "wasm32")]
thread_local! {
    pub static CANVAS_SHAPES: RefCell<HashMap<u32, Vec<JsShape>>> = RefCell::new(HashMap::new());
    pub static NEXT_CANVAS_ID: RefCell<u32> = RefCell::new(0);
    pub static PENDING_CANVASES: RefCell<Vec<(web_sys::HtmlCanvasElement, js_sys::Function)>> = RefCell::new(Vec::new());
    pub static RUNNER_SCHEDULED: Cell<bool> = Cell::new(false);
    pub static FONT_BYTES: RefCell<Vec<Vec<u8>>> = RefCell::new(Vec::new());
    pub static CAMERA_TRANSFORM_PENDING: RefCell<HashMap<u32, Affine>> = RefCell::new(HashMap::new());
    pub static CANVAS_RENDER_OPTIONS_PENDING: RefCell<HashMap<u32, CanvasRenderOptions>> = RefCell::new(HashMap::new());
    /// 最近一次已成功应用的选项。`take_pending_canvas_render_options` 在 pending 为空时回退到此，
    /// 避免同一帧内 `request_redraw` 触发第二次绘制时因 pending 已被消费而落回默认（例如 checkboard_style=1）。
    pub static LAST_CANVAS_RENDER_OPTIONS: RefCell<HashMap<u32, CanvasRenderOptions>> = RefCell::new(HashMap::new());
    pub static CANVAS_WINDOWS: RefCell<HashMap<u32, Arc<Window>>> = RefCell::new(HashMap::new());
    pub static EXPORT_VIEW_PENDING: RefCell<HashMap<u32, (ExportViewOpts, js_sys::Function)>> = RefCell::new(HashMap::new());
    pub static RESTORE_PENDING: RefCell<HashMap<u32, ()>> = RefCell::new(HashMap::new());
    pub static RESTORE_STATE: RefCell<HashMap<u32, (u32, u32, Affine)>> = RefCell::new(HashMap::new());
    pub static EMOJI_CACHE: RefCell<HashMap<String, (Vec<u8>, u32, u32)>> = RefCell::new(HashMap::new());
    pub static GLYPH_CACHE: RefCell<
        HashMap<
            (String, u32, String, u32, u32, bool, bool, u64, String, String, String, String),
            (Vec<(vello::peniko::FontData, Vec<vello::Glyph>)>, f32, Vec<crate::text::EmojiPosition>),
        >,
    > = RefCell::new(HashMap::new());
    pub static FONT_CONTEXT: RefCell<Option<parley::FontContext>> = RefCell::new(None);
    pub static LAST_REGISTERED_FONT_FINGERPRINT: RefCell<Option<u64>> = RefCell::new(None);

    // Cache ImageRect -> ImageBrush, to avoid recreating/uploading textures on every redraw.
    // Key by JsShape `id`.
    pub static IMAGE_BRUSH_CACHE: RefCell<HashMap<String, ImageBrush>> = RefCell::new(HashMap::new());
    // Cache brush stamp RGBA image bytes by Brush `id`.
    pub static BRUSH_STAMP_CACHE: RefCell<HashMap<String, (Vec<u8>, u32, u32)>> = RefCell::new(HashMap::new());
}

#[cfg(target_arch = "wasm32")]
pub fn get_user_shapes(canvas_id: u32) -> Vec<JsShape> {
    CANVAS_SHAPES.with(|c| c.borrow().get(&canvas_id).cloned().unwrap_or_default())
}

#[cfg(target_arch = "wasm32")]
pub fn push_shape(canvas_id: u32, shape: JsShape) {
    CANVAS_SHAPES.with(|c| {
        c.borrow_mut().entry(canvas_id).or_default().push(shape);
    });
}

#[cfg(target_arch = "wasm32")]
pub fn clear_shapes_for_canvas(canvas_id: u32) {
    CANVAS_SHAPES.with(|c| {
        if let Some(list) = c.borrow_mut().get_mut(&canvas_id) {
            list.clear();
        }
    });
}

#[cfg(target_arch = "wasm32")]
pub fn clear_image_brush_cache() {
    IMAGE_BRUSH_CACHE.with(|c| c.borrow_mut().clear());
}

#[cfg(target_arch = "wasm32")]
pub fn set_brush_stamp_image(id: String, image_data: Vec<u8>, image_width: u32, image_height: u32) {
    BRUSH_STAMP_CACHE.with(|c| {
        c.borrow_mut().insert(id, (image_data, image_width, image_height));
    });
}

#[cfg(target_arch = "wasm32")]
pub fn clear_brush_stamp_cache() {
    BRUSH_STAMP_CACHE.with(|c| c.borrow_mut().clear());
}

#[cfg(target_arch = "wasm32")]
pub fn get_brush_stamp_image(id: &str) -> Option<(Vec<u8>, u32, u32)> {
    BRUSH_STAMP_CACHE.with(|c| c.borrow().get(id).cloned())
}

#[cfg(target_arch = "wasm32")]
pub fn take_pending_camera_transform(canvas_id: Option<u32>) -> Option<Affine> {
    canvas_id.and_then(|cid| CAMERA_TRANSFORM_PENDING.with(|c| c.borrow_mut().remove(&cid)))
}

#[cfg(not(target_arch = "wasm32"))]
pub fn take_pending_camera_transform(_canvas_id: Option<u32>) -> Option<Affine> {
    None
}

#[cfg(target_arch = "wasm32")]
pub fn take_pending_canvas_render_options(canvas_id: Option<u32>) -> CanvasRenderOptions {
    let Some(cid) = canvas_id else {
        return CanvasRenderOptions::default();
    };
    CANVAS_RENDER_OPTIONS_PENDING.with(|pending| {
        LAST_CANVAS_RENDER_OPTIONS.with(|last| {
            let mut p = pending.borrow_mut();
            let mut l = last.borrow_mut();
            if let Some(opts) = p.remove(&cid) {
                l.insert(cid, opts);
                opts
            } else {
                l.get(&cid).copied().unwrap_or_default()
            }
        })
    })
}

#[cfg(not(target_arch = "wasm32"))]
pub fn take_pending_canvas_render_options(_canvas_id: Option<u32>) -> CanvasRenderOptions {
    CanvasRenderOptions::default()
}
