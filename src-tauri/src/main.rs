// src-tauri/src/main.rs
// Desktop binary entry point. On mobile (Android/iOS) the build is a `cdylib`
// and `lib::run` is invoked via the `mobile_entry_point` macro — this file is
// not compiled for those targets.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    renance_playground_lib::run()
}
