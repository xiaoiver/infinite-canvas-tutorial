#[cfg(target_arch = "wasm32")]
use serde::Serialize;
use std::sync::Arc;

#[cfg(target_arch = "wasm32")]
use crate::state::{EMOJI_CACHE, FONT_BYTES, FONT_CONTEXT, GLYPH_CACHE, LAST_REGISTERED_FONT_FINGERPRINT};
#[cfg(target_arch = "wasm32")]
use crate::types::{TextBounds, TextOptions};

#[cfg(target_arch = "wasm32")]
#[derive(Debug, Clone)]
pub struct EmojiPosition {
    pub emoji: String,
    pub x: f64,
    pub y: f64,
}

#[cfg(target_arch = "wasm32")]
fn is_emoji(ch: char) -> bool {
    match ch as u32 {
        0x1F600..=0x1F64F
        | 0x1F300..=0x1F5FF
        | 0x1F680..=0x1F6FF
        | 0x1F1E0..=0x1F1FF
        | 0x2600..=0x26FF
        | 0x2700..=0x27BF
        | 0x1F900..=0x1F9FF
        | 0x1FA00..=0x1FA6F
        | 0x1FA70..=0x1FAFF
        | 0xFE00..=0xFE0F
        | 0x200D
        | 0x20E3
        => true,
        _ => false,
    }
}

#[cfg(target_arch = "wasm32")]
fn extract_emoji_at(text: &str, byte_pos: usize) -> Option<(String, usize)> {
    use unicode_segmentation::UnicodeSegmentation;
    let graphemes: Vec<&str> = text.graphemes(true).collect();
    let mut current_pos = 0;
    for g in graphemes {
        let g_bytes = g.len();
        if current_pos == byte_pos {
            let has_emoji = g.chars().any(|c| is_emoji(c));
            if has_emoji {
                return Some((g.to_string(), g_bytes));
            }
            return None;
        }
        current_pos += g_bytes;
    }
    None
}

#[cfg(target_arch = "wasm32")]
pub fn font_bytes_fingerprint(bytes: &[u8]) -> u64 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    bytes.len().hash(&mut hasher);
    let n = bytes.len().min(256);
    if n > 0 {
        bytes[..n].hash(&mut hasher);
        let tail = bytes.len().saturating_sub(256);
        if tail > n {
            bytes[tail..].hash(&mut hasher);
        }
    }
    hasher.finish()
}

#[cfg(target_arch = "wasm32")]
pub fn get_or_create_emoji_image(emoji: &str, size: u32) -> Option<(Vec<u8>, u32, u32)> {
    let cache_key = format!("{}_{}", emoji, size);
    let cached = EMOJI_CACHE.with(|c| c.borrow().get(&cache_key).cloned());
    if let Some(data) = cached {
        return Some(data);
    }

    let document = web_sys::window()?.document()?;
    use wasm_bindgen::JsCast;
    let canvas = document.create_element("canvas").ok()?.dyn_into::<web_sys::HtmlCanvasElement>().ok()?;

    let dpr = web_sys::window()?.device_pixel_ratio() as f32;
    let canvas_size = (size as f32 * dpr).ceil() as u32;
    canvas.set_width(canvas_size);
    canvas.set_height(canvas_size);

    let ctx = canvas.get_context("2d").ok()??.dyn_into::<web_sys::CanvasRenderingContext2d>().ok()?;
    ctx.scale(dpr as f64, dpr as f64).ok()?;
    ctx.clear_rect(0.0, 0.0, size as f64, size as f64);
    ctx.set_text_align("center");
    ctx.set_text_baseline("middle");
    ctx.set_font(&format!("{}px sans-serif", size));
    ctx.fill_text(emoji, (size / 2) as f64, (size / 2) as f64).ok()?;

    let image_data = ctx.get_image_data(0.0, 0.0, canvas_size as f64, canvas_size as f64).ok()?;
    let rgba: Vec<u8> = image_data.data().to_vec();
    let result = (rgba, canvas_size, canvas_size);

    EMOJI_CACHE.with(|c| {
        c.borrow_mut().insert(cache_key, result.clone());
    });
    Some(result)
}

