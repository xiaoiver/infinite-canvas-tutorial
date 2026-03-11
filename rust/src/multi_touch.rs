//! 多点触控手势：捏合缩放、平移、旋转。
//! 从 [vello with_winit multi_touch.rs](https://github.com/linebender/vello/blob/main/examples/with_winit/src/multi_touch.rs) 适配。

use std::collections::BTreeMap;

use vello::kurbo::{Point, Vec2};
use winit::event::{Touch, TouchPhase};

/// 当前帧的多点触控手势信息（≥2 指时有效）。
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct MultiTouchInfo {
    pub num_touches: usize,
    /// 捏合缩放比例，1 为不变，<1 缩小，>1 放大。
    pub zoom_delta: f64,
    pub zoom_delta_2d: Vec2,
    /// 旋转弧度（相对上一帧）。
    pub rotation_delta: f64,
    /// 多点平均位置移动量。
    pub translation_delta: Vec2,
    /// 捏合中心（用于绕该点缩放/旋转）。
    pub zoom_centre: Point,
}

#[derive(Clone)]
pub struct TouchState {
    active_touches: BTreeMap<u64, ActiveTouch>,
    gesture_state: Option<GestureState>,
    added_or_removed_touches: bool,
}

#[derive(Clone, Debug)]
struct GestureState {
    pinch_type: PinchType,
    previous: Option<DynGestureState>,
    current: DynGestureState,
}

#[derive(Clone, Copy, Debug)]
struct DynGestureState {
    avg_distance: f64,
    avg_abs_distance2: Vec2,
    avg_pos: Point,
    heading: f64,
}

#[derive(Clone, Copy, Debug)]
struct ActiveTouch {
    pos: Point,
}

impl TouchState {
    pub fn new() -> Self {
        Self {
            active_touches: BTreeMap::default(),
            gesture_state: None,
            added_or_removed_touches: false,
        }
    }

    pub fn add_event(&mut self, event: &Touch) {
        let pos = Point::new(event.location.x, event.location.y);
        match event.phase {
            TouchPhase::Started => {
                self.active_touches.insert(event.id, ActiveTouch { pos });
                self.added_or_removed_touches = true;
            }
            TouchPhase::Moved => {
                if let Some(touch) = self.active_touches.get_mut(&event.id) {
                    touch.pos = Point::new(event.location.x, event.location.y);
                }
            }
            TouchPhase::Ended | TouchPhase::Cancelled => {
                self.active_touches.remove(&event.id);
                self.added_or_removed_touches = true;
            }
        }
    }

    /// 每帧结束时调用，用于产生 delta。
    pub fn end_frame(&mut self) {
        self.update_gesture();
        if self.added_or_removed_touches {
            if let Some(state) = &mut self.gesture_state {
                state.previous = None;
            }
        }
        self.added_or_removed_touches = false;
    }

    /// 当存在多点触控手势时返回本帧的平移/缩放/旋转信息。
    pub fn info(&self) -> Option<MultiTouchInfo> {
        let state = self.gesture_state.as_ref()?;
        let state_previous = state.previous.unwrap_or(state.current);
        let zoom_delta = if self.active_touches.len() > 1 {
            state.current.avg_distance / state_previous.avg_distance
        } else {
            1.0
        };
        let zoom_delta2 = if self.active_touches.len() > 1 {
            match state.pinch_type {
                PinchType::Horizontal => Vec2::new(
                    state.current.avg_abs_distance2.x / state_previous.avg_abs_distance2.x,
                    1.0,
                ),
                PinchType::Vertical => Vec2::new(
                    1.0,
                    state.current.avg_abs_distance2.y / state_previous.avg_abs_distance2.y,
                ),
                PinchType::Proportional => Vec2::new(zoom_delta, zoom_delta),
            }
        } else {
            Vec2::new(1.0, 1.0)
        };
        Some(MultiTouchInfo {
            num_touches: self.active_touches.len(),
            zoom_delta,
            zoom_delta_2d: zoom_delta2,
            zoom_centre: state.current.avg_pos,
            rotation_delta: state.current.heading - state_previous.heading,
            translation_delta: state.current.avg_pos.to_vec2() - state_previous.avg_pos.to_vec2(),
        })
    }

    fn update_gesture(&mut self) {
        if let Some(dyn_state) = self.calc_dynamic_state() {
            if let Some(state) = &mut self.gesture_state {
                state.previous = Some(state.current);
                state.current = dyn_state;
            } else {
                self.gesture_state = Some(GestureState {
                    pinch_type: PinchType::classify(&self.active_touches),
                    previous: None,
                    current: dyn_state,
                });
            }
        } else {
            self.gesture_state = None;
        }
    }

    fn calc_dynamic_state(&self) -> Option<DynGestureState> {
        let num_touches = self.active_touches.len();
        if num_touches == 0 {
            return None;
        }
        let num_touches_recip = 1.0 / num_touches as f64;
        let mut state = DynGestureState {
            avg_distance: 0.0,
            avg_abs_distance2: Vec2::ZERO,
            avg_pos: Point::ZERO,
            heading: 0.0,
        };
        for touch in self.active_touches.values() {
            state.avg_pos.x += touch.pos.x;
            state.avg_pos.y += touch.pos.y;
        }
        state.avg_pos.x *= num_touches_recip;
        state.avg_pos.y *= num_touches_recip;
        for touch in self.active_touches.values() {
            state.avg_distance += state.avg_pos.distance(touch.pos);
            state.avg_abs_distance2.x += (state.avg_pos.x - touch.pos.x).abs();
            state.avg_abs_distance2.y += (state.avg_pos.y - touch.pos.y).abs();
        }
        state.avg_distance *= num_touches_recip;
        state.avg_abs_distance2.x *= num_touches_recip;
        state.avg_abs_distance2.y *= num_touches_recip;
        let first_touch = self.active_touches.values().next().unwrap();
        state.heading = (state.avg_pos.to_vec2() - first_touch.pos.to_vec2()).atan2();
        Some(state)
    }
}

#[derive(Clone, Debug)]
enum PinchType {
    Horizontal,
    Vertical,
    Proportional,
}

impl PinchType {
    fn classify(touches: &BTreeMap<u64, ActiveTouch>) -> Self {
        if touches.len() == 2 {
            let mut it = touches.values();
            let t0 = it.next().unwrap().pos;
            let t1 = it.next().unwrap().pos;
            let dx = (t0.x - t1.x).abs();
            let dy = (t0.y - t1.y).abs();
            if dx > 3.0 * dy {
                Self::Horizontal
            } else if dy > 3.0 * dx {
                Self::Vertical
            } else {
                Self::Proportional
            }
        } else {
            Self::Proportional
        }
    }
}
