#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
use serde::Deserialize;

#[cfg(target_arch = "wasm32")]
use vello::kurbo::{Affine, Vec2};

#[cfg(target_arch = "wasm32")]
use crate::state::{
    CAMERA_TRANSFORM_PENDING, CANVAS_RENDER_OPTIONS_PENDING, CANVAS_WINDOWS,
    EMOJI_CACHE, EXPORT_VIEW_PENDING, FONT_BYTES, GLYPH_CACHE, PENDING_CANVASES,
    RESTORE_PENDING, RUNNER_SCHEDULED,
    clear_image_brush_cache, clear_shapes_for_canvas, push_shape,
};
#[cfg(target_arch = "wasm32")]
use crate::text::{compute_text_bounds_internal, measure_font_internal};
#[cfg(target_arch = "wasm32")]
use crate::path_utils::{is_point_in_path_fill, is_point_in_path_stroke, path_render_bounds};
#[cfg(target_arch = "wasm32")]
use crate::types::{
    CanvasRenderOptions, DropShadow, EllipseOptions, ExportViewOpts, GroupOptions,
    ImageRectOptions, JsShape, LineOptions, PathBoundsOptions, PathHitTestOptions,
    PathOptions, PolylineOptions, RectOptions, RoughEllipseOptions, RoughLineOptions,
    RoughPathOptions, RoughPolylineOptions, RoughRectOptions, StrokeAlignment, StrokeParams,
    TextOptions,
    default_font_family, default_font_kerning, default_font_size, default_font_style,
    default_font_variant, default_font_weight, default_linecap, default_linejoin,
    default_miter_limit, default_rgba_stroke,
    resolve_fill_gradients,
};