#[cfg(target_arch = "wasm32")]
pub fn font_variant_to_features(variant: &str) -> Vec<parley::style::FontFeature> {
    use parley::style::FontFeature;
    let v = variant.to_lowercase();
    let v = v.trim();
    if v.is_empty() || v == "normal" { return Vec::new(); }
    let mut out = Vec::new();
    for part in v.split(|c: char| c == ' ' || c == ',') {
        let part = part.trim();
        if part == "small-caps" {
            if let Some(f) = FontFeature::parse("smcp=1") { out.push(f); }
        } else if part == "all-small-caps" {
            if let Some(f) = FontFeature::parse("smcp=1") { out.push(f); }
            if let Some(f) = FontFeature::parse("c2sc=1") { out.push(f); }
        } else if part == "tabular-nums" {
            if let Some(f) = FontFeature::parse("tnum=1") { out.push(f); }
        } else if part == "lining-nums" {
            if let Some(f) = FontFeature::parse("lnum=1") { out.push(f); }
        } else if part == "oldstyle-nums" {
            if let Some(f) = FontFeature::parse("onum=1") { out.push(f); }
        }
    }
    out
}

#[cfg(target_arch = "wasm32")]
pub fn text_align_to_parley(align: &str) -> parley::Alignment {
    let a = align.trim();
    if a.eq_ignore_ascii_case("center") {
        parley::Alignment::Center
    } else if a.eq_ignore_ascii_case("end") || a.eq_ignore_ascii_case("right") {
        parley::Alignment::End
    } else {
        parley::Alignment::Start
    }
}

