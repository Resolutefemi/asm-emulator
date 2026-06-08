// src-tauri/src/main.rs
#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

use std::fs::File;
use std::io::copy;
use std::path::PathBuf;

#[cfg(target_os = "android")]
fn install_apk_android(apk_path: &str) -> Result<(), String> {
  use jni::objects::{JObject, JValue};
  use jni::JavaVM;

  // 1. Get ndk_context
  let ctx = ndk_context::android_context();
  let vm_ptr = ctx.vm();
  let activity_obj = unsafe { JObject::from_raw(ctx.context() as jni::sys::jobject) };

  // 2. Attach current thread to get JNIEnv
  let vm = unsafe { JavaVM::from_raw(vm_ptr as *mut jni::sys::JavaVM).map_err(|e| e.to_string())? };
  let mut env = vm.attach_current_thread().map_err(|e| e.to_string())?;

  // 3. Create Java File object: new File(apk_path)
  let file_class = env.find_class("java/io/File").map_err(|e| e.to_string())?;
  let path_string = env.new_string(apk_path).map_err(|e| e.to_string())?;
  let file_obj = env.new_object(&file_class, "(Ljava/lang/String;)V", &[JValue::Object(&path_string)]).map_err(|e| e.to_string())?;

  // 4. Call FileProvider.getUriForFile(activity, "com.renasm.playground.fileprovider", file)
  let provider_class = env.find_class("androidx/core/content/FileProvider").map_err(|e| e.to_string())?;
  let authority_string = env.new_string("com.renasm.playground.fileprovider").map_err(|e| e.to_string())?;
  let uri_obj = env.call_static_method(
    &provider_class,
    "getUriForFile",
    "(Landroid/content/Context;Ljava/lang/String;Ljava/io/File;)Landroid/net/Uri;",
    &[
      JValue::Object(&activity_obj),
      JValue::Object(&authority_string),
      JValue::Object(&file_obj),
    ]
  ).map_err(|e| e.to_string())?.l().map_err(|e| e.to_string())?;

  // 5. Construct Intent: new Intent("android.intent.action.VIEW")
  let intent_class = env.find_class("android/content/Intent").map_err(|e| e.to_string())?;
  let action_string = env.new_string("android.intent.action.VIEW").map_err(|e| e.to_string())?;
  let intent_obj = env.new_object(
    &intent_class,
    "(Ljava/lang/String;)V",
    &[JValue::Object(&action_string)]
  ).map_err(|e| e.to_string())?;

  // 6. Set intent flags: intent.setFlags(0x10000001) (FLAG_ACTIVITY_NEW_TASK | FLAG_GRANT_READ_URI_PERMISSION)
  env.call_method(
    &intent_obj,
    "setFlags",
    "(I)Landroid/content/Intent;",
    &[JValue::Int(0x10000001)]
  ).map_err(|e| e.to_string())?;

  // 7. Set intent data and type: intent.setDataAndType(uri, "application/vnd.android.package-archive")
  let type_string = env.new_string("application/vnd.android.package-archive").map_err(|e| e.to_string())?;
  env.call_method(
    &intent_obj,
    "setDataAndType",
    "(Landroid/net/Uri;Ljava/lang/String;)Landroid/content/Intent;",
    &[
      JValue::Object(&uri_obj),
      JValue::Object(&type_string),
    ]
  ).map_err(|e| e.to_string())?;

  // 8. Start Activity: activity.startActivity(intent)
  env.call_method(
    &activity_obj,
    "startActivity",
    "(Landroid/content/Intent;)V",
    &[JValue::Object(&intent_obj)]
  ).map_err(|e| e.to_string())?;

  Ok(())
}

fn download_apk(url: &str) -> Result<PathBuf, String> {
  // Get system temp directory
  let temp_dir = std::env::temp_dir();
  let apk_path = temp_dir.join("update.apk");

  // Create file
  let mut dest = File::create(&apk_path).map_err(|e| format!("Failed to create local update file: {}", e))?;

  // Download APK
  let response = ureq::get(url)
    .call()
    .map_err(|e| format!("Network request failed: {}", e))?;

  let mut reader = response.into_reader();

  // Copy bytes
  copy(&mut reader, &mut dest).map_err(|e| format!("Failed to write downloaded APK: {}", e))?;

  Ok(apk_path)
}

#[tauri::command]
async fn download_and_install_apk(url: String) -> Result<(), String> {
  // Download in background thread
  let path = tokio::task::spawn_blocking(move || {
    download_apk(&url)
  }).await.map_err(|e| e.to_string())??;

  let path_str = path.to_str().ok_or_else(|| "Invalid local file path".to_string())?;

  #[cfg(target_os = "android")]
  {
    install_apk_android(path_str)?;
  }

  #[cfg(not(target_os = "android"))]
  {
    let _ = path_str; // avoid unused warning
    return Err("APK installation is only supported on Android".to_string());
  }

  Ok(())
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![download_and_install_apk])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}