#[cfg(target_arch = "wasm32")]
use crate::renderer::run_all_canvases_async;

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = runWithCanvas)]
pub fn run_with_canvas(canvas: JsValue, on_ready: JsValue) {
    use wasm_bindgen::JsCast;
    let canvas: web_sys::HtmlCanvasElement = match canvas.dyn_into() {
        Ok(c) => c,
        Err(_) => {
            web_sys::console::error_1(
                &"[vello] runWithCanvas: 第一个参数必须是 HTMLCanvasElement".into(),
            );
            return;
        }
    };
    let on_ready: js_sys::Function = match on_ready.dyn_into() {
        Ok(f) => f,
        Err(_) => {
            web_sys::console::error_1(
                &"[vello] runWithCanvas: 第二个参数必须是函数 (canvasId) => void".into(),
            );
            return;
        }
    };
    PENDING_CANVASES.with(|c| {
        c.borrow_mut().push((canvas, on_ready));
    });
    if RUNNER_SCHEDULED.get() {
        return;
    }
    RUNNER_SCHEDULED.set(true);
    let closure = Closure::once(|| {
        wasm_bindgen_futures::spawn_local(run_all_canvases_async());
    });
    if let Ok(qmt) = js_sys::eval("queueMicrotask") {
        if let Some(f) = qmt.dyn_ref::<js_sys::Function>() {
            let _ = f.call1(&JsValue::NULL, closure.as_ref());
        }
    }
    closure.forget();
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addRect)]
pub fn js_add_rect(canvas_id: u32, opts: JsValue) {
    let o: RectOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("addRect: invalid options - {}", e).into());
            return;
        }
    };
    let stroke = o.stroke.as_ref().and_then(|s| {
        if s.width > 0.0 {
            Some(StrokeParams {
                width: s.width,
                color: s.color,
                linecap: s.linecap.clone(),
                linejoin: s.linejoin.clone(),
                miter_limit: s.miter_limit,
                stroke_dasharray: s.stroke_dasharray.clone(),
                stroke_dashoffset: s.stroke_dashoffset,
                alignment: StrokeAlignment::from_str(&s.alignment),
                blur: s.blur,
            })
        } else {
            None
        }
    });
    let fill_gradients = resolve_fill_gradients(&o.fill_gradient, &o.fill_gradients);
    let drop_shadow = o.drop_shadow.map(|ds| DropShadow {
        color: ds.color,
        blur: ds.blur,
        offset_x: ds.offset_x,
        offset_y: ds.offset_y,
    });
    push_shape(canvas_id, JsShape::Rect {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        ui: o.ui,
        x: o.x,
        y: o.y,
        width: o.width,
        height: o.height,
        radius: o.radius,
        fill: o.fill,
        fill_gradients,
        stroke,
        opacity: o.opacity,
        fill_opacity: o.fill_opacity,
        stroke_opacity: o.stroke_opacity,
        local_transform: o.local_transform,
        size_attenuation: o.size_attenuation,
        stroke_attenuation: o.stroke_attenuation,
        fill_blur: o.fill_blur,
        drop_shadow,
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addEllipse)]
pub fn js_add_ellipse(canvas_id: u32, opts: JsValue) {
    let o: EllipseOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("addEllipse: invalid options - {}", e).into());
            return;
        }
    };
    let stroke = o.stroke.as_ref().and_then(|s| {
        if s.width > 0.0 {
            Some(StrokeParams {
                width: s.width,
                color: s.color,
                linecap: s.linecap.clone(),
                linejoin: s.linejoin.clone(),
                miter_limit: s.miter_limit,
                stroke_dasharray: s.stroke_dasharray.clone(),
                stroke_dashoffset: s.stroke_dashoffset,
                alignment: StrokeAlignment::from_str(&s.alignment),
                blur: s.blur,
            })
        } else {
            None
        }
    });
    let fill_gradients = resolve_fill_gradients(&o.fill_gradient, &o.fill_gradients);
    let drop_shadow = o.drop_shadow.map(|ds| DropShadow {
        color: ds.color,
        blur: ds.blur,
        offset_x: ds.offset_x,
        offset_y: ds.offset_y,
    });
    push_shape(canvas_id, JsShape::Ellipse {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        ui: o.ui,
        cx: o.cx,
        cy: o.cy,
        rx: o.rx,
        ry: o.ry,
        fill: o.fill,
        fill_gradients,
        stroke,
        opacity: o.opacity,
        fill_opacity: o.fill_opacity,
        stroke_opacity: o.stroke_opacity,
        local_transform: o.local_transform,
        size_attenuation: o.size_attenuation,
        stroke_attenuation: o.stroke_attenuation,
        drop_shadow,
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addImageRect)]
pub fn js_add_image_rect(canvas_id: u32, opts: JsValue) {
    let image_data: Vec<u8> = js_sys::Reflect::get(&opts, &"imageData".into())
        .ok()
        .and_then(|v| v.dyn_into::<js_sys::Uint8Array>().ok())
        .map(|a| a.to_vec())
        .unwrap_or_default();
    let o: ImageRectOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("addImageRect: invalid options - {}", e).into());
            return;
        }
    };
    let stroke = o.stroke.as_ref().and_then(|s| {
        if s.width > 0.0 {
            Some(StrokeParams {
                width: s.width,
                color: s.color,
                linecap: s.linecap.clone(),
                linejoin: s.linejoin.clone(),
                miter_limit: s.miter_limit,
                stroke_dasharray: s.stroke_dasharray.clone(),
                stroke_dashoffset: s.stroke_dashoffset,
                alignment: StrokeAlignment::from_str(&s.alignment),
                blur: s.blur,
            })
        } else {
            None
        }
    });
    let drop_shadow = o.drop_shadow.map(|ds| DropShadow {
        color: ds.color,
        blur: ds.blur,
        offset_x: ds.offset_x,
        offset_y: ds.offset_y,
    });
    push_shape(canvas_id, JsShape::ImageRect {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        ui: o.ui,
        x: o.x,
        y: o.y,
        width: o.width,
        height: o.height,
        radius: o.radius,
        image_width: o.image_width,
        image_height: o.image_height,
        image_data,
        stroke,
        opacity: o.opacity,
        fill_opacity: o.fill_opacity,
        stroke_opacity: o.stroke_opacity,
        local_transform: o.local_transform,
        size_attenuation: o.size_attenuation,
        stroke_attenuation: o.stroke_attenuation,
        drop_shadow,
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addPath)]
pub fn js_add_path(canvas_id: u32, opts: JsValue) {
    let o: PathOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("addPath: invalid options - {}", e).into());
            return;
        }
    };
    let stroke = o.stroke.as_ref().and_then(|s| {
        if s.width > 0.0 {
            Some(StrokeParams {
                width: s.width,
                color: s.color,
                linecap: s.linecap.clone(),
                linejoin: s.linejoin.clone(),
                miter_limit: s.miter_limit,
                stroke_dasharray: s.stroke_dasharray.clone(),
                stroke_dashoffset: s.stroke_dashoffset,
                alignment: StrokeAlignment::from_str(&s.alignment),
                blur: s.blur,
            })
        } else {
            None
        }
    });
    let fill_gradients = resolve_fill_gradients(&o.fill_gradient, &o.fill_gradients);
    let drop_shadow = o.drop_shadow.map(|ds| DropShadow {
        color: ds.color,
        blur: ds.blur,
        offset_x: ds.offset_x,
        offset_y: ds.offset_y,
    });
    push_shape(canvas_id, JsShape::Path {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        ui: o.ui,
        d: o.d,
        fill: o.fill,
        fill_gradients,
        stroke,
        fill_rule: o.fill_rule,
        opacity: o.opacity,
        fill_opacity: o.fill_opacity,
        stroke_opacity: o.stroke_opacity,
        local_transform: o.local_transform,
        size_attenuation: o.size_attenuation,
        stroke_attenuation: o.stroke_attenuation,
        marker_start: o.marker_start,
        marker_end: o.marker_end,
        marker_factor: o.marker_factor,
        drop_shadow,
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addPolyline)]
pub fn js_add_polyline(canvas_id: u32, opts: JsValue) {
    let o: PolylineOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("addPolyline: invalid options - {}", e).into());
            return;
        }
    };
    let stroke = o.stroke.as_ref().map(|s| StrokeParams {
        width: s.width.max(0.5),
        color: s.color,
        linecap: s.linecap.clone(),
        linejoin: s.linejoin.clone(),
        miter_limit: s.miter_limit,
        stroke_dasharray: s.stroke_dasharray.clone(),
        stroke_dashoffset: s.stroke_dashoffset,
        alignment: StrokeAlignment::from_str(&s.alignment),
        blur: s.blur,
    }).unwrap_or_else(|| StrokeParams {
        width: 1.0,
        color: default_rgba_stroke(),
        linecap: default_linecap(),
        linejoin: default_linejoin(),
        miter_limit: default_miter_limit(),
        stroke_dasharray: None,
        stroke_dashoffset: 0.0,
        alignment: StrokeAlignment::Center,
        blur: 0.0,
    });
    push_shape(canvas_id, JsShape::Polyline {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        ui: o.ui,
        points: o.points,
        stroke: Some(stroke),
        opacity: o.opacity,
        fill_opacity: o.fill_opacity,
        stroke_opacity: o.stroke_opacity,
        local_transform: o.local_transform,
        size_attenuation: o.size_attenuation,
        stroke_attenuation: o.stroke_attenuation,
        marker_start: o.marker_start,
        marker_end: o.marker_end,
        marker_factor: o.marker_factor,
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addGroup)]
pub fn js_add_group(canvas_id: u32, opts: JsValue) {
    let o: GroupOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("addGroup: invalid options - {}", e).into());
            return;
        }
    };
    push_shape(canvas_id, JsShape::Group {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        ui: o.ui,
        local_transform: o.local_transform,
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addRoughRect)]
pub fn js_add_rough_rect(canvas_id: u32, opts: JsValue) {
    let o: RoughRectOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("addRoughRect: invalid options - {}", e).into());
            return;
        }
    };
    let stroke = o.stroke.as_ref().and_then(|s| {
        if s.width > 0.0 {
            Some(StrokeParams {
                width: s.width,
                color: s.color,
                linecap: s.linecap.clone(),
                linejoin: s.linejoin.clone(),
                miter_limit: s.miter_limit,
                stroke_dasharray: s.stroke_dasharray.clone(),
                stroke_dashoffset: s.stroke_dashoffset,
                alignment: StrokeAlignment::from_str(&s.alignment),
                blur: s.blur,
            })
        } else {
            None
        }
    });
    push_shape(canvas_id, JsShape::RoughRect {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        ui: o.ui,
        x: o.x,
        y: o.y,
        width: o.width,
        height: o.height,
        fill: o.fill,
        stroke,
        opacity: o.opacity,
        fill_opacity: o.fill_opacity,
        stroke_opacity: o.stroke_opacity,
        local_transform: o.local_transform,
        roughness: o.roughness,
        bowing: o.bowing,
        fill_style: o.fill_style.as_str().to_string(),
        hachure_angle: o.hachure_angle,
        hachure_gap: o.hachure_gap,
        fill_weight: o.fill_weight,
        curve_step_count: o.curve_step_count,
        simplification: o.simplification,
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addRoughEllipse)]
pub fn js_add_rough_ellipse(canvas_id: u32, opts: JsValue) {
    let o: RoughEllipseOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("addRoughEllipse: invalid options - {}", e).into());
            return;
        }
    };
    let stroke = o.stroke.as_ref().and_then(|s| {
        if s.width > 0.0 {
            Some(StrokeParams {
                width: s.width,
                color: s.color,
                linecap: s.linecap.clone(),
                linejoin: s.linejoin.clone(),
                miter_limit: s.miter_limit,
                stroke_dasharray: s.stroke_dasharray.clone(),
                stroke_dashoffset: s.stroke_dashoffset,
                alignment: StrokeAlignment::from_str(&s.alignment),
                blur: s.blur,
            })
        } else {
            None
        }
    });
    push_shape(canvas_id, JsShape::RoughEllipse {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        ui: o.ui,
        cx: o.cx,
        cy: o.cy,
        rx: o.rx,
        ry: o.ry,
        fill: o.fill,
        stroke,
        opacity: o.opacity,
        fill_opacity: o.fill_opacity,
        stroke_opacity: o.stroke_opacity,
        local_transform: o.local_transform,
        roughness: o.roughness,
        bowing: o.bowing,
        fill_style: o.fill_style.as_str().to_string(),
        hachure_angle: o.hachure_angle,
        hachure_gap: o.hachure_gap,
        fill_weight: o.fill_weight,
        curve_step_count: o.curve_step_count,
        simplification: o.simplification,
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addRoughLine)]
pub fn js_add_rough_line(canvas_id: u32, opts: JsValue) {
    let o: RoughLineOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("addRoughLine: invalid options - {}", e).into());
            return;
        }
    };
    let stroke = o.stroke.as_ref().map(|s| StrokeParams {
        width: s.width.max(0.5),
        color: s.color,
        linecap: s.linecap.clone(),
        linejoin: s.linejoin.clone(),
        miter_limit: s.miter_limit,
        stroke_dasharray: s.stroke_dasharray.clone(),
        stroke_dashoffset: s.stroke_dashoffset,
        alignment: StrokeAlignment::from_str(&s.alignment),
        blur: s.blur,
    }).unwrap_or_else(|| StrokeParams {
        width: 1.0,
        color: default_rgba_stroke(),
        linecap: default_linecap(),
        linejoin: default_linejoin(),
        miter_limit: default_miter_limit(),
        stroke_dasharray: None,
        stroke_dashoffset: 0.0,
        alignment: StrokeAlignment::Center,
        blur: 0.0,
    });
    push_shape(canvas_id, JsShape::RoughLine {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        ui: o.ui,
        x1: o.x1,
        y1: o.y1,
        x2: o.x2,
        y2: o.y2,
        stroke,
        opacity: o.opacity,
        stroke_opacity: o.stroke_opacity,
        local_transform: o.local_transform,
        roughness: o.roughness,
        bowing: o.bowing,
        simplification: o.simplification,
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addRoughPolyline)]
pub fn js_add_rough_polyline(canvas_id: u32, opts: JsValue) {
    let o: RoughPolylineOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("addRoughPolyline: invalid options - {}", e).into());
            return;
        }
    };
    let stroke = o.stroke.as_ref().and_then(|s| {
        if s.width > 0.0 {
            Some(StrokeParams {
                width: s.width,
                color: s.color,
                linecap: s.linecap.clone(),
                linejoin: s.linejoin.clone(),
                miter_limit: s.miter_limit,
                stroke_dasharray: s.stroke_dasharray.clone(),
                stroke_dashoffset: s.stroke_dashoffset,
                alignment: StrokeAlignment::from_str(&s.alignment),
                blur: s.blur,
            })
        } else {
            None
        }
    });
    push_shape(canvas_id, JsShape::RoughPolyline {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        ui: o.ui,
        points: o.points,
        fill: o.fill,
        stroke,
        opacity: o.opacity,
        fill_opacity: o.fill_opacity,
        stroke_opacity: o.stroke_opacity,
        local_transform: o.local_transform,
        roughness: o.roughness,
        bowing: o.bowing,
        fill_style: o.fill_style.as_str().to_string(),
        hachure_angle: o.hachure_angle,
        hachure_gap: o.hachure_gap,
        fill_weight: o.fill_weight,
        curve_step_count: o.curve_step_count,
        simplification: o.simplification,
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addRoughPath)]
pub fn js_add_rough_path(canvas_id: u32, opts: JsValue) {
    let o: RoughPathOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("addRoughPath: invalid options - {}", e).into());
            return;
        }
    };
    let stroke = o.stroke.as_ref().and_then(|s| {
        if s.width > 0.0 {
            Some(StrokeParams {
                width: s.width,
                color: s.color,
                linecap: s.linecap.clone(),
                linejoin: s.linejoin.clone(),
                miter_limit: s.miter_limit,
                stroke_dasharray: s.stroke_dasharray.clone(),
                stroke_dashoffset: s.stroke_dashoffset,
                alignment: StrokeAlignment::from_str(&s.alignment),
                blur: s.blur,
            })
        } else {
            None
        }
    });
    push_shape(canvas_id, JsShape::RoughPath {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        ui: o.ui,
        d: o.d,
        fill: o.fill,
        stroke,
        fill_rule: o.fill_rule,
        opacity: o.opacity,
        fill_opacity: o.fill_opacity,
        stroke_opacity: o.stroke_opacity,
        local_transform: o.local_transform,
        roughness: o.roughness,
        bowing: o.bowing,
        fill_style: o.fill_style.as_str().to_string(),
        hachure_angle: o.hachure_angle,
        hachure_gap: o.hachure_gap,
        fill_weight: o.fill_weight,
        curve_step_count: o.curve_step_count,
        simplification: o.simplification,
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addLine)]
pub fn js_add_line(canvas_id: u32, opts: JsValue) {
    let o: LineOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("addLine: invalid options - {}", e).into());
            return;
        }
    };
    let stroke = o.stroke.as_ref().map(|s| StrokeParams {
        width: s.width.max(0.5),
        color: s.color,
        linecap: s.linecap.clone(),
        linejoin: s.linejoin.clone(),
        miter_limit: s.miter_limit,
        stroke_dasharray: s.stroke_dasharray.clone(),
        stroke_dashoffset: s.stroke_dashoffset,
        alignment: StrokeAlignment::from_str(&s.alignment),
        blur: s.blur,
    }).unwrap_or_else(|| StrokeParams {
        width: 1.0,
        color: default_rgba_stroke(),
        linecap: default_linecap(),
        linejoin: default_linejoin(),
        miter_limit: default_miter_limit(),
        stroke_dasharray: None,
        stroke_dashoffset: 0.0,
        alignment: StrokeAlignment::Center,
        blur: 0.0,
    });
    push_shape(canvas_id, JsShape::Line {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        ui: o.ui,
        x1: o.x1,
        y1: o.y1,
        x2: o.x2,
        y2: o.y2,
        stroke,
        opacity: o.opacity,
        stroke_opacity: o.stroke_opacity,
        local_transform: o.local_transform,
        size_attenuation: o.size_attenuation,
        stroke_attenuation: o.stroke_attenuation,
        marker_start: o.marker_start,
        marker_end: o.marker_end,
        marker_factor: o.marker_factor,
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addText)]
pub fn js_add_text(canvas_id: u32, opts: JsValue) {
    let o: TextOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("addText: invalid options - {}", e).into());
            return;
        }
    };

    let stroke = o.stroke.as_ref().and_then(|s| {
        if s.width > 0.0 {
            Some(StrokeParams {
                width: s.width,
                color: s.color,
                linecap: s.linecap.clone(),
                linejoin: s.linejoin.clone(),
                miter_limit: s.miter_limit,
                stroke_dasharray: s.stroke_dasharray.clone(),
                stroke_dashoffset: s.stroke_dashoffset,
                alignment: StrokeAlignment::from_str(&s.alignment),
                blur: s.blur,
            })
        } else {
            None
        }
    });

    push_shape(canvas_id, JsShape::Text {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        ui: o.ui,
        anchor_x: o.anchor_x,
        anchor_y: o.anchor_y,
        content: o.content,
        font_family: o.font_family,
        font_size: o.font_size,
        font_weight: o.font_weight,
        font_style: o.font_style,
        font_variant: o.font_variant,
        letter_spacing: o.letter_spacing,
        line_height: o.line_height,
        font_kerning: o.font_kerning,
        white_space: o.white_space,
        word_wrap: o.word_wrap,
        word_wrap_width: o.word_wrap_width,
        text_overflow: o.text_overflow,
        max_lines: o.max_lines,
        text_align: o.text_align,
        text_baseline: o.text_baseline,
        leading: o.leading,
        fill: o.fill,
        stroke,
        opacity: o.opacity,
        fill_opacity: o.fill_opacity,
        stroke_opacity: o.stroke_opacity,
        local_transform: o.local_transform,
        size_attenuation: o.size_attenuation,
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = computeTextBounds)]
pub fn js_compute_text_bounds(opts: JsValue) -> JsValue {
    let o: TextOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("computeTextBounds: invalid options - {}", e).into());
            return JsValue::NULL;
        }
    };

    match compute_text_bounds_internal(&o) {
        Some(bounds) => match serde_wasm_bindgen::to_value(&bounds) {
            Ok(v) => v,
            Err(e) => {
                web_sys::console::error_1(
                    &format!("computeTextBounds: failed to serialize result - {}", e).into(),
                );
                JsValue::NULL
            }
        },
        None => JsValue::NULL,
    }
}