#[cfg(target_arch = "wasm32")]
pub fn build_text_glyphs_with_emoji_positions(
    content: &str,
    font_size_px: f32,
    letter_spacing: f32,
    line_height_px: f32,
    font_kerning: bool,
    font_family: &str,
    font_weight: &str,
    font_style: &str,
    font_variant: &str,
    word_wrap: bool,
    word_wrap_width: f64,
    text_align: &str,
) -> Option<(Vec<(vello::peniko::FontData, Vec<vello::Glyph>)>, f32, Vec<EmojiPosition>, Option<(f32, f32, f32, f32)>)> {
    use std::borrow::Cow;
    use parley::fontique::Blob;
    use parley::layout::PositionedLayoutItem;
    use parley::style::{FontFamily, FontFeature, FontSettings, FontStyle, FontWeight, OverflowWrap, WordBreakStrength};
    use parley::{AlignmentOptions, LayoutContext, LineHeight, StyleProperty};

    let font_bytes_list = FONT_BYTES.with(|c| c.borrow().clone());
    if font_bytes_list.is_empty() { return None; }

    FONT_CONTEXT.with(|fc| {
        let mut font_cx_ref = fc.borrow_mut();
        if font_cx_ref.is_none() {
            *font_cx_ref = Some(parley::FontContext::new());
        }
        let font_cx = font_cx_ref.as_mut()?;

        let fonts_for_fp: Vec<(u64, Vec<u8>)> = font_bytes_list
            .iter()
            .map(|bytes| (font_bytes_fingerprint(bytes), bytes.clone()))
            .collect();
        if fonts_for_fp.is_empty() { return None; }

        let mut fps_sorted: Vec<u64> = fonts_for_fp.iter().map(|(fp, _)| *fp).collect();
        fps_sorted.sort_unstable();
        let mut combined_fp: u64 = 0;
        for fp in &fps_sorted {
            combined_fp = combined_fp.wrapping_mul(1315423911) ^ *fp;
        }
        let need_register = LAST_REGISTERED_FONT_FINGERPRINT.with(|r| {
            let mut ref_mut = r.borrow_mut();
            let prev = *ref_mut;
            if prev != Some(combined_fp) {
                *ref_mut = Some(combined_fp);
                true
            } else {
                false
            }
        });
        if need_register {
            font_cx.collection.clear();
            GLYPH_CACHE.with(|c| c.borrow_mut().clear());
            for (_, bytes) in &fonts_for_fp {
                let font_blob = Blob::new(Arc::new(bytes.clone()));
                font_cx.collection.register_fonts(font_blob, None);
            }
        }

        let requested = font_family.trim();
        let family_names: Vec<String> = font_cx.collection.family_names().map(|s| s.to_string()).collect();
        let fallback_family = family_names.first().cloned().unwrap_or_else(|| "sans-serif".to_string());
        let family_name = if requested.is_empty() {
            fallback_family
        } else {
            family_names
                .iter()
                .find(|n| n.eq_ignore_ascii_case(requested) || n.starts_with(requested))
                .cloned()
                .unwrap_or_else(|| fallback_family)
        };

        let mut layout_cx = LayoutContext::new();
        let mut glyph_runs: Vec<(vello::peniko::FontData, Vec<vello::Glyph>)> = Vec::new();
        let mut emoji_positions = Vec::new();
        let mut line_y = 0.0f32;
        let mut layout_min_x = f32::INFINITY;
        let mut layout_min_y = f32::INFINITY;
        let mut layout_max_x = f32::NEG_INFINITY;
        let mut layout_max_y = f32::NEG_INFINITY;

        let line_segments: Vec<&str> = content.split('\n').collect();

        for segment in line_segments {
            if segment.is_empty() {
                line_y += if line_height_px > 0.0 { line_height_px } else { font_size_px };
                continue;
            }

            let mut builder = layout_cx.ranged_builder(font_cx, segment, 1.0, true);
            builder.push_default(FontFamily::Named(Cow::Borrowed(&family_name)));
            builder.push_default(if line_height_px > 0.0 {
                LineHeight::Absolute(line_height_px)
            } else {
                LineHeight::FontSizeRelative(1.0)
            });
            builder.push_default(StyleProperty::FontSize(font_size_px));
            if let Some(w) = FontWeight::parse(font_weight.trim()) {
                builder.push_default(StyleProperty::FontWeight(w));
            }
            if let Some(s) = FontStyle::parse(font_style.trim()) {
                builder.push_default(StyleProperty::FontStyle(s));
            }
            let mut font_features = font_variant_to_features(font_variant.trim());
            if !font_kerning {
                if let Some(kern_off) = FontFeature::parse("kern=0") {
                    font_features.push(kern_off);
                }
            }
            if !font_features.is_empty() {
                builder.push_default(StyleProperty::FontFeatures(FontSettings::List(Cow::Owned(font_features))));
            }
            if letter_spacing != 0.0 {
                builder.push_default(StyleProperty::LetterSpacing(letter_spacing));
            }
            if word_wrap && word_wrap_width > 0.0 {
                builder.push_default(StyleProperty::WordBreak(WordBreakStrength::BreakAll));
                builder.push_default(StyleProperty::OverflowWrap(OverflowWrap::Anywhere));
            }

            let mut layout: parley::Layout<()> = builder.build(segment);
            let max_advance = if word_wrap && word_wrap_width > 0.0 {
                Some(word_wrap_width as f32)
            } else {
                None
            };
            layout.break_all_lines(max_advance);
            let alignment = text_align_to_parley(text_align);
            let align_width = max_advance.or_else(|| {
                let w = layout.width();
                if w > 0.0 { Some(w) } else { None }
            });
            layout.align(align_width, alignment, AlignmentOptions::default());

            let segment_char_indices: Vec<(usize, char)> = segment.char_indices().collect();
            let mut char_idx = 0usize;

            let segment_lines: Vec<_> = layout.lines().collect();
            for line in segment_lines {
                let line_min_y = line_y + line.metrics().min_coord;
                let line_max_y = line_y + line.metrics().max_coord;
                layout_min_y = layout_min_y.min(line_min_y);
                layout_max_y = layout_max_y.max(line_max_y);

                for item in line.items() {
                    if let PositionedLayoutItem::GlyphRun(run) = item {
                        let run_min_x = run.offset();
                        let run_max_x = run.offset() + run.advance();
                        layout_min_x = layout_min_x.min(run_min_x);
                        layout_max_x = layout_max_x.max(run_max_x);

                        let font_ref = run.run().font();
                        let bytes = font_ref.data.data().to_vec();
                        let blob = vello::peniko::Blob::from(bytes);
                        let font_data = vello::peniko::FontData::new(blob, font_ref.index);

                        let mut run_glyphs = Vec::new();
                        for g in run.positioned_glyphs() {
                            if char_idx >= segment_char_indices.len() {
                                break;
                            }
                            let (_byte_pos, ch) = segment_char_indices[char_idx];
                            char_idx += 1;

                            if is_emoji(ch) {
                                let emoji_str = extract_emoji_at(segment, segment_char_indices[char_idx - 1].0)
                                    .map(|(s, _)| s)
                                    .unwrap_or_else(|| ch.to_string());
                                emoji_positions.push(EmojiPosition {
                                    emoji: emoji_str,
                                    x: g.x as f64,
                                    y: (line_y + g.y) as f64,
                                });
                            } else {
                                run_glyphs.push(vello::Glyph {
                                    id: g.id,
                                    x: g.x,
                                    y: line_y + g.y,
                                });
                            }
                        }
                        if !run_glyphs.is_empty() {
                            glyph_runs.push((font_data, run_glyphs));
                        }
                    }
                }

                let content_h = line.metrics().max_coord - line.metrics().min_coord;
                let line_advance = if line_height_px > 0.0 {
                    let parley_lh = line.metrics().line_height;
                    content_h.max(parley_lh.min(line_height_px))
                } else {
                    content_h
                };
                line_y += line_advance;
            }
        }

        let layout_bounds = if layout_min_x.is_finite() && layout_min_y.is_finite()
            && layout_max_x.is_finite() && layout_max_y.is_finite()
        {
            Some((layout_min_x, layout_min_y, layout_max_x, layout_max_y))
        } else {
            None
        };

        Some((glyph_runs, font_size_px, emoji_positions, layout_bounds))
    })
}

