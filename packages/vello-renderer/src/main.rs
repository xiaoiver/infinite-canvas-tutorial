//! 桌面入口：调用 lib 的 run_native。

fn main() {
    vello_renderer::run_native().expect("run");
}