#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeasureFontOptions {
    #[serde(default = "default_font_family")]
    pub font_family: String,
    #[serde(default = "default_font_size")]
    pub font_size: f64,
    #[serde(default = "default_font_weight")]
    pub font_weight: String,
    #[serde(default = "default_font_style")]
    pub font_style: String,
    #[serde(default = "default_font_variant")]
    pub font_variant: String,
    #[serde(default = "default_font_kerning")]
    pub font_kerning: bool,
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = measureFont)]
pub fn js_measure_font(opts: JsValue) -> JsValue {
    let o: MeasureFontOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("measureFont: invalid options - {}", e).into());
            return JsValue::NULL;
        }
    };

    let metrics = measure_font_internal(
        &o.font_family,
        o.font_size as f32,
        &o.font_weight,
        &o.font_style,
        &o.font_variant,
        o.font_kerning,
    );

    match metrics {
        Some(m) => match serde_wasm_bindgen::to_value(&m) {
            Ok(v) => v,
            Err(e) => {
                web_sys::console::error_1(
                    &format!("measureFont: failed to serialize result - {}", e).into(),
                );
                JsValue::NULL
            }
        },
        None => JsValue::NULL,
    }
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = hitTestPath)]
pub fn js_hit_test_path(opts: JsValue) -> bool {
    let o: PathHitTestOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("hitTestPath: invalid options - {}", e).into());
            return false;
        }
    };

    let stroke = o.stroke.as_ref().and_then(|s| {
        if s.width > 0.0 {
            Some(StrokeParams {
                width: s.width,
                color: s.color,
                linecap: s.linecap.clone(),
                linejoin: s.linejoin.clone(),
                miter_limit: s.miter_limit,
                stroke_dasharray: s.stroke_dasharray.clone(),
                stroke_dashoffset: s.stroke_dashoffset,
                alignment: StrokeAlignment::from_str(&s.alignment),
                blur: s.blur,
            })
        } else {
            None
        }
    });

    if stroke.is_some() && !o.fill {
        is_point_in_path_stroke(&o.d, o.x, o.y, stroke.as_ref().unwrap())
    } else if o.fill {
        is_point_in_path_fill(&o.d, o.x, o.y, &o.fill_rule)
    } else {
        false
    }
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = computePathBounds)]
pub fn js_compute_path_bounds(opts: JsValue) -> JsValue {
    let o: PathBoundsOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("computePathBounds: invalid options - {}", e).into());
            return JsValue::NULL;
        }
    };

    let stroke = o.stroke.as_ref().and_then(|s| {
        if s.width > 0.0 {
            Some(StrokeParams {
                width: s.width,
                color: s.color,
                linecap: s.linecap.clone(),
                linejoin: s.linejoin.clone(),
                miter_limit: s.miter_limit,
                stroke_dasharray: s.stroke_dasharray.clone(),
                stroke_dashoffset: s.stroke_dashoffset,
                alignment: StrokeAlignment::from_str(&s.alignment),
                blur: s.blur,
            })
        } else {
            None
        }
    });

    let Some(rect) = path_render_bounds(
        &o.d,
        stroke.as_ref(),
        &o.marker_start,
        &o.marker_end,
        o.marker_factor,
    ) else { return JsValue::NULL; };

    use crate::types::Bounds;
    let out = Bounds {
        min_x: rect.x0,
        min_y: rect.y0,
        max_x: rect.x1,
        max_y: rect.y1,
    };

    match serde_wasm_bindgen::to_value(&out) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(
                &format!("computePathBounds: failed to serialize result - {}", e).into(),
            );
            JsValue::NULL
        }
    }
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = registerFont)]
pub fn js_register_font(js_value: JsValue) {
    let bytes = js_sys::Uint8Array::new(&js_value).to_vec();
    FONT_BYTES.with(|c| {
        c.borrow_mut().push(bytes);
    });
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = clearShapes)]
pub fn js_clear_shapes(canvas_id: u32) {
    clear_shapes_for_canvas(canvas_id);
    // 同一帧内的 camera 重绘不应触发清理；该函数只会在 JS 重建 shapes 时调用。
    // 清理 ImageRect 缓存可避免 shape id 复用导致的纹理过期。
    clear_image_brush_cache();
}