#[cfg(target_arch = "wasm32")]
pub fn compute_text_bounds_internal(opts: &TextOptions) -> Option<TextBounds> {
    let font_size_eff = opts.font_size as f32;
    let letter_spacing_eff = opts.letter_spacing as f32;
    let line_height_px = opts.line_height as f32;

    let (glyph_runs, size_px, emoji_positions, layout_bounds) = build_text_glyphs_with_emoji_positions(
        &opts.content,
        font_size_eff,
        letter_spacing_eff,
        line_height_px,
        opts.font_kerning,
        &opts.font_family,
        &opts.font_weight,
        &opts.font_style,
        &opts.font_variant,
        opts.word_wrap,
        opts.word_wrap_width,
        &opts.text_align,
    )?;

    if glyph_runs.is_empty() && emoji_positions.is_empty() {
        return Some(TextBounds { min_x: 0.0, min_y: 0.0, max_x: 0.0, max_y: 0.0 });
    }

    let fs = size_px as f64;

    let (mut min_x, mut min_y, mut max_x, mut max_y) = match layout_bounds {
        Some((lx, ly, rx, ry)) => (lx as f64, ly as f64, rx as f64, ry as f64),
        None => {
            let mut mx = f64::INFINITY;
            let mut my = f64::INFINITY;
            let mut rx = f64::NEG_INFINITY;
            let mut ry = f64::NEG_INFINITY;
            for (_fd, run_glyphs) in &glyph_runs {
                for g in run_glyphs {
                    let gx = g.x as f64;
                    let gy = g.y as f64;
                    mx = mx.min(gx);
                    my = my.min(gy - fs * 0.8);
                    rx = rx.max(gx + fs * 0.6);
                    ry = ry.max(gy + fs * 0.2);
                }
            }
            (mx, my, rx, ry)
        }
    };

    for emoji in &emoji_positions {
        let ex = emoji.x;
        let ey = emoji.y;
        min_x = min_x.min(ex - fs * 0.5);
        min_y = min_y.min(ey - fs);
        max_x = max_x.max(ex + fs * 0.5);
        max_y = max_y.max(ey);
    }

    if !min_x.is_finite() || !min_y.is_finite() || !max_x.is_finite() || !max_y.is_finite() {
        return Some(TextBounds { min_x: 0.0, min_y: 0.0, max_x: 0.0, max_y: 0.0 });
    }

    Some(TextBounds { min_x, min_y, max_x, max_y })
}