#[cfg(target_arch = "wasm32")]
fn default_scale() -> f64 {
    1.0
}

#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CameraTransformOptions {
    #[serde(default)]
    pub x: f64,
    #[serde(default)]
    pub y: f64,
    #[serde(default = "default_scale")]
    pub scale: f64,
    #[serde(default)]
    pub rotation: f64,
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = setCameraTransform)]
pub fn js_set_camera_transform(canvas_id: u32, opts: JsValue) {
    let o: CameraTransformOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("setCameraTransform: invalid options - {}", e).into());
            return;
        }
    };
    let affine = Affine::scale(o.scale)
        * Affine::rotate(o.rotation)
        * Affine::translate(Vec2::new(o.x, o.y));
    CAMERA_TRANSFORM_PENDING.with(|c| {
        c.borrow_mut().insert(canvas_id, affine);
    });
    if let Some(w) = CANVAS_WINDOWS.with(|c| c.borrow().get(&canvas_id).cloned()) {
        w.request_redraw();
    }
}

#[cfg(target_arch = "wasm32")]
fn default_canvas_grid() -> bool {
    true
}

#[cfg(target_arch = "wasm32")]
fn default_canvas_ui() -> bool {
    true
}

#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasRenderOptionsInput {
    #[serde(default = "default_canvas_grid")]
    pub grid: bool,
    #[serde(default = "default_canvas_ui")]
    pub ui: bool,
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = setCanvasRenderOptions)]
pub fn js_set_canvas_render_options(canvas_id: u32, opts: JsValue) {
    let o: CanvasRenderOptionsInput = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(
                &format!("setCanvasRenderOptions: invalid options - {}", e).into(),
            );
            return;
        }
    };

    let render_opts = CanvasRenderOptions { grid: o.grid, ui: o.ui };
    CANVAS_RENDER_OPTIONS_PENDING.with(|c| {
        c.borrow_mut().insert(canvas_id, render_opts);
    });

    if let Some(w) = CANVAS_WINDOWS.with(|c| c.borrow().get(&canvas_id).cloned()) {
        w.request_redraw();
    }
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = setExportView)]
pub fn js_set_export_view(canvas_id: u32, opts: JsValue, on_rendered: JsValue) {
    let o: ExportViewOpts = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(
                &format!("setExportView: invalid options - {}", e).into(),
            );
            return;
        }
    };
    let on_rendered: js_sys::Function = match on_rendered.dyn_into() {
        Ok(f) => f,
        Err(_) => {
            web_sys::console::error_1(
                &"[vello] setExportView: third argument must be function (canvasId) => void".into(),
            );
            return;
        }
    };
    EXPORT_VIEW_PENDING.with(|c| {
        c.borrow_mut().insert(canvas_id, (o, on_rendered));
    });
    if let Some(w) = CANVAS_WINDOWS.with(|c| c.borrow().get(&canvas_id).cloned()) {
        w.request_redraw();
    }
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = restoreCanvasAfterExport)]
pub fn js_restore_canvas_after_export(canvas_id: u32) {
    RESTORE_PENDING.with(|c| {
        c.borrow_mut().insert(canvas_id, ());
    });
    if let Some(w) = CANVAS_WINDOWS.with(|c| c.borrow().get(&canvas_id).cloned()) {
        w.request_redraw();
    }
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = clearEmojiCache)]
pub fn js_clear_emoji_cache() {
    EMOJI_CACHE.with(|c| c.borrow_mut().clear());
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = clearGlyphCache)]
pub fn js_clear_glyph_cache() {
    GLYPH_CACHE.with(|c| c.borrow_mut().clear());
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = clearAllCaches)]
pub fn js_clear_all_caches() {
    EMOJI_CACHE.with(|c| c.borrow_mut().clear());
    GLYPH_CACHE.with(|c| c.borrow_mut().clear());
}