#[cfg(target_arch = "wasm32")]
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FontMetrics {
    pub font_bounding_box_ascent: f64,
    pub font_bounding_box_descent: f64,
    pub font_size: f64,
}

#[cfg(target_arch = "wasm32")]
pub fn measure_font_internal(
    font_family: &str,
    font_size_px: f32,
    font_weight: &str,
    font_style: &str,
    font_variant: &str,
    font_kerning: bool,
) -> Option<FontMetrics> {
    use std::borrow::Cow;
    use parley::fontique::Blob;
    use parley::style::{FontFamily, FontFeature, FontSettings, FontStyle, FontWeight};
    use parley::{AlignmentOptions, LayoutContext, LineHeight, StyleProperty};

    let font_bytes_list = FONT_BYTES.with(|c| c.borrow().clone());
    if font_bytes_list.is_empty() { return None; }

    FONT_CONTEXT.with(|fc| {
        let mut font_cx_ref = fc.borrow_mut();
        if font_cx_ref.is_none() {
            *font_cx_ref = Some(parley::FontContext::new());
        }
        let font_cx = font_cx_ref.as_mut()?;

        let fonts_for_fp: Vec<(u64, Vec<u8>)> = font_bytes_list
            .iter()
            .map(|bytes| (font_bytes_fingerprint(bytes), bytes.clone()))
            .collect();
        let mut fps_sorted: Vec<u64> = fonts_for_fp.iter().map(|(fp, _)| *fp).collect();
        fps_sorted.sort_unstable();
        let mut combined_fp: u64 = 0;
        for fp in &fps_sorted {
            combined_fp = combined_fp.wrapping_mul(1315423911) ^ *fp;
        }
        let need_register = LAST_REGISTERED_FONT_FINGERPRINT.with(|r| {
            let prev = *r.borrow();
            prev != Some(combined_fp)
        });
        if need_register {
            font_cx.collection.clear();
            for (_, bytes) in &fonts_for_fp {
                let font_blob = Blob::new(Arc::new(bytes.clone()));
                font_cx.collection.register_fonts(font_blob, None);
            }
        }

        let requested = font_family.trim();
        let family_names: Vec<String> =
            font_cx.collection.family_names().map(|s| s.to_string()).collect();
        let fallback_family =
            family_names.first().cloned().unwrap_or_else(|| "sans-serif".to_string());
        let family_name = if requested.is_empty() {
            fallback_family
        } else {
            family_names
                .iter()
                .find(|n| n.eq_ignore_ascii_case(requested) || n.starts_with(requested))
                .cloned()
                .unwrap_or(fallback_family)
        };

        let mut layout_cx = LayoutContext::new();
        let probe = "|ÉqÅM";
        let mut builder = layout_cx.ranged_builder(font_cx, probe, 1.0, true);
        builder.push_default(FontFamily::Named(Cow::Borrowed(&family_name)));
        builder.push_default(LineHeight::FontSizeRelative(1.0));
        builder.push_default(StyleProperty::FontSize(font_size_px));
        if let Some(w) = FontWeight::parse(font_weight.trim()) {
            builder.push_default(StyleProperty::FontWeight(w));
        }
        if let Some(s) = FontStyle::parse(font_style.trim()) {
            builder.push_default(StyleProperty::FontStyle(s));
        }
        let mut font_features = font_variant_to_features(font_variant.trim());
        if !font_kerning {
            if let Some(kern_off) = FontFeature::parse("kern=0") {
                font_features.push(kern_off);
            }
        }
        if !font_features.is_empty() {
            builder.push_default(StyleProperty::FontFeatures(FontSettings::List(Cow::Owned(font_features))));
        }

        let mut layout: parley::Layout<()> = builder.build(probe);
        layout.break_all_lines(None);
        layout.align(None, parley::Alignment::Start, AlignmentOptions::default());

        let first_line = layout.lines().next()?;
        let line_m = first_line.metrics();
        let ascent = line_m.ascent.max(0.0) as f64;
        let descent = line_m.descent.max(0.0) as f64;

        Some(FontMetrics {
            font_bounding_box_ascent: ascent,
            font_bounding_box_descent: descent,
            font_size: ascent + descent,
        })
    })
}
